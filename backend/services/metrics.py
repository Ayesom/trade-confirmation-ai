import json
import os
from datetime import datetime
from typing import Dict, Any, List
from pathlib import Path

METRICS_FILE = os.path.join(os.path.dirname(__file__), "../data/metrics_log.json")


def load_metrics() -> Dict[str, Any]:
    if not os.path.exists(METRICS_FILE):
        return {"events": [], "aggregates": {}}
    with open(METRICS_FILE, "r") as f:
        return json.load(f)


def save_metrics(data: Dict[str, Any]):
    Path(METRICS_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(METRICS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def log_search_event(query: str, trade_type: str, top_result_score: float, result_count: int):
    data = load_metrics()
    data["events"].append({
        "type": "search",
        "timestamp": datetime.utcnow().isoformat(),
        "trade_type": trade_type,
        "top_score": top_result_score,
        "result_count": result_count,
        "precision_hit": top_result_score >= 80.0,
    })
    save_metrics(data)


def log_diff_event(trade_type: str, diff_summary: Dict[str, Any]):
    data = load_metrics()
    data["events"].append({
        "type": "diff",
        "timestamp": datetime.utcnow().isoformat(),
        "trade_type": trade_type,
        "total_diffs": diff_summary.get("total", 0),
        "high_risk": diff_summary.get("high_risk", 0),
        "medium_risk": diff_summary.get("medium_risk", 0),
        "low_risk": diff_summary.get("low_risk", 0),
        "overall_risk": diff_summary.get("overall_risk", "LOW"),
    })
    save_metrics(data)


def log_generation_event(trade_type: str, validation: Dict[str, Any], autofill_fields: int, correct_fields: int):
    data = load_metrics()
    autofill_accuracy = (correct_fields / autofill_fields * 100) if autofill_fields > 0 else 0
    data["events"].append({
        "type": "generation",
        "timestamp": datetime.utcnow().isoformat(),
        "trade_type": trade_type,
        "compliance_rate": validation.get("compliance_rate", 0),
        "autofill_accuracy": round(autofill_accuracy, 1),
        "autofill_fields": autofill_fields,
        "correct_fields": correct_fields,
        "validation_status": validation.get("overall_status", "UNKNOWN"),
    })
    save_metrics(data)


def compute_aggregates() -> Dict[str, Any]:
    data = load_metrics()
    events = data.get("events", [])

    search_events = [e for e in events if e["type"] == "search"]
    diff_events = [e for e in events if e["type"] == "diff"]
    gen_events = [e for e in events if e["type"] == "generation"]

    # Precision = fraction of searches where top result score >= 80
    precision = (
        sum(1 for e in search_events if e.get("precision_hit", False)) / len(search_events)
        if search_events else 0.0
    )

    # Clause Alignment F1 approximation from compliance_rate
    if gen_events:
        avg_compliance = sum(e.get("compliance_rate", 0) for e in gen_events) / len(gen_events)
        f1 = avg_compliance / 100
    else:
        f1 = 0.0

    # Autofill accuracy
    autofill_acc = (
        sum(e.get("autofill_accuracy", 0) for e in gen_events) / len(gen_events)
        if gen_events else 0.0
    )

    # Trade type distribution
    trade_type_counts = {}
    for e in events:
        tt = e.get("trade_type", "unknown")
        trade_type_counts[tt] = trade_type_counts.get(tt, 0) + 1

    # Risk distribution from diff events
    risk_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for e in diff_events:
        r = e.get("overall_risk", "LOW")
        risk_counts[r] = risk_counts.get(r, 0) + 1

    # Recent activity (last 10)
    recent = sorted(events, key=lambda x: x.get("timestamp", ""), reverse=True)[:10]

    return {
        "precision": round(precision, 3),
        "clause_alignment_f1": round(f1, 3),
        "autofill_accuracy": round(autofill_acc, 1),
        "total_searches": len(search_events),
        "total_diffs": len(diff_events),
        "total_generations": len(gen_events),
        "total_events": len(events),
        "trade_type_distribution": trade_type_counts,
        "risk_distribution": risk_counts,
        "recent_activity": recent,
        "targets": {
            "precision_target": 0.8,
            "f1_target": 0.85,
            "autofill_target": 95.0,
        },
        "meets_targets": {
            "precision": precision >= 0.8,
            "f1": f1 >= 0.85,
            "autofill": autofill_acc >= 95.0,
        }
    }