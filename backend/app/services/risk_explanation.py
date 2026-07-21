"""LLM explanation layer constrained to verified DeltaZero evidence."""

from __future__ import annotations

import json
import os
import re
from threading import Lock
from typing import Any

import httpx

from app.models.interoperability import RiskEnvelopeV1
from app.models.risk_explanation import RiskExplanation

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_EXPLANATION_MODEL = "gpt-5.6"
_CACHE: dict[str, RiskExplanation] = {}
_CACHE_LOCK = Lock()

SYSTEM_INSTRUCTIONS = """You explain deterministic DeFi risk results to an informed operator.
Use only the supplied evidence. Never recalculate metrics, predict prices, invent market causes, or imply trade execution.
Do not claim an asset rallied, fell, depegged, or changed over time unless that fact is explicitly supplied.
The time_horizon_hours field must be null unless computed_time_to_threshold_hours is present in the evidence.
Copy every facts_used entry exactly from supplied_facts; do not paraphrase those entries.
Explain the recommendation plainly, distinguish observed snapshot facts from scenario estimates, and preserve the read-only human-approval boundary."""


def _facts(envelope: RiskEnvelopeV1) -> list[str]:
    measures = envelope.measures
    return [
        f"Recommendation: {envelope.decision.action}",
        f"Risk zone: {envelope.decision.risk_zone}",
        f"Safety Buffer: {measures.safety_buffer_score:.2f} / 100",
        f"Hedge drift: {measures.hedge_drift_pct:.2f}%",
        f"Estimated net carry: {measures.net_carry_apy:.2f}% APY",
        f"P95 impairment: {measures.p95_impairment_pct:.2f}%",
        f"Capital impairment probability: {measures.probability_capital_impairment_pct:.2f}%",
        f"Decision confidence: {measures.decision_confidence}%",
    ]


def deterministic_explanation(
    envelope: RiskEnvelopeV1,
    *,
    reason: str = "missing_api_key",
    model: str | None = None,
    provider_status_code: int | None = None,
    provider_error_code: str | None = None,
) -> RiskExplanation:
    """Return a truthful explanation when the provider is unavailable or unsafe."""
    m = envelope.measures
    action = envelope.decision.action
    zone = envelope.decision.risk_zone.title()
    explanation = (
        f"DeltaZero recommends {action} because the submitted position has {m.hedge_drift_pct:.2f}% hedge drift, "
        f"a Safety Buffer of {m.safety_buffer_score:.2f}/100, and {m.net_carry_apy:.2f}% estimated net carry. "
        f"Across the seeded stress analysis, P95 impairment is {m.p95_impairment_pct:.2f}%, placing the strategy "
        f"in the {zone} risk zone. The snapshot does not contain enough evidence to attribute the drift to a "
        "specific market move or estimate a time-to-threshold."
    )
    next_step = {
        "OPEN": "Verify current venue funding, liquidity, oracle, and margin rules before opening the position.",
        "HOLD": "Continue monitoring funding, hedge drift, and collateral; run a fresh analysis when inputs change.",
        "WAIT": "Wait for stronger carry or safer collateral conditions, then run a fresh analysis.",
        "REBALANCE": "Review the proposed hedge adjustment and obtain human approval before changing the position.",
        "REDUCE": "Reduce exposure or add collateral only after venue-specific checks and human approval.",
        "CLOSE": "Consider unwinding the weakest leg after checking liquidity, slippage, and venue rules.",
    }[action]
    return RiskExplanation(
        headline=f"{action}: {zone} risk conditions",
        explanation=explanation,
        key_drivers=[
            f"Hedge drift is {m.hedge_drift_pct:.2f}%.",
            f"Safety Buffer is {m.safety_buffer_score:.2f}/100.",
            f"P95 impairment is {m.p95_impairment_pct:.2f}%.",
        ],
        recommended_next_step=next_step,
        time_horizon_hours=None,
        source="deterministic_fallback",
        model=model,
        fallback_reason=reason,
        provider_status_code=provider_status_code,
        provider_error_code=provider_error_code,
        analysis_id=envelope.analysis_id,
        facts_used=_facts(envelope),
        limitations=[
            "No causal price-path history was supplied.",
            "No time-to-threshold velocity was computed.",
            "Decision support only; human approval is required before any action.",
        ],
    )


def _schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "headline": {"type": "string"},
            "explanation": {"type": "string"},
            "key_drivers": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4},
            "recommended_next_step": {"type": "string"},
            "time_horizon_hours": {"type": ["number", "null"]},
            "facts_used": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 10},
            "limitations": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 5},
        },
        "required": [
            "headline", "explanation", "key_drivers", "recommended_next_step",
            "time_horizon_hours", "facts_used", "limitations",
        ],
    }


def _output_text(payload: dict[str, Any]) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise ValueError("OpenAI response did not contain structured output text.")


def _contains_unsupported_time_claim(value: RiskExplanation) -> bool:
    combined = " ".join([value.headline, value.explanation, value.recommended_next_step, *value.key_drivers])
    patterns = [r"\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?)\b", r"\bwithin\s+\d+"]
    return value.time_horizon_hours is not None or any(re.search(pattern, combined, re.I) for pattern in patterns)


def _contains_unsupported_numeric_claim(value: RiskExplanation, envelope: RiskEnvelopeV1) -> bool:
    combined = " ".join([value.headline, value.explanation, value.recommended_next_step, *value.key_drivers])
    combined = re.sub(r"\bP(?:50|95|99)\b", "", combined, flags=re.I)
    claims = [float(item) for item in re.findall(r"(?<![A-Za-z])\d+(?:\.\d+)?", combined)]
    def numeric_evidence(item: Any) -> set[float]:
        if isinstance(item, bool):
            return set()
        if isinstance(item, (int, float)):
            return {float(item)}
        if isinstance(item, dict):
            return set().union(*(numeric_evidence(entry) for entry in item.values()))
        if isinstance(item, list):
            return set().union(*(numeric_evidence(entry) for entry in item))
        return set()

    evidence_values = {100.0, *numeric_evidence(envelope.model_dump(mode="json"))}
    return any(not any(abs(claim - evidence) <= 0.011 for evidence in evidence_values) for claim in claims)


def generate_risk_explanation(envelope: RiskEnvelopeV1) -> RiskExplanation:
    """Generate a structured explanation, failing safely to deterministic copy."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return deterministic_explanation(envelope)

    model = os.getenv("OPENAI_EXPLANATION_MODEL", DEFAULT_EXPLANATION_MODEL).strip() or DEFAULT_EXPLANATION_MODEL
    cache_key = f"{model}:{envelope.analysis_id}"
    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
    if cached is not None:
        return cached

    evidence = {
        "analysis_id": envelope.analysis_id,
        "subject": envelope.subject.model_dump(mode="json"),
        "decision": envelope.decision.model_dump(mode="json"),
        "measures": envelope.measures.model_dump(mode="json"),
        "evidence": envelope.evidence.model_dump(mode="json"),
        "constraints": envelope.constraints,
        "supplied_facts": _facts(envelope),
        "computed_time_to_threshold_hours": None,
    }
    try:
        with httpx.Client(timeout=float(os.getenv("OPENAI_EXPLANATION_TIMEOUT_SECONDS", "15"))) as client:
            response = client.post(
                OPENAI_RESPONSES_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "input": [
                        {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                        {"role": "user", "content": json.dumps(evidence, separators=(",", ":"))},
                    ],
                    "text": {"format": {"type": "json_schema", "name": "deltazero_risk_explanation", "strict": True, "schema": _schema()}},
                    "max_output_tokens": 650,
                },
            )
            response.raise_for_status()
            parsed = json.loads(_output_text(response.json()))
        result = RiskExplanation(
            **parsed,
            source="openai",
            model=model,
            analysis_id=envelope.analysis_id,
        )
        if (
            _contains_unsupported_time_claim(result)
            or _contains_unsupported_numeric_claim(result, envelope)
            or not set(result.facts_used).issubset(set(_facts(envelope)))
        ):
            return deterministic_explanation(
                envelope,
                reason="grounding_validation_failed",
                model=model,
            )
        with _CACHE_LOCK:
            if len(_CACHE) >= 128:
                _CACHE.pop(next(iter(_CACHE)))
            _CACHE[cache_key] = result
        return result
    except httpx.HTTPStatusError as exc:
        try:
            raw_code = exc.response.json().get("error", {}).get("code")
        except (ValueError, TypeError, AttributeError):
            raw_code = None
        error_code = raw_code if isinstance(raw_code, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", raw_code) else None
        return deterministic_explanation(
            envelope,
            reason="provider_error",
            model=model,
            provider_status_code=exc.response.status_code,
            provider_error_code=error_code,
        )
    except httpx.RequestError:
        return deterministic_explanation(envelope, reason="provider_error", model=model)
    except (ValueError, TypeError):
        return deterministic_explanation(
            envelope,
            reason="invalid_structured_output",
            model=model,
        )
