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
    "metrics",
    "recommendation",
    "risk_notes",
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


def test_audit_metrics_computed(client: TestClient) -> None:
    data = client.post("/strategy/audit", json=AUDIT_PAYLOAD).json()
    metrics = data["metrics"]
    assert metrics["hedge_ratio"] == pytest.approx(0.7895, rel=1e-3)
    assert metrics["safety_buffer_score"] == 80.0


def test_audit_actions(client: TestClient) -> None:
    data = client.post("/strategy/audit", json=AUDIT_PAYLOAD).json()
    assert isinstance(data["actions"], list)
    assert len(data["actions"]) >= 1
    assert data["actions"][0] == data["recommendation"]["action"]
    assert data["recommendation"]["action"] in {
        "OPEN",
        "WAIT",
        "HOLD",
        "REBALANCE",
        "REDUCE",
        "CLOSE",
    }


def test_audit_supports_eth(client: TestClient) -> None:
    payload = {**AUDIT_PAYLOAD, "asset": "ETH"}
    data = client.post("/strategy/audit", json=payload).json()
    assert data["asset"] == "ETH"
