"""Tests for the bounded natural-language explanation layer."""

import json

from app.models.risk_engine import RiskEnginePassRequest
from app.services.risk_engine import run_risk_engine_pass
from app.services.risk_explanation import generate_risk_explanation


REQUEST = RiskEnginePassRequest(
    asset="SOL",
    capital_usd=5000,
    risk_tolerance="medium",
    target_style="neutral_yield",
    long_yield_apy=14,
    short_funding_apy=3,
    fee_drag_apy=1,
    simulation_count=100,
    seed=42,
)


def test_missing_key_returns_truthful_deterministic_explanation(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    report = run_risk_engine_pass(REQUEST.model_copy(update={"include_ai_explanation": True}))
    explanation = report.narrative_explanation
    assert explanation is not None
    assert explanation.source == "deterministic_fallback"
    assert explanation.fallback_reason == "missing_api_key"
    assert explanation.time_horizon_hours is None
    assert "does not contain enough evidence" in explanation.explanation


def test_llm_structured_output_is_accepted_when_grounded(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    envelope = run_risk_engine_pass(REQUEST).risk_envelope
    facts = [
        f"Recommendation: {envelope.decision.action}",
        f"Risk zone: {envelope.decision.risk_zone}",
        f"Safety Buffer: {envelope.measures.safety_buffer_score:.2f} / 100",
    ]
    output = {
        "headline": f"{envelope.decision.action}: verified risk snapshot",
        "explanation": f"The Safety Buffer is {envelope.measures.safety_buffer_score:.2f}/100 and hedge drift is {envelope.measures.hedge_drift_pct:.2f}%.",
        "key_drivers": [f"P95 impairment is {envelope.measures.p95_impairment_pct:.2f}%."],
        "recommended_next_step": "Review the deterministic recommendation and obtain human approval.",
        "time_horizon_hours": None,
        "facts_used": facts,
        "limitations": ["No causal market history was supplied."],
    }

    class Response:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict:
            return {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(output)}]}]}

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: Response())
    explanation = generate_risk_explanation(envelope)
    assert explanation.source == "openai"
    assert explanation.fallback_reason is None
    assert explanation.model == "gpt-5.6"


def test_unsupported_time_claim_fails_closed(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    envelope = run_risk_engine_pass(REQUEST.model_copy(update={"capital_usd": 5001})).risk_envelope
    output = {
        "headline": "Rebalance soon",
        "explanation": "The Safety Buffer may fall within 6 hours.",
        "key_drivers": [f"Hedge drift is {envelope.measures.hedge_drift_pct:.2f}%."],
        "recommended_next_step": "Review the hedge.",
        "time_horizon_hours": None,
        "facts_used": [f"Recommendation: {envelope.decision.action}"],
        "limitations": ["Snapshot only."],
    }

    class Response:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict:
            return {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(output)}]}]}

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: Response())
    explanation = generate_risk_explanation(envelope)
    assert explanation.source == "deterministic_fallback"
    assert explanation.fallback_reason == "grounding_validation_failed"
    assert explanation.time_horizon_hours is None
