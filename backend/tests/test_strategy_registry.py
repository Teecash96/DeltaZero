"""Strategy Registry contract and deterministic feedback tests."""

from fastapi.testclient import TestClient


DECISIONS = [
    {
        "decision_id": "decision-1",
        "asset": "SOL",
        "recommendation": "REBALANCE",
        "generated_at": "2026-07-20T10:00:00Z",
        "safety_buffer": 58,
        "p95_impairment_pct": 8.4,
        "outcome_status": "exceeded_risk",
        "observed_at": "2026-07-21T10:00:00Z",
        "realized_return_pct": -3.2,
        "max_drawdown_pct": 7.1,
        "final_safety_buffer": 44,
    },
    {
        "decision_id": "decision-2",
        "asset": "SOL",
        "recommendation": "HOLD",
        "generated_at": "2026-07-20T11:00:00Z",
    },
]


def test_registry_evaluation_is_structured_and_deterministic(client: TestClient) -> None:
    first = client.post("/strategy-registry/evaluate", json={"decisions": DECISIONS})
    second = client.post("/strategy-registry/evaluate", json={"decisions": DECISIONS})

    assert first.status_code == 200
    assert first.json() == second.json()
    body = first.json()
    assert body["service"] == "deltazero_strategy_registry"
    assert body["decision_count"] == 2
    assert body["observed_count"] == 1
    assert body["outcome_coverage_pct"] == 50
    assert body["exceeded_risk_count"] == 1
    assert body["average_max_drawdown_pct"] == 7.1
    assert any("exceeded expected risk" in signal for signal in body["refinement_signals"])


def test_registry_rejects_empty_history(client: TestClient) -> None:
    response = client.post("/strategy-registry/evaluate", json={"decisions": []})
    assert response.status_code == 422


def test_registry_route_is_in_openapi(client: TestClient) -> None:
    assert "/strategy-registry/evaluate" in client.get("/openapi.json").json()["paths"]
