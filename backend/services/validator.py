import json
from typing import Dict, Any, List
from difflib import SequenceMatcher


def similarity_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def validate_clauses(
    generated_clauses: Dict[str, str],
    clause_library: Dict[str, Any],
    trade_type: str
) -> Dict[str, Any]:
    """Validate that generated clauses are from approved library."""
    approved_clauses = clause_library.get(trade_type, {})
    results = []
    compliant_count = 0
    total_count = 0

    for clause_key, clause_text in generated_clauses.items():
        if not clause_text:
            continue
        total_count += 1
        approved_options = approved_clauses.get(clause_key, [])

        if not approved_options:
            results.append({
                "clause": clause_key,
                "status": "UNKNOWN",
                "message": f"No approved clauses defined for '{clause_key}' in trade type '{trade_type}'",
                "best_match_score": None,
                "best_match": None,
            })
            continue

        best_score = 0.0
        best_match = None
        for approved in approved_options:
            score = similarity_ratio(clause_text, approved)
            if score > best_score:
                best_score = score
                best_match = approved

        if best_score >= 0.95:
            status = "APPROVED"
            compliant_count += 1
            message = "Clause matches approved library."
        elif best_score >= 0.75:
            status = "NEAR_MATCH"
            compliant_count += 0.5
            message = f"Clause is close to approved wording (similarity: {best_score:.1%}). Review recommended."
        else:
            status = "NON_COMPLIANT"
            message = f"Clause does not match any approved clause (best similarity: {best_score:.1%}). Manual review required."

        results.append({
            "clause": clause_key,
            "status": status,
            "message": message,
            "best_match_score": round(best_score, 4),
            "best_match": best_match,
            "generated_text": clause_text,
        })

    compliance_rate = (compliant_count / total_count * 100) if total_count > 0 else 0

    return {
        "clause_results": results,
        "total_clauses": total_count,
        "compliant_count": int(compliant_count),
        "compliance_rate": round(compliance_rate, 1),
        "overall_status": "PASS" if compliance_rate >= 80 else "REVIEW_REQUIRED",
    }


def validate_required_fields(trade_data: Dict[str, Any], trade_type: str) -> Dict[str, Any]:
    """Validate that all required fields are present for a given trade type."""
    required_fields = {
        "fx_spot": ["counterparty", "currency_pair", "notional_amount", "exchange_rate", "settlement_date", "buyer", "seller"],
        "fx_forward": ["counterparty", "currency_pair", "notional_amount", "forward_rate", "value_date", "tenor"],
        "interest_rate_swap": ["counterparty", "notional_amount", "fixed_rate", "floating_rate_benchmark", "effective_date", "termination_date", "tenor"],
        "equity_trade": ["counterparty", "security_name", "number_of_shares", "price_per_share", "total_consideration", "settlement_date", "buyer", "seller"],
        "bond_trade": ["counterparty", "issuer", "face_value", "coupon_rate", "maturity_date", "settlement_date", "buyer", "seller"],
        "credit_default_swap": ["counterparty", "reference_entity", "notional_amount", "premium_rate", "effective_date", "scheduled_termination_date", "protection_buyer", "protection_seller"],
    }

    required = required_fields.get(trade_type, [])
    missing = [f for f in required if not trade_data.get(f)]
    present = [f for f in required if trade_data.get(f)]

    return {
        "required_fields": required,
        "present_fields": present,
        "missing_fields": missing,
        "completeness_pct": round(len(present) / len(required) * 100, 1) if required else 100,
        "is_complete": len(missing) == 0,
    }