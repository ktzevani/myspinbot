# worker/src/tasks.py
from __future__ import annotations

import asyncio
import io
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeAlias, Dict, Any
import uuid

from minio import Minio
from minio.error import S3Error

from ..models.storage.artifact_schema import ArtifactMeta, ArtifactUploadResult
from ..config import get_config, get_capabilities as get_worker_capabilities

WorkerTask: TypeAlias = Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[None]]

_worker_config = get_config()
_TASK_MAP: dict[str, WorkerTask] = {}


def task(name: str):
    """Decorator to register async task functions by name."""

    def wrapper(func):
        _TASK_MAP[name] = func
        return func

    return wrapper


# Helper
def connect_minio() -> Minio:
    """Return a configured MinIO client using env variables."""
    return Minio(
        _worker_config.storage.url.replace("http://", "").replace("https://", ""),
        _worker_config.storage.username,
        _worker_config.storage.password,
        secure=_worker_config.storage.url.startswith("https://"),
    )


# -- Simulated task helpers


async def simulate_progress(
    publish,
    weight: float,
    total_steps: int = 5,
    delay: float = 0.5,
):
    """Simulate progressive updates for demonstration purposes."""
    progress_step = round(weight / total_steps, 4)
    for i in range(total_steps):
        await publish(progress_step)
        await asyncio.sleep(delay)


async def upload_dummy_artifact(
    bucket: str, name: str, content: bytes
) -> ArtifactUploadResult:
    """Upload a dummy artifact to MinIO and return metadata."""
    client = connect_minio()
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
            content_type="application/octet-stream",
        )
        meta = ArtifactMeta(
            bucket=bucket,
            key=name,
            size_bytes=size,
            created_at=datetime.now(timezone.utc),
            content_type="application/octet-stream",
        )
        return ArtifactUploadResult(ok=True, meta=meta)
    except S3Error as e:
        print(f"[Worker] ❌ Failed to upload artifact: {e}")
        raise


# -- Task implementations


@task("train_lora")
async def train_lora(params: Dict[str, Any], _: Dict[str, Any]):
    """LoRA training task."""

    progress_weight, publish_progress_cb = (
        params["progress_weight"],
        params["publish_progress_cb"],
    )
    train_id = str(uuid.uuid4())

    print(f"[Worker] 🎨 Starting LoRA training for {train_id}")

    # Simulated artifact
    result = await upload_dummy_artifact(
        "loras",
        f"{train_id}_model.pt",
        content=b"dummy lora weights",
    )
    # Simulated progress
    await simulate_progress(
        publish_progress_cb, progress_weight, total_steps=6, delay=0.8
    )

    print(f"[Worker] ✅ LoRA training completed: {result.meta.key}")


@task("train_voice")
async def train_voice(params: Dict[str, Any], _: Dict[str, Any]):
    """Simulated voice model training task."""

    progress_weight, publish_progress_cb = (
        params["progress_weight"],
        params["publish_progress_cb"],
    )
    train_id = str(uuid.uuid4())

    print(f"[Worker] 🎤 Starting voice training for {train_id}")
    # Simulated artifact
    result = await upload_dummy_artifact(
        "voices",
        f"{train_id}_voice.bin",
        content=b"dummy voice weights",
    )
    # Simulated progress
    await simulate_progress(
        publish_progress_cb, progress_weight, total_steps=5, delay=1.0
    )
    print(f"[Worker] ✅ Voice model training completed: {result.meta.key}")


@task("render_video")
async def render_video(params: Dict[str, Any], _: Dict[str, Any]):
    """Simulated video rendering task."""

    progress_weight, publish_progress_cb = (
        params["progress_weight"],
        params["publish_progress_cb"],
    )
    train_id = str(uuid.uuid4())

    print(f"[Worker] 🎬 Starting video rendering for {train_id}")
    # Simulated artifact
    result = await upload_dummy_artifact(
        "videos",
        f"{train_id}_output.mp4",
        content=b"dummy video content",
    )
    # Simulated progress
    await simulate_progress(
        publish_progress_cb, progress_weight, total_steps=8, delay=0.6
    )
    print(f"[Worker] ✅ Video rendering completed: {result.meta.key}")


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
