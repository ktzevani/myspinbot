# worker/src/utils.py
from __future__ import annotations

import asyncio
import json
import signal
from typing import Any, Dict, Tuple

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram


# Prometheus metrics
def get_metrics() -> Tuple[CollectorRegistry, Dict[str, Any]]:
    """Initialize Prometheus metrics and return registry + metric dict."""
    registry = CollectorRegistry()

    metrics = {
        "worker_active_tasks": Gauge(
            "worker_active_tasks",
            "Number of tasks currently executing",
            registry=registry,
        ),
        "worker_jobs_total": Counter(
            "worker_jobs_total",
            "Total jobs seen by the worker",
            ["type"],
            registry=registry,
        ),
        "worker_job_duration_seconds": Histogram(
            "worker_job_duration_seconds",
            "Job execution time in seconds",
            ["type"],
            registry=registry,
            buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, float("inf")),
        ),
        "worker_loop_iterations_total": Counter(
            "worker_loop_iterations_total",
            "Number of polling loop iterations",
            registry=registry,
        ),
        "worker_poll_batch_size": Histogram(
            "worker_poll_batch_size",
            "Number of messages fetched per poll",
            registry=registry,
            buckets=(0, 1, 2, 5, 10, 20, 50, 100, float("inf")),
        ),
    }

    return registry, metrics


# -- Utilities & Helpers


def setup_graceful_shutdown(stop_event: asyncio.Event):
    """Attach SIGINT/SIGTERM handlers to set an asyncio.Event."""
    loop = asyncio.get_running_loop()

    def _signal_handler(*_: Any):
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass


def json_dumps_safe(obj: Any) -> str:
    """Serialize to JSON safely, falling back to string conversion."""
    try:
        return json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        return json.dumps(str(obj))
