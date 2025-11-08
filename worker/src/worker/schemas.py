from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from enum import StrEnum


class JobMessage(BaseModel):
    """Raw message pulled directly from Redis Streams (before normalization)."""

    jid: str = Field(..., description="Unique job ID")
    type: str = Field(..., description="Job type identifier (train/generate/etc.)")
    timestamp: Optional[str] = Field(None, description="Timestamp in ms (stringified)")
    stream: str = Field(..., description="Stream name")
    xid: str = Field(..., description="Redis Stream entry ID")


class JobStatus(StrEnum):
    """Allowed job lifecycle states."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    NOT_FOUND = "not_found"


class ProgressUpdate(BaseModel):
    """Payload for job progress updates."""

    jid: str
    progress: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusUpdate(BaseModel):
    """Payload for job status updates."""

    jid: str
    status: JobStatus
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ArtifactMeta(BaseModel):
    """Metadata for artifacts uploaded to MinIO (e.g. LoRA, voice, video)."""

    bucket: str
    key: str
    size_bytes: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    content_type: Optional[str] = None


class ArtifactUploadResult(BaseModel):
    """Result of a successful artifact upload."""

    ok: bool
    meta: ArtifactMeta
