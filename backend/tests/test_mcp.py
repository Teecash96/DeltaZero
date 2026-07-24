"""MCP transport, discovery, and payment-boundary tests."""

import base64
import json

from fastapi.testclient import TestClient

from app.main import create_app
from app.payments import PaymentSettings


HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}
JSON_ONLY_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
}
SETTINGS = PaymentSettings(
    receiver="0x" + "1" * 40,
    price_usdt="1",
    network="eip155:196",
)


def _message(method: str, *, message_id: int = 1, params: dict | None = None) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": message_id,
        "method": method,
        "params": params or {},
    }


def _tool_call(name: str, arguments: dict, *, message_id: int = 3) -> dict:
    return _message(
        "tools/call",
        message_id=message_id,
        params={"name": name, "arguments": arguments},
    )


def test_service_root_advertises_the_mcp_transport_as_a2mcp_endpoint() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.json()["service_type"] == "A2MCP"
    assert response.json()["a2mcp_endpoint"] == (
        "https://deltazero-production.up.railway.app/mcp"
    )


def test_mcp_initialize_and_discovery_are_free() -> None:
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        initialize = _message(
            "initialize",
            params={
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "DeltaZero tests", "version": "1"},
            },
        )
        initialized = client.post("/mcp", headers=HEADERS, json=initialize)
        tools = client.post("/mcp", headers=HEADERS, json=_message("tools/list"))
        resources = client.post("/mcp", headers=HEADERS, json=_message("resources/list"))

    assert initialized.status_code == 200
    assert initialized.json()["result"]["serverInfo"]["name"] == "DeltaZero"
    assert tools.status_code == 200
    names = {tool["name"] for tool in tools.json()["result"]["tools"]}
    assert names == {
        "get_hyperliquid_market_context",
        "build_neutral_strategy",
        "audit_hedge_drift",
        "run_funding_stress",
        "run_monte_carlo",
        "run_complete_risk_engine",
        "evaluate_risk_envelope",
        "explain_risk_recommendation",
        "evaluate_strategy_memory",
    }
    uris = {resource["uri"] for resource in resources.json()["result"]["resources"]}
    assert uris == {
        "deltazero://methodology",
        "deltazero://supported-protocols",
        "deltazero://schemas/risk-envelope-v1",
    }


def test_mcp_accepts_json_only_clients_without_returning_406() -> None:
    initialize = _message(
        "initialize",
        params={
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "OKX replay", "version": "1"},
        },
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=JSON_ONLY_HEADERS, json=initialize)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["jsonrpc"] == "2.0"
    assert response.json()["result"]["serverInfo"]["name"] == "DeltaZero"


def test_free_mcp_tool_is_not_payment_gated() -> None:
    call = _tool_call(
        "get_hyperliquid_market_context",
        {"asset": "NOT_A_MARKET", "lookback_hours": 24},
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=HEADERS, json=call)

    assert response.status_code == 200
    assert "PAYMENT-REQUIRED" not in response.headers


def test_strategy_memory_evaluation_is_free_and_agent_native() -> None:
    call = _tool_call(
        "evaluate_strategy_memory",
        {
            "request": {
                "decisions": [
                    {
                        "decision_id": "memory-1",
                        "asset": "SOL",
                        "recommendation": "REBALANCE",
                        "generated_at": "2026-07-20T10:00:00Z",
                        "outcome_status": "within_tolerance",
                        "observed_at": "2026-07-21T10:00:00Z",
                    }
                ]
            }
        },
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=HEADERS, json=call)

    assert response.status_code == 200
    assert "PAYMENT-REQUIRED" not in response.headers
    assert response.json()["result"]["structuredContent"]["observed_count"] == 1


def test_premium_mcp_tool_returns_x402_challenge() -> None:
    call = _tool_call(
        "run_complete_risk_engine",
        {
            "request": {
                "asset": "SOL",
                "capital_usd": 5000,
                "risk_tolerance": "medium",
                "target_style": "neutral_yield",
                "long_yield_apy": 14,
                "short_funding_apy": 3,
                "fee_drag_apy": 1,
            }
        },
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=HEADERS, json=call)

    assert response.status_code == 402
    challenge = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
    assert challenge["resource"]["url"] == (
        "https://deltazero-production.up.railway.app/mcp"
    )
    assert challenge["accepts"][0]["amount"] == "1000000"
    assert challenge["accepts"][0]["network"] == "eip155:196"


def test_admin_key_can_verify_premium_mcp_tool_without_payment() -> None:
    settings = PaymentSettings(
        receiver=SETTINGS.receiver,
        price_usdt="1",
        network=SETTINGS.network,
        admin_key="test-admin-key",
    )
    call = _tool_call(
        "run_complete_risk_engine",
        {
            "request": {
                "asset": "SOL",
                "capital_usd": 5000,
                "risk_tolerance": "medium",
                "target_style": "neutral_yield",
                "long_yield_apy": 14,
                "short_funding_apy": 3,
                "fee_drag_apy": 1,
                "simulation_count": 100,
                "seed": 42,
            }
        },
    )
    headers = {**HEADERS, "X-DeltaZero-Admin-Key": "test-admin-key"}
    with TestClient(create_app(payment_settings=settings)) as client:
        response = client.post("/mcp", headers=headers, json=call)

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["structuredContent"]["pass_scope"] == "one_strategy_analysis"
    assert set(result["structuredContent"]) >= {
        "strategy_build",
        "hedge_drift_audit",
        "funding_stress_test",
        "monte_carlo_sensitivity",
    }


def test_bare_post_to_mcp_returns_402_not_406() -> None:
    """OKX x402 probe: a bare POST without MCP body must get 402, not 406."""
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        # Bare POST with no body at all
        response = client.post("/mcp")

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers
    challenge = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
    assert challenge["x402Version"] == 2
    assert len(challenge["accepts"]) >= 1


def test_x402_challenge_includes_usdt0_asset_on_xlayer() -> None:
    """The accepts array must include the registered USDT0 token on X Layer."""
    call = _tool_call(
        "build_neutral_strategy",
        {
            "request": {
                "asset": "SOL",
                "capital_usd": 5000,
                "risk_tolerance": "medium",
                "target_style": "neutral_yield",
                "long_yield_apy": 14,
                "short_funding_apy": 3,
                "fee_drag_apy": 1,
            }
        },
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=HEADERS, json=call)

    assert response.status_code == 402
    challenge = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
    accepts = challenge["accepts"]
    assert len(accepts) >= 1
    # X Layer USDT0 contract address
    usdt0_address = "0x779ded0c9e1022225f8e0630b35a9b54be713736"
    for option in accepts:
        assert option["network"] == "eip155:196"
        assert option["asset"] == usdt0_address
        assert option["payTo"] == SETTINGS.receiver


def test_mcp_gate_active_even_in_free_access_mode() -> None:
    """MCP x402 gate is active when mcp_payment_settings is provided, even if REST is free."""
    # Simulate: REST routes are free (payment_settings=None), but MCP has settings
    app = create_app(payment_settings=None, mcp_payment_settings=SETTINGS)
    call = _tool_call(
        "run_complete_risk_engine",
        {
            "request": {
                "asset": "SOL",
                "capital_usd": 5000,
                "risk_tolerance": "medium",
                "target_style": "neutral_yield",
                "long_yield_apy": 14,
                "short_funding_apy": 3,
                "fee_drag_apy": 1,
            }
        },
    )
    with TestClient(app) as client:
        # Premium tool should still get 402
        response = client.post("/mcp", headers=HEADERS, json=call)
        assert response.status_code == 402

        # Free operations still work
        initialize = _message(
            "initialize",
            params={
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1"},
            },
        )
        init_response = client.post("/mcp", headers=HEADERS, json=initialize)
        assert init_response.status_code == 200

        # REST routes remain free (no payment middleware)
        rest_response = client.post(
            "/strategy/build",
            json={
                "asset": "SOL",
                "capital_usd": 5000,
                "risk_tolerance": "medium",
                "target_style": "neutral_yield",
                "long_yield_apy": 14,
                "short_funding_apy": 3,
                "fee_drag_apy": 1,
            },
        )
        assert rest_response.status_code == 200
