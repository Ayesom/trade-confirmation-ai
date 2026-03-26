import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
import tempfile
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import services.generator as generator
import services.validator as validator
import services.exporter as exporter
import services.metrics as metrics

router = APIRouter(prefix="/generate", tags=["generate"])

CLAUSE_LIBRARY_PATH = os.path.join(os.path.dirname(__file__), "../data/clause_library/clauses.json")
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "../data/outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)


class GenerateRequest(BaseModel):
    trade_data: Dict[str, Any]
    template: Dict[str, Any]


class ExportRequest(BaseModel):
    confirmation: Dict[str, Any]
    format: str = "pdf"


@router.post("/confirmation")
async def generate_confirmation(request: GenerateRequest):
    try:
        with open(CLAUSE_LIBRARY_PATH, "r") as f:
            clause_library = json.load(f)

        trade_type = request.trade_data.get("trade_type", request.template.get("trade_type", ""))
        field_validation = validator.validate_required_fields(request.trade_data, trade_type)

        result = generator.generate_confirmation(
            request.trade_data,
            request.template,
            clause_library
        )

        confirmation = result["confirmation"]
        all_fields = [k for k, v in confirmation.items() if k not in {"clauses", "generated_narrative", "compliance_notes"} and v is not None]
        metrics.log_generation_event(
            trade_type,
            result["validation"],
            len(all_fields),
            int(len(all_fields) * result["validation"].get("compliance_rate", 90) / 100),
        )

        return {
            **result,
            "field_validation": field_validation,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export")
async def export_confirmation(request: ExportRequest):
    try:
        fmt = request.format.lower()
        conf_id = request.confirmation.get("id", "confirmation").replace("/", "-")
        filename = f"{conf_id}_{fmt}"

        if fmt == "pdf":
            output_path = os.path.join(OUTPUTS_DIR, f"{filename}.pdf")
            exporter.export_to_pdf(request.confirmation, output_path)
            return FileResponse(
                output_path,
                media_type="application/pdf",
                filename=f"{conf_id}.pdf"
            )
        elif fmt == "docx":
            output_path = os.path.join(OUTPUTS_DIR, f"{filename}.docx")
            exporter.export_to_docx(request.confirmation, output_path)
            return FileResponse(
                output_path,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=f"{conf_id}.docx"
            )
        else:
            raise HTTPException(status_code=400, detail="Format must be 'pdf' or 'docx'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-fields")
async def validate_fields(trade_data: Dict[str, Any], trade_type: str):
    result = validator.validate_required_fields(trade_data, trade_type)
    return result