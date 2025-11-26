from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from ...infra.metrics import registry


def get_metrics():
    return (generate_latest(registry), CONTENT_TYPE_LATEST)
