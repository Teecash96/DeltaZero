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
    assert "proof" in schema["properties"]


def test_risk_envelope_contains_recomputable_proof() -> None:
    first = TestClient(create_app()).post("/risk-engine/analyze", json=PAYLOAD).json()
    second = TestClient(create_app()).post("/risk-engine/analyze", json=PAYLOAD).json()

    proof = first["risk_envelope"]["proof"]
    assert proof["algorithm"] == "sha256"
    assert proof["canonicalization"] == "json_sort_keys_compact_utf8"
    assert len(proof["input_hash"]) == 64
    assert len(proof["output_hash"]) == 64
    assert proof == second["risk_envelope"]["proof"]


def test_risk_envelope_proof_verification_detects_tampering() -> None:
    client = TestClient(create_app())
    response = client.post("/risk-engine/analyze", json=PAYLOAD)
    body = response.json()

    valid = client.post(
        "/risk-envelope/verify",
        json={"request": PAYLOAD, "envelope": body["risk_envelope"]},
    )
    assert valid.status_code == 200
    assert valid.json()["valid"] is True
    assert valid.json()["input_hash_matches"] is True
    assert valid.json()["output_hash_matches"] is True
    assert valid.json()["analysis_id_matches"] is True

    tampered_envelope = body["risk_envelope"]
    tampered_envelope["decision"]["risk_zone"] = "critical"
    tampered = client.post(
        "/risk-envelope/verify",
        json={"request": PAYLOAD, "envelope": tampered_envelope},
    )
    assert tampered.status_code == 200
    assert tampered.json()["valid"] is False
    assert tampered.json()["input_hash_matches"] is True
    assert tampered.json()["output_hash_matches"] is False

    changed_request = {**PAYLOAD, "capital_usd": 5001}
    request_tampered = client.post(
        "/risk-envelope/verify",
        json={"request": changed_request, "envelope": body["risk_envelope"]},
    )
    assert request_tampered.status_code == 200
    assert request_tampered.json()["valid"] is False
    assert request_tampered.json()["input_hash_matches"] is False
    assert request_tampered.json()["analysis_id_matches"] is False


def test_risk_engine_can_include_grounded_narrative(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = TestClient(create_app()).post(
        "/risk-engine/analyze",
        json={**PAYLOAD, "include_ai_explanation": True},
    )
    assert response.status_code == 200
    explanation = response.json()["narrative_explanation"]
    assert explanation["source"] == "deterministic_fallback"
    assert explanation["analysis_id"] == response.json()["risk_envelope"]["analysis_id"]
    assert explanation["time_horizon_hours"] is None
