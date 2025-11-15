from __future__ import annotations

import os
import json
from pathlib import Path
from typing import Dict, Any
from .models.capabilities.plane_manifest_schema import PlaneCapabilityManifest

_cached_configuration = None
_cached_capabilities = None


def get_config() -> Dict[str, Any]:
    """Load worker runtime settings from environment variables."""
    global _cached_configuration
    if _cached_configuration is None:
        _cached_configuration = {
            "REDIS_URL": os.getenv("REDIS_URL", "redis://redis:6379"),
            "MINIO_ENDPOINT": os.getenv("MINIO_ENDPOINT", "http://minio:9000"),
            "MINIO_ACCESS_KEY": os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            "MINIO_SECRET_KEY": os.getenv("MINIO_SECRET_KEY", "minioadmin"),
            "WORKER_CONFIG_ROOT": os.getenv("WORKER_CONFIG_ROOT", "/app/config"),
            "WORKER_GROUP": os.getenv("WORKER_GROUP", "pyworkers"),
            "WORKER_CONSUMER": os.getenv(
                "WORKER_CONSUMER", os.getenv("HOSTNAME", "pyw-1")
            ),
            "WORKER_READ_COUNT": int(os.getenv("WORKER_READ_COUNT", "10")),
            "WORKER_READ_BLOCK_MS": int(os.getenv("WORKER_READ_BLOCK_MS", "2000")),
            "WORKER_HTTP_HOST": os.getenv("WORKER_HTTP_HOST", "0.0.0.0"),
            "WORKER_HTTP_PORT": int(os.getenv("WORKER_HTTP_PORT", "8000")),
            "WORKER_BATCH_SIZE": int(os.getenv("WORKER_BATCH_SIZE", "10")),
            "WORKER_STREAMS": os.getenv(
                "WORKER_STREAMS", "stream:process,stream:info"
            ).split(","),
        }
    return _cached_configuration


def get_capabilities() -> PlaneCapabilityManifest:
    global _cached_capabilities
    if _cached_capabilities is None:
        app_config = get_config()
        _cached_capabilities = PlaneCapabilityManifest.model_validate(
            json.loads(
                Path(app_config["WORKER_CONFIG_ROOT"] + "/capabilities.json").read_text(
                    encoding="utf-8"
                )
            )
        )
    return _cached_capabilities
