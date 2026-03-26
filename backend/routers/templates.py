import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional
import services.embeddings as embeddings
import services.parser as parser
import services.metrics as metrics

router = APIRouter(prefix="/templates", tags=["templates"])

CLAUSE_LIBRARY_PATH = os.path.join(os.path.dirname(__file__), "../data/clause_library/clauses.json")


@router.get("/seed")
async def seed():
    result = embeddings.seed_templates()
    return result


@router.get("/all")
async def get_all():
    templates = embeddings.get_all_templates()
    return {"templates": templates, "count": len(templates)}


@router.get("/search")
async def search_templates(
    query: str = Query(..., description="Natural language query describing the trade"),
    trade_type: Optional[str] = Query(None, description="Filter by trade type"),
    top_k: int = Query(3, ge=1, le=10),
):
    try:
        results = embeddings.search_templates(query, trade_type, top_k)
        top_score = results[0]["similarity_score"] if results else 0
        metrics.log_search_event(query, trade_type or "any", top_score, len(results))
        return {"results": results, "query": query, "trade_type": trade_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search-by-file")
async def search_by_file(
    file: UploadFile = File(...),
    top_k: int = Form(3),
):
    if not file.filename.lower().endswith((".pdf", ".docx", ".doc")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    suffix = ".pdf" if file.filename.lower().endswith(".pdf") else ".docx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parsed = parser.parse_document(tmp_path)
        fields = parsed.get("extracted_fields", {})
        trade_type = fields.get("trade_type")

        query_parts = [parsed["raw_text"][:1000]]
        if trade_type:
            query_parts.insert(0, f"Trade Type: {trade_type.replace('_', ' ')}")

        results = embeddings.search_templates(" ".join(query_parts), trade_type, top_k)
        top_score = results[0]["similarity_score"] if results else 0
        metrics.log_search_event("file_upload", trade_type or "unknown", top_score, len(results))

        return {
            "results": results,
            "extracted_fields": fields,
            "detected_trade_type": trade_type,
            "filename": file.filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@router.post("/add")
async def add_template(template: dict):
    try:
        result = embeddings.add_template(template)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trade-types")
async def get_trade_types():
    return {
        "trade_types": [
            {"value": "fx_spot", "label": "FX Spot"},
            {"value": "fx_forward", "label": "FX Forward"},
            {"value": "interest_rate_swap", "label": "Interest Rate Swap"},
            {"value": "equity_trade", "label": "Equity Trade"},
            {"value": "bond_trade", "label": "Bond Trade"},
            {"value": "credit_default_swap", "label": "Credit Default Swap"},
        ]
    }


@router.get("/clause-library")
async def get_clause_library(trade_type: Optional[str] = None):
    with open(CLAUSE_LIBRARY_PATH, "r") as f:
        library = json.load(f)
    if trade_type:
        return {trade_type: library.get(trade_type, {})}
    return library