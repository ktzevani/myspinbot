"""Public metrics API: expose only the MetricType enum and registry singleton."""

from ._registry import MetricType, registry, get_or_create_metric

__all__ = ["get_or_create_metric", "MetricType", "registry"]
