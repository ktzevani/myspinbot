# worker/src/tasks.py
from __future__ import annotations

import asyncio
import io
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeAlias

from minio import Minio
from minio.error import S3Error

from .schemas import (
    ArtifactMeta,
    ArtifactUploadResult,
    DataUpdate,
    ProgressUpdate,
    StatusUpdate,
    JobStatus,
)
from .bridge import PublishHook
from .registry import capability_registry
from .utils import get_config, json_dumps_safe


WorkerTask: TypeAlias = Callable[[str, PublishHook], Awaitable[None]]

worker_config = get_config()

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
        worker_config["MINIO_ENDPOINT"].replace("http://", "").replace("https://", ""),
        worker_config["MINIO_ACCESS_KEY"],
        worker_config["MINIO_SECRET_KEY"],
        secure=worker_config["MINIO_ENDPOINT"].startswith("https://"),
    )


# -- Simulated task helpers


async def simulate_progress(
    publish: PublishHook,
    jid: str,
    total_steps: int = 5,
    delay: float = 0.5,
):
    """Simulate progressive updates for demonstration purposes."""
    for i in range(total_steps):
        progress = round((i + 1) / total_steps, 3)
        await publish(ProgressUpdate(jid=jid, progress=progress))
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
async def train_lora(jid: str, publish: PublishHook):
    """LoRA training task."""
    print(f"[Worker] 🎨 Starting LoRA training for {jid}")
    await publish(StatusUpdate(jid=jid, status=JobStatus.RUNNING))
    # Simulated artifact
    result = await upload_dummy_artifact(
        "loras",
        f"{jid}_model.pt",
        content=b"dummy lora weights",
    )
    # Simulated progress
    await simulate_progress(publish, jid, total_steps=6, delay=0.8)
    await publish(StatusUpdate(jid=jid, status=JobStatus.COMPLETED))
    print(f"[Worker] ✅ LoRA training completed: {result.meta.key}")


@task("train_voice")
async def train_voice(jid: str, publish: PublishHook):
    """Simulated voice model training task."""
    print(f"[Worker] 🎤 Starting voice training for {jid}")
    # Simulated artifact
    result = await upload_dummy_artifact(
        "voices",
        f"{jid}_voice.bin",
        content=b"dummy voice weights",
    )
    # Simulated progress
    await simulate_progress(publish, jid, total_steps=5, delay=1.0)
    print(f"[Worker] ✅ Voice model training completed: {result.meta.key}")


@task("render_video")
async def render_video(jid: str, publish: PublishHook):
    """Simulated video rendering task."""
    print(f"[Worker] 🎬 Starting video rendering for {jid}")
    # Simulated artifact
    result = await upload_dummy_artifact(
        "videos",
        f"{jid}_output.mp4",
        content=b"dummy video content",
    )
    # Simulated progress
    await simulate_progress(publish, jid, total_steps=8, delay=0.6)
    print(f"[Worker] ✅ Video rendering completed: {result.meta.key}")


@task("get_capabilities")
async def get_capabilities(jid: str, publish: PublishHook):
    """Return the registered capabilities manifest to callers."""

    print(f"[Worker] 📋 Emitting capability registry for {jid}")
    await publish(StatusUpdate(jid=jid, status=JobStatus.RUNNING))
    manifest_data = capability_registry.manifest_payload()
    manifest_json = json_dumps_safe(manifest_data)
    await publish(DataUpdate(jid=jid, data=manifest_json))
    await publish(ProgressUpdate(jid=jid, progress=1.0))
    await publish(StatusUpdate(jid=jid, status=JobStatus.COMPLETED))


# Task provider
def get_task_for_job(job_type: str) -> WorkerTask:
    """Return the correct coroutine for a given job type."""
    try:
        return _TASK_MAP[job_type]
    except KeyError:
        raise ValueError(f"No registered task for job type '{job_type}'")
