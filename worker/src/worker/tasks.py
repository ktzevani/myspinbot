# worker/src/tasks.py
from __future__ import annotations

import asyncio
import io
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeAlias

from minio import Minio
from minio.error import S3Error

from .models.storage.artifact_schema import ArtifactMeta, ArtifactUploadResult
from .models.jobs.job_messaging_schema import (
    DataUpdate,
    ProgressUpdate,
    StatusUpdate,
    JobStatus,
)
from .bridge import PublishHook
from .config import get_config, get_capabilities as get_worker_capabilities

WorkerTask: TypeAlias = Callable[[str, PublishHook], Awaitable[None]]

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
    publish: PublishHook,
    jobId: str,
    total_steps: int = 5,
    delay: float = 0.5,
):
    """Simulate progressive updates for demonstration purposes."""
    for i in range(total_steps):
        progress = round((i + 1) / total_steps, 3)
        await publish(
            ProgressUpdate(
                jobId=jobId, progress=progress, created=datetime.now(timezone.utc)
            )
        )
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
async def train_lora(jobId: str, publish: PublishHook):
    """LoRA training task."""
    print(f"[Worker] 🎨 Starting LoRA training for {jobId}")
    await publish(
        StatusUpdate(
            jobId=jobId, status=JobStatus.running, created=datetime.now(timezone.utc)
        )
    )
    # Simulated artifact
    result = await upload_dummy_artifact(
        "loras",
        f"{jobId}_model.pt",
        content=b"dummy lora weights",
    )
    # Simulated progress
    await simulate_progress(publish, jobId, total_steps=6, delay=0.8)
    await publish(
        StatusUpdate(
            jobId=jobId, status=JobStatus.completed, created=datetime.now(timezone.utc)
        )
    )
    print(f"[Worker] ✅ LoRA training completed: {result.meta.key}")


@task("train_voice")
async def train_voice(jobId: str, publish: PublishHook):
    """Simulated voice model training task."""
    print(f"[Worker] 🎤 Starting voice training for {jobId}")
    # Simulated artifact
    result = await upload_dummy_artifact(
        "voices",
        f"{jobId}_voice.bin",
        content=b"dummy voice weights",
    )
    # Simulated progress
    await simulate_progress(publish, jobId, total_steps=5, delay=1.0)
    print(f"[Worker] ✅ Voice model training completed: {result.meta.key}")


@task("render_video")
async def render_video(jobId: str, publish: PublishHook):
    """Simulated video rendering task."""
    print(f"[Worker] 🎬 Starting video rendering for {jobId}")
    # Simulated artifact
    result = await upload_dummy_artifact(
        "videos",
        f"{jobId}_output.mp4",
        content=b"dummy video content",
    )
    # Simulated progress
    await simulate_progress(publish, jobId, total_steps=8, delay=0.6)
    print(f"[Worker] ✅ Video rendering completed: {result.meta.key}")


@task("get_capabilities")
async def get_capabilities(jobId: str, publish: PublishHook):
    """Return the registered capabilities manifest to callers."""

    print(f"[Worker] 📋 Emitting capability registry for {jobId}")
    await publish(
        StatusUpdate(
            jobId=jobId, status=JobStatus.running, created=datetime.now(timezone.utc)
        )
    )
    await publish(
        DataUpdate(
            jobId=jobId,
            data=get_worker_capabilities().model_dump_json(),
            created=datetime.now(timezone.utc),
        )
    )
    await publish(
        ProgressUpdate(jobId=jobId, progress=1.0, created=datetime.now(timezone.utc))
    )
    await publish(
        StatusUpdate(
            jobId=jobId, status=JobStatus.completed, created=datetime.now(timezone.utc)
        )
    )


# Task provider
def get_task_for_job(job_type: str) -> WorkerTask:
    """Return the correct coroutine for a given job type."""
    try:
        return _TASK_MAP[job_type]
    except KeyError:
        raise ValueError(f"No registered task for job type '{job_type}'")
