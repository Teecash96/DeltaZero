"""Tests for the bundled four-module Risk Engine pass."""

from fastapi.testclient import TestClient

from app.main import create_app


PAYLOAD = {
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
    "stress_magnitude_pct": 4,
    "simulation_count": 100,
    "time_horizon_days": 30,
    "seed": 42,
}


def test_risk_engine_pass_returns_four_coordinated_reports() -> None:
    response = TestClient(create_app()).post("/risk-engine/analyze", json=PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "risk_engine_pass"
    assert body["pass_scope"] == "one_strategy_analysis"
    assert set(body) >= {
        "strategy_build",
        "hedge_drift_audit",
        "funding_stress_test",
        "monte_carlo_sensitivity",
        "risk_envelope",
    }
    envelope = body["risk_envelope"]
    assert envelope["schema_version"] == "1.0.0"
    assert envelope["analysis_id"].startswith("dz_")
    assert envelope["decision"]["human_approval_required"] is True
    assert envelope["compatible_transports"] == ["REST", "MCP", "JSON"]
    structure = body["strategy_build"]["recommended_structure"]
    assert body["hedge_drift_audit"]["metrics"]["hedge_ratio"] == body["strategy_build"]["metrics"]["hedge_ratio"]
    assert body["funding_stress_test"]["pre_stress_equity_usd"] >= 0
    assert body["monte_carlo_sensitivity"]["simulation_count"] == 100
    assert structure["long_notional_usd"] > 0


def test_registered_a2mcp_root_runs_the_same_complete_pass() -> None:
    response = TestClient(create_app()).post("/", json=PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "risk_engine_pass"
    assert body["pass_scope"] == "one_strategy_analysis"
    assert set(body) >= {
        "strategy_build",
        "hedge_drift_audit",
        "funding_stress_test",
        "monte_carlo_sensitivity",
    }


def test_registered_a2mcp_root_accepts_bare_reviewer_probe() -> None:
    response = TestClient(create_app()).post("/")

    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "risk_engine_pass"
    assert body["strategy_build"]["asset"] == "SOL"
    assert body["strategy_build"]["recommended_structure"]["long_notional_usd"] > 0
    assert body["monte_carlo_sensitivity"]["simulation_count"] == 100


def test_risk_engine_pass_is_repeatable_with_seed() -> None:
    client = TestClient(create_app())
    first = client.post("/risk-engine/analyze", json=PAYLOAD).json()
    second = client.post("/risk-engine/analyze", json=PAYLOAD).json()

    assert first["monte_carlo_sensitivity"]["summary"] == second["monte_carlo_sensitivity"]["summary"]
    assert first["monte_carlo_sensitivity"]["sample_paths"] == second["monte_carlo_sensitivity"]["sample_paths"]
    assert first["risk_envelope"] == second["risk_envelope"]


def test_risk_envelope_json_schema_is_public() -> None:
    response = TestClient(create_app()).get("/standards/risk-envelope/v1")
    assert response.status_code == 200
    schema = response.json()
    assert schema["title"] == "RiskEnvelopeV1"
    assert "decision" in schema["properties"]
