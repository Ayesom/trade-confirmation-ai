from fastapi import APIRouter
from ..services import metrics as metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/dashboard")
async def get_dashboard():
    return metrics_service.compute_aggregates()


@router.get("/events")
async def get_events():
    data = metrics_service.load_metrics()
    return data
