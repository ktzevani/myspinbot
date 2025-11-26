from enum import Enum

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    Summary,
    GC_COLLECTOR,
    PLATFORM_COLLECTOR,
    PROCESS_COLLECTOR,
)
from typing import Any, Dict


class MetricType(Enum):
    """Maps symbolic metric names to the Prometheus metric classes."""

    GAUGE = Gauge
    COUNTER = Counter
    HISTOGRAM = Histogram
    SUMMARY = Summary


metrics_by_name: Dict[str, Any] = {}


def record_collector_metric_names(collector: Any) -> None:
    """Track names emitted by built-in collectors to avoid collisions."""

    describe = getattr(collector, "describe", None)
    if not describe:
        return

    for metric in describe() or []:
        metrics_by_name.setdefault(metric.name, collector)


def build_registry() -> CollectorRegistry:
    """Create a registry configured with Prometheus' default collectors."""

    registry = CollectorRegistry()
    # Register the default process/platform/GC collectors just like collectDefaultMetrics.
    for collector in (PROCESS_COLLECTOR, PLATFORM_COLLECTOR, GC_COLLECTOR):
        registry.register(collector)
        record_collector_metric_names(collector)

    return registry


registry = build_registry()


def get_or_create_metric(
    name: str,
    metric_type: MetricType,
    documentation: str = "",
    **options: Any,
) -> Any:
    """Return an existing metric or create/register a new one on demand."""
    global registry
    existing = metrics_by_name.get(name)
    if existing:
        return existing

    metric_kwargs = dict(options)
    metric_kwargs.setdefault("registry", registry)

    metric = metric_type.value(name, documentation, **metric_kwargs)
    metrics_by_name[name] = metric
    return metric
