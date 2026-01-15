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


class StreamAdapter:
    def __init__(self, stream, cb):
        self.stream = stream
        self.cb = cb

    def write(self, data):
        self.stream.write(data)
        self.cb()

    def flush(self):
        self.stream.flush()
        self.cb()


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
        "speech",
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
        "speech",
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
        "output",
        f"{uuid.uuid4()}_{variant}.wav",
        content=audio,
        content_type="audio/wav",
    )

    image_bytes, render_meta = await _generate_visual(
        stage_prompt, comfy_url if comfy_url else None
    )
    image_artifact = upload_bytes(
        "output",
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
        "output",
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

    current_progress = node_input["currentProgress"]
    total_progress = node_input["currentProgress"] + progress_weight
    if total_progress > 1.0:
        total_progress = 1.0
    step_weight = 0
    loop = asyncio.get_running_loop()

    def on_step():
        nonlocal current_progress, step_weight
        current_progress += step_weight
        if current_progress > total_progress:
            current_progress = total_progress
        loop.call_soon_threadsafe(
            lambda: loop.create_task(publish_progress_cb(current_progress))
        )

    try:
        old_stdout = sys.stdout
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
        input_narration = node_input.get("narration", "")
        estimated_steps = tts.estimate_progress_steps(input_narration)
        step_weight = progress_weight / estimated_steps
        audio_meta = await asyncio.to_thread(tts.run, input_narration)
    finally:
        sys.stdout = old_stdout

    result = {
        "audioArtifact": audio_meta,
        "currentProgress": node_input["currentProgress"] + progress_weight,
    }

    await publish_progress_cb(result["currentProgress"])

    print(
        f"[Worker] ✅ Voice generation completed (artifact in s3): {result["audioArtifact"]}"
    )
    return result


@task("infinite_talk")
async def infinite_talk(params: Dict[str, Any], node_input: Dict[str, Any]):

    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )

    current_progress = node_input["currentProgress"]
    total_progress = node_input["currentProgress"] + progress_weight
    if total_progress > 1.0:
        total_progress = 1.0
    step_weight = 0
    loop = asyncio.get_running_loop()

    def on_step():
        nonlocal current_progress, step_weight
        current_progress += step_weight
        if current_progress > total_progress:
            current_progress = total_progress
        loop.call_soon_threadsafe(
            lambda: loop.create_task(publish_progress_cb(current_progress))
        )

    try:
        old_stdout = sys.stdout
        sys.stdout = StreamAdapter(old_stdout, on_step)

        from ..workflows.infinitetalk import InfiniteTalk

        infinitetalk_params = dict()
        infinitetalk_params.update(
            {
                # Model Loading
                "infinitetalk_model": "wanvideo/infinite_talk/Wan2_1-InfiniTetalk-Single_fp16.safetensors",
                "vae_model": "wanvideo/Wan2_1_VAE_bf16.safetensors",
                "t5_text_encoder_model": "umt5/umt5-xxl-enc-bf16.safetensors",
                "t5_precision": "bf16",
                "wav2vec_model": "TencentGameMate/chinese-wav2vec2-base",
                "wav2vec_precision": "fp16",
                "wav2vec_load_device": "main_device",
                "lora_model": "wanvideo/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors",
                "lora_strength": 1,
                "clip_vision_model": "wanvideo/clip_vision_h.safetensors",
                "wan_video_model": "wanvideo/wan2.1_i2v_720p_14B_bf16.safetensors",
                "wan_video_precision": "bf16",
                "wan_video_quantization": "disabled",
                "wan_video_load_device": "offload_device",
                # Memory & Performance
                "blocks_to_swap": 40,
                "offload_img_emb": True,
                "offload_txt_emb": True,
                "compile_backend": "inductor",
                "compile_fullgraph": False,
                "compile_mode": "default",
                "compile_dynamic": False,
                "compile_cache_size_limit": 64,
                "compile_transformer_blocks_only": True,
                # Resolution & Resizing
                "resolution_mode": "Manual",
                "width": 512,  # 960,
                "height": 512,  # 576,
                "upscale_method": "lanczos",
                "keep_proportion": "crop",
                "pad_color": "0, 0, 0",
                "crop_position": "center",
                "divisible_by": 16,
                # Sampling & Generation
                "fps": 25,
                "positive_prompt": params.get(
                    "positive_prompt",
                    "a man is talking, professional speaker, dramatic, intelligent, subtle head movement, high-resolution, cinematic lighting\n",
                ),
                "negative_prompt": params.get(
                    "negative_prompt",
                    "blurry, distorted, static, text, watermark, exaggerated movement, bad lip sync, bad hands, low quality",
                ),
                "sampling_steps": 6,  # 8
                "sampling_cfg": 1.0,
                "sampling_shift": 11,
                "sampling_seed": 290381,
                "sampling_force_offload": True,
                "sampling_scheduler": "dpm++_sde",
                "riflex_freq_index": 0,
                "frame_window_size": 81,  # 81
                "motion_frame": 25,  # 25
                "infinitetalk_force_offload": True,
                "colormatch": "disabled",
                # Audio Processing
                "audio_start_time": "0:00",
                "audio_end_time": "1:00",
                "normalize_loudness": True,
                "audio_scale": 1.6,  # 2.0 - Increased for stronger lip influence
                "audio_cfg_scale": 1,  # 2.2 - Enabled CFG for audio guidance
                "multi_audio_type": "add",
                # VAE Tiling
                "encode_vae_tiling": True,
                "encode_tile_x": 384,
                "encode_tile_y": 384,
                "encode_tile_stride_x": 256,
                "encode_tile_stride_y": 256,
                "decode_vae_tiling": True,
                "decode_tile_x": 128,
                "decode_tile_y": 128,
                "decode_tile_stride_x": 96,
                "decode_tile_stride_y": 96,
                # Output
                "video_loop_count": 0,
                "video_format": "video/h264-mp4",
                "video_pingpong": False,
                "video_save_output": True,
                # CLIP Vision Specifics
                "clip_vision_strength_1": 1,
                "clip_vision_strength_2": 1,
                "clip_vision_crop": "center",
                "clip_vision_combine_embeds": "average",
                "clip_vision_force_offload": True,
            }
        )

        infitalk = InfiniteTalk(**infinitetalk_params)
        audio_artifact_path = f"{node_input.get('audioArtifact', {})['bucket']}/{node_input.get('audioArtifact', {})['key']}"
        estimated_steps = infitalk.estimate_progress_steps(
            audio_artifact_path,
            infinitetalk_params.get("fps", 25),
            infinitetalk_params.get("frame_window_size", 81)
            - infinitetalk_params.get("motion_frame", 25),
        )
        step_weight = progress_weight / estimated_steps
        video_meta = await asyncio.to_thread(
            infitalk.run,
            params.get("imagePath", ""),
            audio_artifact_path,
        )
    finally:
        sys.stdout = old_stdout

    result = {
        "videoArtifact": video_meta,
        "currentProgress": node_input["currentProgress"] + progress_weight,
    }

    await publish_progress_cb(result["currentProgress"])
    print(
        f"[Worker] ✅ Infinite talk speech video generated (artifact in s3): {result["videoArtifact"]}"
    )
    return result


@task("render_video_infinitetalk")
async def render_video_infinitetalk(params: Dict[str, Any], node_input: Dict[str, Any]):
    progress_weight, publish_progress_cb = (
        params.get("progress_weight", 0),
        params["publish_progress_cb"],
    )

    current_progress = node_input["currentProgress"]
    total_progress = node_input["currentProgress"] + progress_weight
    if total_progress > 1.0:
        total_progress = 1.0
    step_weight = 0
    loop = asyncio.get_running_loop()

    def on_step():
        nonlocal current_progress, step_weight
        current_progress += step_weight
        if current_progress > total_progress:
            current_progress = total_progress
        loop.call_soon_threadsafe(
            lambda: loop.create_task(publish_progress_cb(current_progress))
        )

    try:
        old_stdout = sys.stdout
        sys.stdout = StreamAdapter(old_stdout, on_step)

        from ..workflows.upscaler import AIUpscaler

        upscaler_params = dict()
        upscaler_params.update(
            {
                "model_name_0": "RealESRGAN_x2.pth",  # "4x_NMKD-Siax_200k.pth",
                "model_name_1": "codeformer.pth",
                "batch_size": 50,
                "force_rate": 0,
                "custom_width": 0,
                "custom_height": 0,
                "frame_load_cap": 0,
                "skip_first_frames": 0,
                "select_every_nth": 1,
                "facedetection": "retinaface_resnet50",
                "codeformer_fidelity": 1,
            }
        )

        upscaler = AIUpscaler(**upscaler_params)
        video_artifact_path = f"{node_input.get('videoArtifact', {})['bucket']}/{node_input.get('videoArtifact', {})['key']}"
        estimated_steps = upscaler.estimate_progress_steps(
            video_artifact_path, upscaler_params.get("batch_size", 1)
        )
        step_weight = progress_weight / estimated_steps

        video_meta = await asyncio.to_thread(
            upscaler.run,
            video_artifact_path,
        )
    finally:
        sys.stdout = old_stdout

    result = {
        "videoArtifact": video_meta,
        "currentProgress": node_input["currentProgress"] + progress_weight,
    }

    await publish_progress_cb(result["currentProgress"])
    print(
        f"[Worker] ✅ Video rendering completed (artifact in s3): {result["videoArtifact"]}"
    )
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
