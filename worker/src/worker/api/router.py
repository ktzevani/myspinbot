from fastapi import APIRouter, Response
from .endpoints.metrics import get_metrics

router = APIRouter()


@router.get("/health")
async def health():
    """Simple health endpoint."""
    return {"status": "ok"}


@router.get("/metrics")
async def metrics():
    """Expose Prometheus metrics."""
    metrics_data, data_type = get_metrics()
    return Response(metrics_data, media_type=data_type)
