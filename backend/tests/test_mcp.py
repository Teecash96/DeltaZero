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
    }
    uris = {resource["uri"] for resource in resources.json()["result"]["resources"]}
    assert uris == {"deltazero://methodology", "deltazero://supported-protocols"}


def test_free_mcp_tool_is_not_payment_gated() -> None:
    call = _tool_call(
        "get_hyperliquid_market_context",
        {"asset": "NOT_A_MARKET", "lookback_hours": 24},
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=HEADERS, json=call)

    assert response.status_code == 200
    assert "PAYMENT-REQUIRED" not in response.headers


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
    assert challenge["resource"]["url"] == "/mcp"
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
