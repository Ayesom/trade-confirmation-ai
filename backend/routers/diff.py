import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import services.diff_engine as diff_engine
import services.metrics as metrics

router = APIRouter(prefix="/diff", tags=["diff"])


class DiffRequest(BaseModel):
    template: Dict[str, Any]
    new_trade: Dict[str, Any]


@router.post("/compare")
async def compare(request: DiffRequest):
    try:
        result = diff_engine.run_diff(request.template, request.new_trade)
        metrics.log_diff_event(
            request.template.get("trade_type", "unknown"),
            result["summary"]
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare-clauses")
async def compare_clauses(
    template_clauses: Dict[str, str],
    new_clauses: Dict[str, str],
):
    try:
        diffs = diff_engine.compare_clauses(template_clauses, new_clauses)
        return {"differences": diffs, "count": len(diffs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))