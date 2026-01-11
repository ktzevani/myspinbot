# worker/src/tasks.py
from __future__ import annotations

import asyncio
import io
import json
import os
import sys
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeAlias, Dict, Any
import uuid

from minio import Minio
from minio.error import S3Error

from ..models.storage.artifact_schema import ArtifactMeta, ArtifactUploadResult
from ..config import get_config, get_capabilities as get_worker_capabilities
from .media import (
    ComfyUIError,
    build_placeholder_png,
    maybe_render_comfyui,
    synthesize_wave_speech,
)

WorkerTask: TypeAlias = Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[None]]

_worker_config = get_config()
_TASK_MAP: dict[str, WorkerTask] = {}


def task(name: str):
    """Decorator to register async task functions by name."""

    def wrapper(func):
        _TASK_MAP[name] = func
        return func

    return wrapper


def _connect_minio() -> Minio:
    """Return a configured MinIO client using env variables."""
    return Minio(
        _worker_config.storage.url.replace("http://", "").replace("https://", ""),
        _worker_config.storage.username,
        _worker_config.storage.password,
        secure=_worker_config.storage.url.startswith("https://"),
    )


def upload_bytes(
    bucket: str,
    name: str,
    content: bytes,
    content_type: str = "application/octet-stream",
) -> ArtifactUploadResult:
    """Upload bytes to MinIO and return typed metadata."""
    client = _connect_minio()
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        buffer = io.BytesIO(content)
        size = len(content)
        client.put_object(
            bucket_name=bucket,
            object_name=name,
            data=buffer,
            length=size,
            content_type=content_type,
        )
        meta = ArtifactMeta(
            bucket=bucket,
            key=name,
            size_bytes=size,
            created_at=datetime.now(timezone.utc),
            content_type=content_type,
        )
        return ArtifactUploadResult(ok=True, meta=meta)
    except S3Error as exc:  # pragma: no cover - network error path
        raise RuntimeError(f"Failed to upload {name}: {exc}") from exc


async def _generate_visual(
    stage_prompt: str, comfy_url: str | None
) -> tuple[bytes, Dict[str, Any]]:
    if comfy_url:
        try:
            return await maybe_render_comfyui(stage_prompt, comfy_url)
        except ComfyUIError:
            pass
    return build_placeholder_png(stage_prompt), {"source": "placeholder"}


@task("train_lora")
async def train_lora(params: Dict[str, Any], node_input: Dict[str, Any]):
    """LoRA training task honoring pipeline variant/options."""

    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )
    preset = params.get("preset") or params.get("variant") or "default"
    train_id = str(uuid.uuid4())
    await publish_progress_cb(progress_weight * 0.1)

    manifest = {
        "trainId": train_id,
        "preset": preset,
        "dataset": node_input.get("dataset") or params.get("dataset") or {},
        "hyperparameters": params.get("hyperparameters") or {},
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    artifact = upload_bytes(
        "loras",
        f"{train_id}_{preset}.json",
        content=json.dumps(manifest, indent=2).encode("utf-8"),
        content_type="application/json",
    )
    result = {"loraArtifact": artifact.meta.model_dump(mode="json")}

    await publish_progress_cb(progress_weight * 0.6)
    await asyncio.sleep(0.3)
    await publish_progress_cb(progress_weight * 0.3)
    print(f"[Worker] ✅ LoRA training completed: {result}")
    return result


@task("train_voice")
async def train_voice(params: Dict[str, Any], node_input: Dict[str, Any]):
    """Voice model training task honoring variant/options."""

    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )
    preset = params.get("preset") or params.get("variant") or "default"
    voice_id = str(uuid.uuid4())
    await publish_progress_cb(progress_weight * 0.1)

    waveform = synthesize_wave_speech(
        node_input.get("sample_text")
        or params.get("sample_text")
        or "Default voice line."
    )
    audio_artifact = upload_bytes(
        "voices",
        f"{voice_id}_{preset}.wav",
        content=waveform,
        content_type="audio/wav",
    )
    voice_manifest = {
        "voiceId": voice_id,
        "preset": preset,
        "language": node_input.get("language") or params.get("language") or "en",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "audio": audio_artifact.meta.model_dump(mode="json"),
    }
    voice_meta_artifact = upload_bytes(
        "voices",
        f"{voice_id}_{preset}.json",
        json.dumps(voice_manifest, indent=2).encode("utf-8"),
        content_type="application/json",
    )
    result = {
        "voiceArtifact": audio_artifact.meta.model_dump(mode="json"),
        "voiceMeta": voice_meta_artifact.meta.model_dump(mode="json"),
    }

    await publish_progress_cb(progress_weight * 0.7)
    await asyncio.sleep(0.3)
    await publish_progress_cb(progress_weight * 0.2)
    print(f"[Worker] ✅ Voice model training completed: {result}")
    return result


@task("render_video")
async def render_video(params: Dict[str, Any], node_input: Dict[str, Any]):
    """Hybrid video rendering task using ComfyUI + synthetic TTS with a structured manifest."""

    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )
    variant = params.get("variant") or params.get("preset") or "default"
    comfy_url = params.get("comfy_url") or os.getenv(
        "COMFYUI_BASE_URL", "http://comfyui:8188"
    )
    # Gather upstream context
    stage_prompt = (
        node_input.get("stagePrompt")
        or node_input.get("prompt")
        or node_input.get("script", {}).get("stagePrompt")
        or params.get("stagePrompt")
        or "Untitled scene"
    )
    narration = (
        node_input.get("narration")
        or node_input.get("script", {}).get("narration")
        or params.get("narration")
        or "Narration not provided."
    )
    await publish_progress_cb(progress_weight * 0.1)
    print(f"[Worker] 🎬 Starting video rendering (variant={variant})")

    audio = synthesize_wave_speech(narration)
    audio_artifact = upload_bytes(
        "audio",
        f"{uuid.uuid4()}_{variant}.wav",
        content=audio,
        content_type="audio/wav",
    )

    image_bytes, render_meta = await _generate_visual(
        stage_prompt, comfy_url if comfy_url else None
    )
    image_artifact = upload_bytes(
        "renders",
        f"{uuid.uuid4()}_{variant}.png",
        content=image_bytes,
        content_type="image/png",
    )

    video_manifest = {
        "variant": variant,
        "stagePrompt": stage_prompt,
        "narration": narration,
        "image": image_artifact.meta.model_dump(mode="json"),
        "audio": audio_artifact.meta.model_dump(mode="json"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    manifest_artifact = upload_bytes(
        "videos",
        f"{uuid.uuid4()}_{variant}_manifest.json",
        content=json.dumps(video_manifest, indent=2).encode("utf-8"),
        content_type="application/json",
    )

    result = {
        "video": manifest_artifact.meta.model_dump(mode="json"),
        "audio": audio_artifact.meta.model_dump(mode="json"),
        "image": image_artifact.meta.model_dump(mode="json"),
        "render_meta": render_meta,
    }

    await publish_progress_cb(progress_weight * 0.9)

    print(f"[Worker] ✅ Video rendering completed: {result.get('video')}")
    return result


@task("f5_to_tts")
async def f5_to_tts(params: Dict[str, Any], node_input: Dict[str, Any]):
    """Voice model training task honoring variant/options."""

    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )

    class StreamAdapter:
        def __init__(self, stream, cb):
            self.stream = stream
            self.cb = cb

        def write(self, data):
            self.stream.write(data)

        def flush(self):
            self.stream.flush()
            self.cb()

    prog_count = 0.0
    total_steps = 30.0
    step_count = 0
    loop = asyncio.get_running_loop()

    async def publish_decorator(val):
        nonlocal step_count
        await publish_progress_cb(val)
        step_count += 1

    def on_step():
        nonlocal prog_count, total_steps
        prog_count += progress_weight * (1.0 / total_steps)
        loop.call_soon_threadsafe(
            lambda: loop.create_task(
                publish_decorator(progress_weight * (1.0 / total_steps))
            )
        )

    try:
        old_stderr = sys.stderr
        old_stdout = sys.stdout
        sys.stderr = StreamAdapter(old_stderr, on_step)
        sys.stdout = StreamAdapter(old_stdout, on_step)

        from ..workflows.tts import TextToSpeech

        tts_params = dict()
        tts_params.update(
            {
                "model": "F5TTS_v1_Base",
                "device": "cuda",
                "temperature": 0.8,
                "speed": 1,
                "target_rms": 0.1,
                "cross_fade_duration": 0.15,
                "nfe_step": 32,
                "cfg_strength": 2,
                "narrator_voice": params.get("audioPath"),
                "ref_text": params.get("refText"),
                "seed": 290381,
            }
        )
        tts = TextToSpeech(**tts_params)
        audio_meta = await asyncio.to_thread(tts.run, node_input["narration"])
    finally:
        sys.stderr = old_stderr
        sys.stdout = old_stdout

    result = {"audioArtifact": audio_meta}

    if step_count < total_steps:
        await publish_progress_cb(
            progress_weight * (total_steps - step_count + 1) / total_steps
        )

    print(f"[Worker] ✅ Voice model training completed: {result}")
    return result


@task("render_video_infinitetalk")
async def render_video_infinitetalk(params: Dict[str, Any], node_input: Dict[str, Any]):
    """Hybrid video rendering task using ComfyUI + synthetic TTS with a structured manifest."""

    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )
    variant = params.get("variant") or params.get("preset") or "default"
    comfy_url = params.get("comfy_url") or os.getenv(
        "COMFYUI_BASE_URL", "http://comfyui:8188"
    )
    # Gather upstream context
    stage_prompt = (
        node_input.get("stagePrompt")
        or node_input.get("prompt")
        or node_input.get("script", {}).get("stagePrompt")
        or params.get("stagePrompt")
        or "Untitled scene"
    )
    narration = (
        node_input.get("narration")
        or node_input.get("script", {}).get("narration")
        or params.get("narration")
        or "Narration not provided."
    )
    await publish_progress_cb(progress_weight * 0.1)
    print(f"[Worker] 🎬 Starting video rendering (variant={variant})")

    audio = synthesize_wave_speech(narration)
    audio_artifact = upload_bytes(
        "audio",
        f"{uuid.uuid4()}_{variant}.wav",
        content=audio,
        content_type="audio/wav",
    )

    image_bytes, render_meta = await _generate_visual(
        stage_prompt, comfy_url if comfy_url else None
    )
    image_artifact = upload_bytes(
        "renders",
        f"{uuid.uuid4()}_{variant}.png",
        content=image_bytes,
        content_type="image/png",
    )

    video_manifest = {
        "variant": variant,
        "stagePrompt": stage_prompt,
        "narration": narration,
        "image": image_artifact.meta.model_dump(mode="json"),
        "audio": audio_artifact.meta.model_dump(mode="json"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    manifest_artifact = upload_bytes(
        "videos",
        f"{uuid.uuid4()}_{variant}_manifest.json",
        content=json.dumps(video_manifest, indent=2).encode("utf-8"),
        content_type="application/json",
    )

    result = {
        "video": manifest_artifact.meta.model_dump(mode="json"),
        "audio": audio_artifact.meta.model_dump(mode="json"),
        "image": image_artifact.meta.model_dump(mode="json"),
        "render_meta": render_meta,
    }

    await publish_progress_cb(progress_weight * 0.9)
    await asyncio.sleep(0.3)
    print(f"[Worker] ✅ Video rendering completed: {result.get('video')}")
    return result


@task("get_capabilities")
async def get_capabilities(_params: Dict[str, Any], _input: Dict[str, Any]):
    """Return the registered capabilities manifest to callers."""

    print("[Worker] 📋 Returning capability registry.")

    return {"workerCaps": get_worker_capabilities().model_dump_json()}


# Task provider
def get_task_for_job(job_type: str) -> WorkerTask:
    """Return the correct coroutine for a given job type."""
    try:
        return _TASK_MAP[job_type]
    except KeyError:
        raise ValueError(f"No registered task for job type '{job_type}'")


def get_task_registry() -> dict[str, WorkerTask]:
    """Expose the internal task registry (read-only reference)."""
    return _TASK_MAP
