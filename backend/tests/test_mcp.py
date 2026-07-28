"""MCP transport, discovery, and payment-boundary tests."""

import base64
import json

from fastapi.testclient import TestClient

from app.main import create_app, load_mcp_payment_settings
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


def test_every_unpaid_mcp_operation_returns_standard_x402_challenge() -> None:
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

    for response in (initialized, tools, resources):
        assert response.status_code == 402
        assert "PAYMENT-REQUIRED" in response.headers
        challenge = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
        assert challenge["x402Version"] == 2
        assert challenge["resource"]["url"].endswith("/mcp")


def test_unpaid_json_only_mcp_client_receives_402_not_406() -> None:
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

    assert response.status_code == 402
    assert response.headers["content-type"].startswith("application/json")
    assert "PAYMENT-REQUIRED" in response.headers


def test_free_mcp_accepts_generic_accept_header_and_returns_jsonrpc() -> None:
    """Temporary free mode remains compatible with OKX's replay client."""
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
    with TestClient(create_app()) as client:
        response = client.post(
            "/mcp",
            headers={"Accept": "*/*", "Content-Type": "application/json"},
            json=call,
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["jsonrpc"] == "2.0"
    assert payload["id"] == 3
    assert payload["result"]["structuredContent"]["pass_scope"] == (
        "one_strategy_analysis"
    )


def test_registered_mcp_payment_gate_stays_enabled_when_rest_is_free(
    monkeypatch,
) -> None:
    """Free REST previews must not disable the OKX marketplace 402 boundary."""
    monkeypatch.setenv("DELTAZERO_ACCESS_MODE", "free")
    for name in (
        "PAYMENT_RECEIVER",
        "PAYMENT_PRICE_USDT",
        "PAYMENT_NETWORK",
        "OKX_API_KEY",
        "OKX_SECRET_KEY",
        "OKX_PASSPHRASE",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = load_mcp_payment_settings()

    assert settings is not None
    assert settings.price_usdt == "1"
    app = create_app(payment_settings=None, mcp_payment_settings=settings)
    with TestClient(app) as client:
        get_probe = client.get("/mcp")
        post_probe = client.post(
            "/mcp",
            headers={"Accept": "*/*", "Content-Type": "application/json"},
            json=_message("tools/list"),
        )

    for response in (get_probe, post_probe):
        assert response.status_code == 402
        assert "PAYMENT-REQUIRED" in response.headers


def test_marketplace_mcp_price_defaults_to_registered_one_usdt(monkeypatch) -> None:
    """A stale REST price cannot change the immutable marketplace service price."""

    monkeypatch.setenv("PAYMENT_RECEIVER", "0x" + "1" * 40)
    monkeypatch.setenv("PAYMENT_PRICE_USDT", "0.5")
    monkeypatch.setenv("PAYMENT_NETWORK", "eip155:196")
    monkeypatch.delenv("MCP_PAYMENT_PRICE_USDT", raising=False)
    for name in ("OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"):
        monkeypatch.delenv(name, raising=False)

    settings = load_mcp_payment_settings()

    assert settings is not None
    assert settings.price_usdt == "1"


def test_market_context_tool_is_payment_gated_on_registered_mcp_endpoint() -> None:
    call = _tool_call(
        "get_hyperliquid_market_context",
        {"asset": "NOT_A_MARKET", "lookback_hours": 24},
    )
    with TestClient(create_app(payment_settings=SETTINGS)) as client:
        response = client.post("/mcp", headers=HEADERS, json=call)

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers


def test_strategy_memory_tool_is_payment_gated_on_registered_mcp_endpoint() -> None:
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

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers


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

        # Discovery is also protected on the marketplace endpoint so the OKX
        # standard validator always receives a challenge for unpaid calls.
        initialize = _message(
            "initialize",
            params={
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1"},
            },
        )
        init_response = client.post("/mcp", headers=HEADERS, json=initialize)
        assert init_response.status_code == 402
        assert "PAYMENT-REQUIRED" in init_response.headers

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
