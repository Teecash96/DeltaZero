"""Tests for POST /strategy/build."""

import pytest
from fastapi.testclient import TestClient

BUILD_PAYLOAD = {
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
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
    "recommended_structure",
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


def test_build_returns_200(client: TestClient) -> None:
    response = client.post("/strategy/build", json=BUILD_PAYLOAD)
    assert response.status_code == 200


def test_build_response_shape(client: TestClient) -> None:
    data = client.post("/strategy/build", json=BUILD_PAYLOAD).json()
    assert set(data.keys()) == REQUIRED_TOP_LEVEL
    assert set(data["metrics"].keys()) == REQUIRED_METRICS
    assert data["service"] == "deltazero"
    assert data["asset"] == "SOL"
    assert data["strategy_name"] == "SOL Neutral Yield Carry"


def test_build_recommended_structure(client: TestClient) -> None:
    data = client.post("/strategy/build", json=BUILD_PAYLOAD).json()
    structure = data["recommended_structure"]
    assert structure["long_notional_usd"] == 3800.0
    assert structure["short_notional_usd"] == 3648.0
    assert structure["collateral_usd"] == 1200.0
    assert structure["target_hedge_ratio"] == pytest.approx(0.96, rel=1e-3)


def test_build_metrics_are_near_neutral(client: TestClient) -> None:
    data = client.post("/strategy/build", json=BUILD_PAYLOAD).json()
    metrics = data["metrics"]
    assert metrics["hedge_ratio"] == pytest.approx(0.96, rel=1e-3)
    assert metrics["hedge_drift_pct"] == pytest.approx(4.0, rel=1e-3)
    assert metrics["estimated_net_carry_apy"] == pytest.approx(10.12, rel=1e-3)
    assert metrics["safety_buffer_score"] == pytest.approx(65.79, rel=1e-3)
    assert metrics["capital_at_risk_proxy"] == 152.0
    assert data["strategy_health"] == "healthy"


def test_build_recommendation_action(client: TestClient) -> None:
    data = client.post("/strategy/build", json=BUILD_PAYLOAD).json()
    assert data["recommendation"]["action"] == "OPEN"
    assert isinstance(data["recommendation"]["summary"], str)
    assert "negative" not in data["recommendation"]["summary"].lower()
    assert isinstance(data["risk_notes"], list)


def test_build_negative_carry_waits(client: TestClient) -> None:
    payload = {**BUILD_PAYLOAD, "long_yield_apy": 2, "short_funding_apy": 6}
    data = client.post("/strategy/build", json=payload).json()
    assert data["recommendation"]["action"] == "WAIT"
    assert "negative" in data["recommendation"]["summary"].lower()
    assert data["strategy_health"] == "critical"


def test_build_supports_eth(client: TestClient) -> None:
    payload = {**BUILD_PAYLOAD, "asset": "ETH"}
    data = client.post("/strategy/build", json=payload).json()
    assert data["asset"] == "ETH"
    assert data["strategy_name"] == "ETH Neutral Yield Carry"


def test_build_rejects_unsupported_asset(client: TestClient) -> None:
    payload = {**BUILD_PAYLOAD, "asset": "BTC"}
    response = client.post("/strategy/build", json=payload)
    assert response.status_code == 422
