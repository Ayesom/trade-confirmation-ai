import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter
import services.metrics as metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/dashboard")
async def get_dashboard():
    return metrics_service.compute_aggregates()


@router.get("/events")
async def get_events():
    data = metrics_service.load_metrics()
    return data