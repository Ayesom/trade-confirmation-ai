import re
from typing import Dict, Any, List, Tuple
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

_model = None

RISK_RULES = {
    # HIGH risk fields — economic terms that directly affect P&L
    "HIGH": [
        "notional_amount", "exchange_rate", "forward_rate", "fixed_rate",
        "premium_rate", "price_per_share", "number_of_shares", "total_consideration",
        "face_value", "coupon_rate", "yield", "clean_price", "dirty_price",
        "settlement_date", "value_date", "maturity_date", "scheduled_termination_date",
        "effective_date", "trade_date", "currency_pair", "currency",
        "reference_entity", "reference_obligation", "credit_events",
        "settlement_method", "protection_buyer", "protection_seller",
        "fixed_rate_payer", "floating_rate_payer", "buyer", "seller",
    ],
    # MEDIUM risk — legal and structural clauses
    "MEDIUM": [
        "governing_law", "jurisdiction", "floating_rate_benchmark", "tenor",
        "payment_frequency", "day_count", "spread", "ndf", "ndf_fixing",
        "termination", "default", "netting", "regulatory", "accrued_interest",
    ],
    # LOW risk — administrative / descriptive
    "LOW": [
        "counterparty", "version", "isin", "ticker", "bond_name", "issuer",
        "security_name", "description", "id", "trade_type", "trade_type_label",
    ],
}

FIELD_RISK_MAP = {}
for risk_level, fields in RISK_RULES.items():
    for f in fields:
        FIELD_RISK_MAP[f] = risk_level

CLAUSE_FIELDS = [
    "governing_law", "settlement", "netting", "representations", "default",
    "floating_rate", "day_count", "payment", "termination", "regulatory",
    "fees", "credit_events", "settlement_method", "premium", "accrued_interest",
    "ndf_fixing",
]


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def semantic_similarity(text1: str, text2: str) -> float:
    """Compute cosine similarity between two text strings."""
    model = get_model()
    emb1 = model.encode([str(text1)])
    emb2 = model.encode([str(text2)])
    sim = cosine_similarity(emb1, emb2)[0][0]
    return float(round(sim, 4))


def numeric_diff(val1: Any, val2: Any) -> Tuple[bool, float]:
    """Return (is_different, percent_change) for numeric values."""
    try:
        n1, n2 = float(str(val1).replace(",", "")), float(str(val2).replace(",", ""))
        if n1 == 0 and n2 == 0:
            return False, 0.0
        if n1 == 0:
            return True, 100.0
        pct = abs((n2 - n1) / n1) * 100
        return pct > 0.001, round(pct, 2)
    except (ValueError, TypeError):
        return False, 0.0


def classify_value_type(value: Any) -> str:
    """Determine if a value is numeric, date, or text."""
    if value is None:
        return "null"
    val_str = str(value).replace(",", "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", val_str):
        return "date"
    try:
        float(val_str)
        return "numeric"
    except ValueError:
        return "text"


def compare_fields(template: Dict[str, Any], new_trade: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compare flat fields between template and new trade."""
    differences = []
    all_keys = set(list(template.keys()) + list(new_trade.keys()))
    skip_keys = {"clauses", "pages", "paragraphs", "tables", "raw_text", "extracted_fields"}

    for key in all_keys:
        if key in skip_keys:
            continue
        t_val = template.get(key)
        n_val = new_trade.get(key)

        if t_val is None and n_val is None:
            continue

        risk_level = FIELD_RISK_MAP.get(key, "LOW")
        val_type = classify_value_type(t_val or n_val)

        if t_val is None:
            differences.append({
                "field": key,
                "field_label": key.replace("_", " ").title(),
                "template_value": None,
                "new_value": n_val,
                "change_type": "ADDED",
                "risk_level": risk_level,
                "value_type": val_type,
                "pct_change": None,
                "semantic_similarity": None,
                "description": f"Field '{key}' is new in the trade — not present in template.",
            })
            continue

        if n_val is None:
            differences.append({
                "field": key,
                "field_label": key.replace("_", " ").title(),
                "template_value": t_val,
                "new_value": None,
                "change_type": "REMOVED",
                "risk_level": risk_level,
                "value_type": val_type,
                "pct_change": None,
                "semantic_similarity": None,
                "description": f"Field '{key}' present in template but missing in new trade.",
            })
            continue

        if val_type == "numeric":
            is_diff, pct = numeric_diff(t_val, n_val)
            if is_diff:
                differences.append({
                    "field": key,
                    "field_label": key.replace("_", " ").title(),
                    "template_value": t_val,
                    "new_value": n_val,
                    "change_type": "MODIFIED",
                    "risk_level": risk_level,
                    "value_type": "numeric",
                    "pct_change": pct,
                    "semantic_similarity": None,
                    "description": f"Numeric change of {pct:.2f}% in {key.replace('_', ' ')}.",
                })
        elif val_type == "date":
            if str(t_val) != str(n_val):
                differences.append({
                    "field": key,
                    "field_label": key.replace("_", " ").title(),
                    "template_value": t_val,
                    "new_value": n_val,
                    "change_type": "MODIFIED",
                    "risk_level": risk_level,
                    "value_type": "date",
                    "pct_change": None,
                    "semantic_similarity": None,
                    "description": f"Date change in {key.replace('_', ' ')}.",
                })
        else:
            if str(t_val).strip().lower() != str(n_val).strip().lower():
                sim = semantic_similarity(str(t_val), str(n_val))
                differences.append({
                    "field": key,
                    "field_label": key.replace("_", " ").title(),
                    "template_value": t_val,
                    "new_value": n_val,
                    "change_type": "MODIFIED",
                    "risk_level": risk_level,
                    "value_type": "text",
                    "pct_change": None,
                    "semantic_similarity": sim,
                    "description": f"Text change in {key.replace('_', ' ')} (semantic similarity: {sim:.2%}).",
                })

    return differences


def compare_clauses(template_clauses: Dict[str, str], new_clauses: Dict[str, str]) -> List[Dict[str, Any]]:
    """Compare legal clauses with semantic analysis."""
    differences = []
    all_clause_keys = set(list(template_clauses.keys()) + list(new_clauses.keys()))

    for key in all_clause_keys:
        t_clause = template_clauses.get(key)
        n_clause = new_clauses.get(key)
        risk_level = FIELD_RISK_MAP.get(key, "MEDIUM")

        if t_clause is None:
            differences.append({
                "field": f"clause_{key}",
                "field_label": f"Clause: {key.replace('_', ' ').title()}",
                "template_value": None,
                "new_value": n_clause,
                "change_type": "ADDED",
                "risk_level": risk_level,
                "value_type": "clause",
                "pct_change": None,
                "semantic_similarity": None,
                "description": f"New clause '{key}' not in template.",
            })
            continue

        if n_clause is None:
            differences.append({
                "field": f"clause_{key}",
                "field_label": f"Clause: {key.replace('_', ' ').title()}",
                "template_value": t_clause,
                "new_value": None,
                "change_type": "REMOVED",
                "risk_level": risk_level,
                "value_type": "clause",
                "pct_change": None,
                "semantic_similarity": None,
                "description": f"Clause '{key}' present in template but missing in new trade.",
            })
            continue

        if t_clause.strip() != n_clause.strip():
            sim = semantic_similarity(t_clause, n_clause)
            if sim < 0.6 and risk_level == "LOW":
                risk_level = "MEDIUM"
            elif sim < 0.4 and risk_level == "MEDIUM":
                risk_level = "HIGH"

            differences.append({
                "field": f"clause_{key}",
                "field_label": f"Clause: {key.replace('_', ' ').title()}",
                "template_value": t_clause,
                "new_value": n_clause,
                "change_type": "MODIFIED",
                "risk_level": risk_level,
                "value_type": "clause",
                "pct_change": None,
                "semantic_similarity": sim,
                "description": f"Clause wording changed (semantic similarity: {sim:.2%}). {'⚠️ Significant semantic divergence.' if sim < 0.7 else ''}",
            })

    return differences


def run_diff(template: Dict[str, Any], new_trade: Dict[str, Any]) -> Dict[str, Any]:
    """Full diff analysis between template and new trade."""
    field_diffs = compare_fields(template, new_trade)
    clause_diffs = compare_clauses(
        template.get("clauses", {}),
        new_trade.get("clauses", {})
    )
    all_diffs = field_diffs + clause_diffs

    high = [d for d in all_diffs if d["risk_level"] == "HIGH"]
    medium = [d for d in all_diffs if d["risk_level"] == "MEDIUM"]
    low = [d for d in all_diffs if d["risk_level"] == "LOW"]

    risk_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_diffs.sort(key=lambda x: risk_order.get(x["risk_level"], 3))

    return {
        "differences": all_diffs,
        "summary": {
            "total": len(all_diffs),
            "high_risk": len(high),
            "medium_risk": len(medium),
            "low_risk": len(low),
            "field_changes": len(field_diffs),
            "clause_changes": len(clause_diffs),
        },
        "overall_risk": "HIGH" if high else ("MEDIUM" if medium else "LOW"),
    }