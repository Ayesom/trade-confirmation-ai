import os
import json
import anthropic
from typing import Dict, Any
from .validator import validate_clauses

_client = None

def get_client():
    """Get or initialize the Anthropic client lazily."""
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are a senior trade confirmation specialist at a major investment bank with deep expertise in financial markets documentation. 
Your task is to generate a complete, professionally worded trade confirmation document.

CRITICAL RULES:
1. Only use clauses from the provided approved clause library — never invent new legal language
2. All economic terms (rates, amounts, dates) must exactly match the trade data provided
3. Output must be valid JSON matching the specified schema exactly
4. Be precise with numbers — do not round or approximate
5. Ensure all dates are in YYYY-MM-DD format
6. For clauses, select the most appropriate approved clause for each field
"""


def build_generation_prompt(trade_data: Dict[str, Any], template: Dict[str, Any], clause_library: Dict[str, Any]) -> str:
    trade_type = trade_data.get("trade_type", template.get("trade_type", ""))
    available_clauses = clause_library.get(trade_type, {})

    return f"""Generate a complete trade confirmation for the following trade:

TRADE DATA:
{json.dumps(trade_data, indent=2)}

BASE TEMPLATE (use as structural reference):
{json.dumps(template, indent=2)}

APPROVED CLAUSES FOR {trade_type.upper().replace('_', ' ')}:
{json.dumps(available_clauses, indent=2)}

Generate a complete trade confirmation JSON document. Select the most appropriate clause from the approved list for each clause field. 
Return ONLY a valid JSON object with this exact structure:
{{
  "id": "auto-generated ID like TPL-FXS-003",
  "trade_type": "{trade_type}",
  "trade_type_label": "Human readable label",
  "counterparty": "counterparty name",
  "jurisdiction": "jurisdiction",
  ... all relevant trade fields ...,
  "clauses": {{
    "governing_law": "selected approved clause",
    "settlement": "selected approved clause",
    ... other relevant clauses ...
  }},
  "generated_narrative": "A 3-4 sentence professional summary of this trade confirmation",
  "compliance_notes": "Any compliance considerations for this trade"
}}

Return ONLY the JSON object, no markdown, no explanation."""


def generate_confirmation(
    trade_data: Dict[str, Any],
    template: Dict[str, Any],
    clause_library: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate a pre-populated trade confirmation using Claude."""
    prompt = build_generation_prompt(trade_data, template, clause_library)

    message = get_client().messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    raw_text = message.content[0].text.strip()

    # Strip markdown fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    generated = json.loads(raw_text)

    # Validate clauses against approved library
    validation_result = validate_clauses(
        generated.get("clauses", {}),
        clause_library,
        generated.get("trade_type", "")
    )

    return {
        "confirmation": generated,
        "validation": validation_result,
        "model_used": "claude-sonnet-4-20250514",
        "tokens_used": message.usage.input_tokens + message.usage.output_tokens,
    }


def generate_narrative(confirmation: Dict[str, Any]) -> str:
    """Generate a plain-English narrative for the confirmation."""
    prompt = f"""Write a professional 4-5 sentence plain English summary of this trade confirmation for an operations team member. 
Include the key economic terms, parties, and any notable risk considerations.

Trade Confirmation:
{json.dumps(confirmation, indent=2)}

Write ONLY the narrative paragraph, no headers or bullet points."""

    message = get_client().messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()