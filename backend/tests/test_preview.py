"""Tests for the public interactive product preview."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_preview_compares_real_strategy_engine_outputs() -> None:
    response = TestClient(create_app()).post(
        "/preview/compare",
        json={
            "asset": "SOL",
            "capital_usd": 5000,
            "risk_tolerance": "medium",
            "long_yield_apy": 14,
            "short_funding_apy": 3,
            "fee_drag_apy": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "public_preview"
    assert payload["methodology"] == "deltazero_v1"
    assert payload["conservative"]["strategy_name"] != payload["aggressive"]["strategy_name"]
    assert payload["conservative"]["recommended_structure"]["collateral_usd"] > payload["aggressive"]["recommended_structure"]["collateral_usd"]


def test_preview_rejects_invalid_inputs() -> None:
    response = TestClient(create_app()).post("/preview/compare", json={"capital_usd": -1})
    assert response.status_code == 422
