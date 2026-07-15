"""Tests for the canonical and legacy stress-test routes."""

import pytest
from fastapi.testclient import TestClient

STRESS_PAYLOAD = {
    "asset": "SOL",
    "long_notional_usd": 3500,
    "short_notional_usd": 3150,
    "collateral_usd": 1500,
    "risk_tolerance": "medium",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
    "scenario": {
        "type": "funding_worsens",
        "magnitude_pct": 4,
    },
}

REQUIRED_TOP_LEVEL = {
    "service",
    "strategy_name",
    "asset",
    "strategy_health",
    "decision_confidence",
    "metrics",
    "recommendation",
    "risk_notes",
    "generated_at",
    "actions",
    "scenario_result",
    "pre_stress_equity_usd",
    "stressed_liabilities_usd",
    "estimated_impairment_loss_usd",
    "estimated_impairment_loss_pct",
    "post_impairment_equity_usd",
    "impairment_breakdown",
}


def test_stress_test_returns_200(client: TestClient) -> None:
    canonical = client.post("/stress-test/run", json=STRESS_PAYLOAD)
    legacy = client.post("/strategy/stress-test", json=STRESS_PAYLOAD)
    assert canonical.status_code == 200
    assert legacy.status_code == 200
    canonical_data = canonical.json()
    legacy_data = legacy.json()
    canonical_data.pop("generated_at")
    legacy_data.pop("generated_at")
    assert canonical_data == legacy_data


def test_stress_test_response_shape(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    assert set(data.keys()) == REQUIRED_TOP_LEVEL
    assert data["service"] == "deltazero"
    assert data["asset"] == "SOL"
    assert 0 <= data["decision_confidence"] <= 100
    assert 0 <= data["estimated_impairment_loss_pct"] <= 100


def test_stress_test_scenario_result(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    result = data["scenario_result"]
    assert result["scenario_type"] == "funding_worsens"
    assert result["magnitude_pct"] == 4
    assert result["stressed_short_funding_apy"] == 7.0
    assert result["health_after_stress"] in {"healthy", "warning", "critical"}
    assert set(result["stressed_metrics"].keys()) == {
        "hedge_ratio",
        "hedge_drift_pct",
        "net_delta_estimate",
        "estimated_net_carry_apy",
        "carry_efficiency_score",
        "safety_buffer_score",
        "capital_at_risk_proxy",
    }
    assert data["metrics"] == result["stressed_metrics"]
    assert data["decision_confidence"] >= 40
    assert 0 <= result["estimated_impairment_loss_pct"] <= 100
    assert result["post_impairment_equity_usd"] >= 0


def test_stress_test_funding_worsens_reduces_carry(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    stressed_carry = data["metrics"]["estimated_net_carry_apy"]
    assert stressed_carry == data["scenario_result"]["stressed_metrics"]["estimated_net_carry_apy"]
    assert stressed_carry < 10.4
    assert data["recommendation"]["action"] in {"HOLD", "REBALANCE", "REDUCE", "CLOSE"}


def test_stress_test_actions(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    assert isinstance(data["actions"], list)
    assert len(data["actions"]) >= 1


def test_stress_test_materially_worsens_recommendation(client: TestClient) -> None:
    base_payload = {
        "asset": "SOL",
        "long_notional_usd": 4000,
        "short_notional_usd": 3840,
        "collateral_usd": 1200,
        "risk_tolerance": "medium",
        "long_yield_apy": 12,
        "short_funding_apy": 4,
        "fee_drag_apy": 1,
    }
    base_action = client.post("/strategy/audit", json=base_payload).json()["recommendation"]["action"]
    stressed_payload = {
        **base_payload,
        "scenario": {
            "type": "funding_worsens",
            "magnitude_pct": 12,
        },
    }
    stressed = client.post("/strategy/stress-test", json=stressed_payload).json()
    assert base_action == "HOLD"
    assert stressed["recommendation"]["action"] in {"WAIT", "REDUCE", "CLOSE"}
    assert stressed["metrics"]["estimated_net_carry_apy"] < 0
    assert "negative" in stressed["recommendation"]["summary"].lower() or "below" in stressed["recommendation"]["summary"].lower()
    assert stressed["decision_confidence"] > 70
    assert 0 <= stressed["estimated_impairment_loss_pct"] <= 100


def test_stress_test_price_drop_scenario(client: TestClient) -> None:
    payload = {
        **STRESS_PAYLOAD,
        "scenario": {"type": "price_drop", "magnitude_pct": 10},
    }
    data = client.post("/strategy/stress-test", json=payload).json()
    result = data["scenario_result"]
    assert result["stressed_long_notional_usd"] == 3150.0
    assert result["stressed_short_notional_usd"] == 2835.0
    assert result["stressed_collateral_usd"] == 1350.0
