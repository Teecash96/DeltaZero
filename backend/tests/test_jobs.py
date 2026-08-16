from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.job_store import get_job_store


BUYER = "0x1111111111111111111111111111111111111111"
PROVIDER = "0x2222222222222222222222222222222222222222"


def _payload() -> dict:
    return {
        "agent_id": "aave-health-sentinel",
        "agent_erc8004_id": "bsc-8004-1042",
        "agent_name": "Aave Health Sentinel",
        "provider_address": PROVIDER,
        "buyer_address": BUYER,
        "agent_endpoint": "https://agent.example.test/mcp",
        "agent_verified": True,
        "agent_status": "ACTIVE",
        "category": "health_factor",
        "objective": "Return the complete deterministic risk envelope for this strategy.",
        "input_data": {
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
        },
        "budget_amount": "5",
        "budget_currency": "USDT",
        "payment_amount": "1",
        "deadline": "2099-01-01T00:00:00+00:00",
        "risk_policy": {
            "safety_buffer_min": 50,
            "decision_confidence_min": 70,
            "data_freshness_max_minutes": 30,
        },
        "expected_schema_hash": "a" * 64,
        "allow_simulation": True,
    }


def test_phase2_simulation_job_verifies_and_completes(monkeypatch):
    monkeypatch.setenv("DELTAZERO_JOB_SIMULATION", "true")
    get_job_store().clear()
    client = TestClient(create_app(payment_settings=None, mcp_payment_settings=None))

    created = client.post("/jobs", json=_payload())
    assert created.status_code == 201
    job = created.json()
    assert job["execution_mode"] == "simulation"
    assert job["payment_amount"] == "1"
    assert job["erc8183"]["transaction_hash"] is None

    executed = client.post("/jobs/execute", json={"job_id": job["id"]})
    assert executed.status_code == 200
    assert executed.json()["payment"]["status"] == "SIMULATED"

    verified = client.post(f"/jobs/{job['id']}/verify")
    assert verified.status_code == 200
    verified_job = verified.json()["job"]
    assert verified_job["proof"]["schema_validated"] is True
    assert verified_job["proof"]["payment_verified"] is True

    completed = client.post(f"/jobs/{job['id']}/complete", json={"human_approved": True})
    assert completed.status_code == 200
    assert completed.json()["job"]["status"] == "COMPLETED"
    assert completed.json()["job"]["risk_guard"]["state"] == "COMPLETE"


def test_phase2_payment_price_is_separate_from_maximum_budget(monkeypatch):
    monkeypatch.setenv("DELTAZERO_JOB_SIMULATION", "true")
    get_job_store().clear()
    client = TestClient(create_app(payment_settings=None, mcp_payment_settings=None))

    created = client.post("/jobs", json=_payload())
    assert created.status_code == 201
    job = created.json()

    wrong_receipt = client.post(
        f"/jobs/{job['id']}/payment",
        json={"status": "SIMULATED", "network": "simulation", "amount": "5", "currency": "USDT"},
    )
    assert wrong_receipt.status_code == 409
    assert "x402 service price" in wrong_receipt.json()["detail"]
