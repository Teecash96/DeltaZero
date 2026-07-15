"""Tests for POST /strategy/audit."""

import pytest
from fastapi.testclient import TestClient

AUDIT_PAYLOAD = {
    "asset": "SOL",
    "long_notional_usd": 3800,
    "short_notional_usd": 3000,
    "collateral_usd": 1200,
    "risk_tolerance": "medium",
    "long_yield_apy": 12,
    "short_funding_apy": 4,
    "fee_drag_apy": 1,
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
}

REQUIRED_METRICS = {
    "hedge_ratio",
    "hedge_drift_pct",
    "net_delta_estimate",
    "estimated_net_carry_apy",
    "carry_efficiency_score",
    "safety_buffer_score",
    "capital_at_risk_proxy",
}


def test_audit_returns_200(client: TestClient) -> None:
    response = client.post("/strategy/audit", json=AUDIT_PAYLOAD)
    assert response.status_code == 200


def test_audit_response_shape(client: TestClient) -> None:
    data = client.post("/strategy/audit", json=AUDIT_PAYLOAD).json()
    assert set(data.keys()) == REQUIRED_TOP_LEVEL
    assert set(data["metrics"].keys()) == REQUIRED_METRICS
    assert data["service"] == "deltazero"
    assert data["asset"] == "SOL"
    assert 0 <= data["decision_confidence"] <= 100


def test_audit_metrics_computed(client: TestClient) -> None:
    data = client.post("/strategy/audit", json=AUDIT_PAYLOAD).json()
    metrics = data["metrics"]
    assert metrics["hedge_ratio"] == pytest.approx(0.7895, rel=1e-3)
    assert metrics["safety_buffer_score"] == 80.0
    assert data["strategy_health"] == "critical"
    assert data["decision_confidence"] >= 40


def test_audit_actions(client: TestClient) -> None:
    data = client.post("/strategy/audit", json=AUDIT_PAYLOAD).json()
    assert isinstance(data["actions"], list)
    assert len(data["actions"]) >= 1
    assert data["actions"][0] == data["recommendation"]["action"]
    assert data["recommendation"]["action"] == "REBALANCE"
    assert "hedge drift" in data["recommendation"]["summary"].lower()
    assert "negative" not in data["recommendation"]["summary"].lower()


def test_audit_healthy_existing_position_holds(client: TestClient) -> None:
    payload = {
        **AUDIT_PAYLOAD,
        "long_notional_usd": 4000,
        "short_notional_usd": 3840,
        "collateral_usd": 1200,
        "long_yield_apy": 12,
        "short_funding_apy": 4,
        "fee_drag_apy": 1,
    }
    data = client.post("/strategy/audit", json=payload).json()
    assert data["strategy_health"] == "healthy"
    assert data["recommendation"]["action"] == "HOLD"
    assert data["decision_confidence"] > 70


def test_audit_severe_existing_position_reduces_or_closes(client: TestClient) -> None:
    payload = {
        **AUDIT_PAYLOAD,
        "long_notional_usd": 5200,
        "short_notional_usd": 2600,
        "collateral_usd": 150,
        "long_yield_apy": 8,
        "short_funding_apy": 7,
        "fee_drag_apy": 2,
    }
    data = client.post("/strategy/audit", json=payload).json()
    assert data["strategy_health"] == "critical"
    assert data["recommendation"]["action"] in {"REDUCE", "CLOSE"}
    assert any(term in data["recommendation"]["summary"].lower() for term in {"reduce", "close"})
    assert data["decision_confidence"] > 70


def test_audit_weak_safety_buffer_reduces(client: TestClient) -> None:
    payload = {
        **AUDIT_PAYLOAD,
        "long_notional_usd": 4000,
        "short_notional_usd": 3880,
        "collateral_usd": 150,
    }
    data = client.post("/strategy/audit", json=payload).json()
    assert data["metrics"]["safety_buffer_score"] < 40
    assert data["recommendation"]["action"] == "REDUCE"
    assert "safety buffer" in data["recommendation"]["summary"].lower()


def test_audit_supports_eth(client: TestClient) -> None:
    payload = {**AUDIT_PAYLOAD, "asset": "ETH"}
    data = client.post("/strategy/audit", json=payload).json()
    assert data["asset"] == "ETH"
