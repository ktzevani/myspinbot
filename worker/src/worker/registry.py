from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

from .schemas import (
    CapabilityContracts,
    CapabilityHandler,
    CapabilityIO,
    CapabilityManifest,
    CapabilityParameter,
    CapabilityPlane,
    CapabilityRuntime,
    CapabilityRuntimeKind,
    CapabilitySecurity,
    CapabilityTelemetry,
)


class CapabilityRegistry:
    """Simple in-memory registry mirroring the Node backend helpers."""

    def __init__(self) -> None:
        self._items: Dict[str, CapabilityManifest] = {}

    def register(self, manifest: CapabilityManifest) -> CapabilityManifest:
        """Register or replace a capability manifest."""
        if not manifest.id:
            raise ValueError("capability manifest requires an id")
        self._items[manifest.id] = manifest
        return manifest

    def bulk_register(self, manifests: Iterable[CapabilityManifest]) -> None:
        """Register multiple manifests at once."""
        for manifest in manifests:
            self.register(manifest)

    def list(self) -> List[CapabilityManifest]:
        """Return a copy of all registered manifests."""
        return list(self._items.values())

    def get(self, capability_id: str) -> Optional[CapabilityManifest]:
        """Retrieve a single manifest by id."""
        return self._items.get(capability_id)

    def clear(self) -> None:
        """Remove all registered capabilities (useful in tests)."""
        self._items.clear()

    def manifest_payload(self) -> Dict[str, object]:
        """Return a serializable manifest payload for publication."""
        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "plane": CapabilityPlane.PYTHON.value,
            "capabilities": [
                item.model_dump(mode="json", by_alias=True, exclude_none=True)
                for item in self.list()
            ],
        }


# Global registry instance; populate via register() in follow-up steps.
capability_registry = CapabilityRegistry()


PYTHON_CAPABILITIES: List[CapabilityManifest] = [
    CapabilityManifest(
        id="python.train_lora",
        label="Train LoRA",
        description="Fine-tunes a Stable Diffusion LoRA using uploaded identity/style datasets.",
        runtime=CapabilityRuntime(
            kind=CapabilityRuntimeKind.GPU, timeoutSeconds=1800, concurrency=1
        ),
        handler=CapabilityHandler(module="worker.tasks", method="train_lora"),
        io=CapabilityIO(
            input={
                "type": "object",
                "required": ["profileId", "dataset"],
                "properties": {
                    "profileId": {"type": "string"},
                    "dataset": {
                        "type": "object",
                        "properties": {
                            "images": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "description": "MinIO object key",
                                },
                                "minItems": 10,
                            },
                            "resolution": {"type": "integer", "minimum": 256},
                        },
                    },
                    "hyperparameters": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "Optional training overrides (steps, lr, scheduler).",
                    },
                },
            },
            output={
                "type": "object",
                "properties": {
                    "artifact": {
                        "type": "object",
                        "properties": {
                            "bucket": {"type": "string"},
                            "key": {"type": "string"},
                            "sizeBytes": {"type": "number"},
                        },
                    }
                },
            },
        ),
        parameters=[
            CapabilityParameter(
                name="maxSteps",
                type="integer",
                description="Override maximum training steps.",
                default=800,
            ),
            CapabilityParameter(
                name="scheduler",
                type="string",
                description="Training scheduler identifier.",
                enum=["cosine", "constant", "linear"],
                default="cosine",
            ),
        ],
        telemetry=CapabilityTelemetry(
            emitsProgressEvents=True,
            metrics=["worker_job_duration_seconds", "minio_upload_bytes"],
        ),
        security=CapabilitySecurity(requiresSecrets=False),
        contracts=CapabilityContracts(idempotent=False, sideEffects="model-write"),
    ),
    CapabilityManifest(
        id="python.train_voice",
        label="Train Voice",
        description="Creates a few-shot TTS voice profile from uploaded audio samples.",
        runtime=CapabilityRuntime(
            kind=CapabilityRuntimeKind.GPU, timeoutSeconds=2400, concurrency=1
        ),
        handler=CapabilityHandler(module="worker.tasks", method="train_voice"),
        io=CapabilityIO(
            input={
                "type": "object",
                "required": ["profileId", "audioSamples"],
                "properties": {
                    "profileId": {"type": "string"},
                    "audioSamples": {
                        "type": "array",
                        "items": {"type": "string", "description": "MinIO object key"},
                        "minItems": 1,
                    },
                    "language": {"type": "string"},
                },
            },
            output={
                "type": "object",
                "properties": {
                    "artifact": {
                        "type": "object",
                        "properties": {
                            "bucket": {"type": "string"},
                            "key": {"type": "string"},
                            "format": {"type": "string"},
                        },
                    }
                },
            },
        ),
        parameters=[
            CapabilityParameter(
                name="speakerAugmentation",
                type="boolean",
                description="Whether to synthesize support utterances for low-data profiles.",
                default=False,
            ),
            CapabilityParameter(
                name="samplingRate",
                type="integer",
                description="Target sampling rate for the model.",
                default=22050,
            ),
        ],
        telemetry=CapabilityTelemetry(
            emitsProgressEvents=True,
            metrics=["worker_job_duration_seconds"],
        ),
        security=CapabilitySecurity(requiresSecrets=False),
        contracts=CapabilityContracts(idempotent=False, sideEffects="model-write"),
    ),
    CapabilityManifest(
        id="python.render_video",
        label="Render Video",
        description="Converts stage prompts + voice tracks into short avatar clips using ComfyUI + lip sync.",
        runtime=CapabilityRuntime(
            kind=CapabilityRuntimeKind.GPU, timeoutSeconds=900, concurrency=1
        ),
        handler=CapabilityHandler(module="worker.tasks", method="render_video"),
        io=CapabilityIO(
            input={
                "type": "object",
                "required": ["stagePrompt", "voiceArtifact"],
                "properties": {
                    "stagePrompt": {"type": "string"},
                    "voiceArtifact": {
                        "type": "object",
                        "properties": {
                            "bucket": {"type": "string"},
                            "key": {"type": "string"},
                        },
                    },
                    "loraArtifact": {
                        "type": "object",
                        "properties": {
                            "bucket": {"type": "string"},
                            "key": {"type": "string"},
                        },
                    },
                    "durationSeconds": {"type": "number", "minimum": 1, "maximum": 60},
                },
            },
            output={
                "type": "object",
                "properties": {
                    "video": {
                        "type": "object",
                        "properties": {
                            "bucket": {"type": "string"},
                            "key": {"type": "string"},
                            "durationSeconds": {"type": "number"},
                        },
                    }
                },
            },
        ),
        parameters=[
            CapabilityParameter(
                name="resolution",
                type="string",
                description="Output resolution preset.",
                enum=["576p", "720p", "1080p"],
                default="720p",
            ),
            CapabilityParameter(
                name="generator",
                type="string",
                description="Pipeline choice (svd_wav2lip | sadtalker).",
                enum=["svd_wav2lip", "sadtalker"],
                default="svd_wav2lip",
            ),
        ],
        telemetry=CapabilityTelemetry(
            emitsProgressEvents=True,
            metrics=["worker_job_duration_seconds"],
        ),
        security=CapabilitySecurity(requiresSecrets=False),
        contracts=CapabilityContracts(idempotent=False, sideEffects="artifact-write"),
    ),
    CapabilityManifest(
        id="python.get_capabilities",
        label="Get Worker Capabilities",
        description="Returns the current Python-plane capability manifest for planner agents.",
        runtime=CapabilityRuntime(
            kind=CapabilityRuntimeKind.GPU, timeoutSeconds=60, concurrency=2
        ),
        handler=CapabilityHandler(module="worker.tasks", method="get_capabilities"),
        io=CapabilityIO(
            input={
                "type": "object",
                "properties": {
                    "includeSchema": {
                        "type": "boolean",
                        "description": "If true, include schema metadata alongside capabilities.",
                    }
                },
            },
            output={
                "type": "object",
                "properties": {
                    "plane": {"type": "string"},
                    "generatedAt": {"type": "string", "format": "date-time"},
                    "capabilities": {"type": "array", "items": {"type": "object"}},
                },
            },
        ),
        telemetry=CapabilityTelemetry(
            emitsProgressEvents=True,
            metrics=["worker_job_duration_seconds"],
        ),
        security=CapabilitySecurity(requiresSecrets=False),
        contracts=CapabilityContracts(idempotent=True, sideEffects="read-only"),
    ),
]


capability_registry.bulk_register(PYTHON_CAPABILITIES)
