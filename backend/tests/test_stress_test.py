"""Tests for POST /strategy/stress-test."""

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
    "metrics",
    "recommendation",
    "risk_notes",
    "actions",
    "scenario_result",
}


def test_stress_test_returns_200(client: TestClient) -> None:
    response = client.post("/strategy/stress-test", json=STRESS_PAYLOAD)
    assert response.status_code == 200


def test_stress_test_response_shape(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    assert set(data.keys()) == REQUIRED_TOP_LEVEL
    assert data["service"] == "deltazero"
    assert data["asset"] == "SOL"


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


def test_stress_test_funding_worsens_reduces_carry(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    base_carry = data["metrics"]["estimated_net_carry_apy"]
    stressed_carry = data["scenario_result"]["stressed_metrics"]["estimated_net_carry_apy"]
    assert stressed_carry < base_carry


def test_stress_test_actions(client: TestClient) -> None:
    data = client.post("/strategy/stress-test", json=STRESS_PAYLOAD).json()
    assert isinstance(data["actions"], list)
    assert len(data["actions"]) >= 1


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
