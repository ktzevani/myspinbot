from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from enum import StrEnum


class JobMessage(BaseModel):
    """Raw message pulled directly from Redis Streams (before normalization)."""

    xid: str = Field(..., description="Redis Stream entry ID")
    stream: str = Field(..., description="Stream name")
    jobId: str = Field(..., description="Unique job ID")
    name: str = Field(..., description="Job type identifier (train/generate/etc.)")
    created: Optional[str] = Field(None, description="Timestamp in ms (stringified)")
    input: Optional[str] = Field(
        None, description="Generic data input serialized to string"
    )


class JobStatus(StrEnum):
    """Allowed job lifecycle states."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    NOT_FOUND = "not_found"


class DataUpdate(BaseModel):
    """Pub/Sub payload containing generic job updates."""

    jobId: str
    data: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProgressUpdate(BaseModel):
    """Payload for job progress updates."""

    jobId: str
    progress: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusUpdate(BaseModel):
    """Payload for job status updates."""

    jobId: str
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


# -- Capability schema -----------------------------------------------------


class CapabilityPlane(StrEnum):
    """Execution plane identifiers shared with the Node orchestrator."""

    NODE = "node"
    PYTHON = "python"


class CapabilityRuntimeKind(StrEnum):
    """Runtime hints to help planners reason about where code executes."""

    CPU = "cpu"
    GPU = "gpu"


CAPABILITY_VERSION = "2025.02.0"


class CapabilityParameter(BaseModel):
    """Individual parameter description similar to JSON Schema properties."""

    name: str
    type: str
    description: str = ""
    required: bool = False
    enum: Optional[List[str]] = None
    default: Optional[Any] = None


class CapabilityHandler(BaseModel):
    """Reference to the module + resolver responsible for the capability."""

    module: str
    method: str


class CapabilityRuntime(BaseModel):
    """Runtime envelope describing scheduling constraints."""

    kind: CapabilityRuntimeKind
    timeout_seconds: int = Field(..., alias="timeoutSeconds")
    concurrency: int


def _empty_schema() -> Dict[str, Any]:
    return {"type": "object", "properties": {}}


class CapabilityIO(BaseModel):
    """Input/output schema placeholders."""

    input: Dict[str, Any] = Field(default_factory=_empty_schema)
    output: Dict[str, Any] = Field(default_factory=_empty_schema)


class CapabilityTelemetry(BaseModel):
    """Telemetry metadata emitted by a capability."""

    emits_progress_events: bool = Field(default=False, alias="emitsProgressEvents")
    metrics: List[str] = Field(default_factory=list)


class CapabilitySecurity(BaseModel):
    """Security hints for agents (e.g., does this require secrets)."""

    requires_secrets: bool = Field(default=False, alias="requiresSecrets")


class CapabilityContracts(BaseModel):
    """Operational guarantees agents can rely on."""

    idempotent: bool = False
    side_effects: str = Field(default="bounded", alias="sideEffects")


class CapabilityManifest(BaseModel):
    """
    Canonical manifest describing a capability in the Python plane.

    Mirrors the structure produced in the Node backend so planners receive
    identical data regardless of which plane reports capabilities.
    """

    id: str
    label: str
    description: str = ""
    version: str = CAPABILITY_VERSION
    plane: CapabilityPlane = CapabilityPlane.PYTHON
    runtime: CapabilityRuntime
    handler: CapabilityHandler
    io: CapabilityIO = Field(default_factory=CapabilityIO)
    parameters: List[CapabilityParameter] = Field(default_factory=list)
    examples: List[Dict[str, Any]] = Field(default_factory=list)
    telemetry: CapabilityTelemetry = Field(default_factory=CapabilityTelemetry)
    security: CapabilitySecurity = Field(default_factory=CapabilitySecurity)
    contracts: CapabilityContracts = Field(default_factory=CapabilityContracts)


def describe_capability_fields() -> Dict[str, Any]:
    """Human-readable description of capability manifest fields."""

    return {
        "id": "Unique string identifier (machine readable).",
        "label": "Human-readable label used in UIs/agents.",
        "description": "Summary of what the capability does.",
        "version": "Semantic version of the manifest.",
        "plane": "Execution plane hint (node/python).",
        "runtime": {
            "kind": "cpu/gpu runtime hint.",
            "timeoutSeconds": "Execution timeout guard.",
            "concurrency": "Max concurrent invocations allowed.",
        },
        "handler": {
            "module": "Path to the module exporting the resolver.",
            "method": "Exported method/function name.",
        },
        "io": {
            "input": "JSON Schema describing accepted payloads.",
            "output": "JSON Schema describing the response.",
        },
        "parameters": "Optional structured parameters list (name/type/description/required).",
        "examples": "Example payloads/responses for planner grounding.",
        "telemetry": "Flags describing progress events or custom metrics.",
        "security": "Whether secrets/scoped credentials are required.",
        "contracts": "Operational guarantees: idempotency, side effects, determinism, etc.",
    }


CAPABILITY_SCHEMA: Dict[str, Any] = {
    "version": CAPABILITY_VERSION,
    "plane": CapabilityPlane.PYTHON.value,
    "runtimeKinds": {
        "cpu": CapabilityRuntimeKind.CPU.value,
        "gpu": CapabilityRuntimeKind.GPU.value,
    },
    "fields": describe_capability_fields(),
}
