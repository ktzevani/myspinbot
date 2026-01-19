from __future__ import annotations

import os
import json
from pathlib import Path
from copy import deepcopy
from .models.capabilities.plane_manifest_schema import PlaneCapabilityManifest
from .models.worker.config_schema import WorkerConfiguration

_CONFIG_ROOT_DIR = os.getenv("WORKER_HOME", "/opt/app") + "/config"
_cached_configuration = None
_cached_capabilities = None


def _deep_merge(cfga, cfgb):
    result = deepcopy(cfga)
    for key, value in cfgb.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def get_config() -> WorkerConfiguration:
    global _cached_configuration
    if _cached_configuration is None:
        app_config = json.loads(
            Path(_CONFIG_ROOT_DIR + "/config.json").read_text(encoding="utf-8")
        )
        app_config.update(
            {"comfy": {"root_dir": os.getenv("COMFYUI_ROOT_DIR", "/opt/comfyui")}}
        )
        storage_config = {
            "storage": {
                "url": os.getenv("MINIO_ENDPOINT", "http://minio:9000"),
                "use_ssl": os.getenv("MINIO_USE_SLL", "false").lower() == "true",
                "buckets": [
                    entry.strip()
                    for entry in os.getenv("MINIO_BUCKETS", "").split(",")
                    if entry.strip()
                ],
                "access_key": os.getenv("MINIO_ACCESS_KEY", "admin"),
                "secret_key": os.getenv("MINIO_SECRET_KEY", "password"),
            }
        }
        bridge_config = {
            "bridge": json.loads(
                Path(_CONFIG_ROOT_DIR + "/redis.bridge.json").read_text(
                    encoding="utf-8"
                )
            )
        }
        _cached_configuration = WorkerConfiguration.model_validate(
            _deep_merge(_deep_merge(app_config, storage_config), bridge_config),
        )
    return _cached_configuration


def get_capabilities() -> PlaneCapabilityManifest:
    global _cached_capabilities
    if _cached_capabilities is None:
        _cached_capabilities = PlaneCapabilityManifest.model_validate(
            json.loads(
                Path(_CONFIG_ROOT_DIR + "/capabilities.json").read_text(
                    encoding="utf-8"
                )
            )
        )
    return _cached_capabilities
