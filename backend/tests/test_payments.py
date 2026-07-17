"""Regression tests for DeltaZero's x402 payment boundary."""

from __future__ import annotations

import base64
from dataclasses import replace
import json

from fastapi.testclient import TestClient
import pytest
from x402 import (
    PaymentPayload,
    PaymentRequirements,
    SettleResponse,
    SupportedKind,
    SupportedResponse,
    VerifyResponse,
)
from x402.http import encode_payment_signature_header
from x402.mechanisms.evm.deferred.server import AggrDeferredEvmScheme
from x402.mechanisms.evm.exact.server import ExactEvmScheme
from x402.server import x402ResourceServer

from app.main import create_app
from app.payments import PaymentSettings, create_payment_server, paid_routes


BUILD_PAYLOAD = {
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
}

WALLET_PAYLOAD = {
    "wallet_address": "0x0000000000000000000000000000000000000001",
    "networks": ["hyperliquid"],
    "protocols": ["hyperliquid"],
    "stress_profile": "standard",
}

MONTE_CARLO_PAYLOAD = {
    **BUILD_PAYLOAD,
    "long_notional_usd": 3500,
    "short_notional_usd": 3360,
    "collateral_usd": 1500,
    "simulation_count": 100,
}

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

STRESS_PAYLOAD = {
    **AUDIT_PAYLOAD,
    "scenario": {
        "type": "funding_worsens",
        "magnitude_pct": 4,
    },
}

PROTECTED_ROUTES = [
    ("/", BUILD_PAYLOAD),
    ("/risk-engine/analyze", BUILD_PAYLOAD),
    ("/strategy/build", BUILD_PAYLOAD),
    ("/strategy/audit", AUDIT_PAYLOAD),
    ("/wallet/analyze", WALLET_PAYLOAD),
    ("/monte-carlo/run", MONTE_CARLO_PAYLOAD),
    ("/stress-test/run", STRESS_PAYLOAD),
    ("/strategy/stress-test", STRESS_PAYLOAD),
]


class FakeFacilitator:
    """Facilitator double that never calls a live payment service."""

    def __init__(self) -> None:
        self.verify_calls = 0
        self.settle_calls = 0

    def get_supported(self) -> SupportedResponse:
        return SupportedResponse(
            kinds=[
                SupportedKind(x402Version=2, scheme="exact", network="eip155:196"),
                SupportedKind(
                    x402Version=2,
                    scheme="aggr_deferred",
                    network="eip155:196",
                ),
            ]
        )

    async def verify(self, payload, requirements) -> VerifyResponse:
        self.verify_calls += 1
        return VerifyResponse(
            isValid=True,
            payer="0x2222222222222222222222222222222222222222",
        )

    async def settle(self, payload, requirements) -> SettleResponse:
        self.settle_calls += 1
        return SettleResponse(
            success=True,
            status="success",
            payer="0x2222222222222222222222222222222222222222",
            transaction="0xabc123",
            network="eip155:196",
        )


def fake_payment_server(
    payment_settings: PaymentSettings,
) -> tuple[x402ResourceServer, FakeFacilitator]:
    facilitator = FakeFacilitator()
    server = x402ResourceServer(facilitator)
    server.register(payment_settings.network, ExactEvmScheme())
    server.register(payment_settings.network, AggrDeferredEvmScheme())
    return server, facilitator


@pytest.fixture
def payment_settings() -> PaymentSettings:
    return PaymentSettings(
        receiver="0x1111111111111111111111111111111111111111",
        price_usdt="0.01",
        network="eip155:196",
        okx_api_key="test-key",
        okx_secret_key="test-secret",
        okx_passphrase="test-passphrase",
    )


@pytest.fixture
def paid_client(payment_settings: PaymentSettings) -> tuple[TestClient, FakeFacilitator]:
    server, facilitator = fake_payment_server(payment_settings)
    return TestClient(create_app(payment_settings, server)), facilitator


@pytest.mark.parametrize(
    ("path", "payload"),
    PROTECTED_ROUTES,
)
def test_protected_routes_return_x402_challenge_without_payment(
    paid_client: tuple[TestClient, FakeFacilitator],
    path: str,
    payload: dict,
) -> None:
    client, facilitator = paid_client

    response = client.post(path, json=payload)

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers
    challenge = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
    assert challenge["x402Version"] == 2
    expected_resource = "https://deltazero-production.up.railway.app"
    if path != "/":
        expected_resource += path
    assert challenge["resource"]["url"] == expected_resource
    assert {option["scheme"] for option in challenge["accepts"]} == {
        "exact",
        "aggr_deferred",
    }
    assert all(option["network"] == "eip155:196" for option in challenge["accepts"])
    assert all(option["amount"] == "10000" for option in challenge["accepts"])
    assert all(
        option["payTo"] == "0x1111111111111111111111111111111111111111"
        for option in challenge["accepts"]
    )
    assert facilitator.verify_calls == 0
    assert facilitator.settle_calls == 0


@pytest.mark.parametrize("path", ["/", "/health", "/docs", "/openapi.json"])
def test_required_public_routes_remain_free(
    paid_client: tuple[TestClient, FakeFacilitator],
    path: str,
) -> None:
    client, facilitator = paid_client

    response = client.get(path)

    assert response.status_code == 200
    assert "PAYMENT-REQUIRED" not in response.headers
    assert facilitator.verify_calls == 0
    assert facilitator.settle_calls == 0


def test_every_backend_post_route_is_payment_protected(
    payment_settings: PaymentSettings,
) -> None:
    schema = create_app().openapi()
    exposed_post_routes = {
        f"POST {path}"
        for path, operations in schema["paths"].items()
        if "post" in operations
    }

    assert exposed_post_routes - {"POST /risk-engine/recover-payment"} == set(paid_routes(payment_settings))


@pytest.mark.parametrize(("path", "payload"), PROTECTED_ROUTES)
def test_wrong_admin_key_keeps_x402_challenge_for_every_protected_route(
    payment_settings: PaymentSettings,
    path: str,
    payload: dict,
) -> None:
    settings = replace(payment_settings, admin_key="owner-test-key")
    server, _ = fake_payment_server(settings)
    client = TestClient(create_app(settings, server))

    response = client.post(
        path,
        json=payload,
        headers={"X-DeltaZero-Admin-Key": "wrong-key"},
    )

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers


@pytest.mark.parametrize(("path", "payload"), PROTECTED_ROUTES)
def test_correct_admin_key_executes_every_protected_endpoint(
    payment_settings: PaymentSettings,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    payload: dict,
) -> None:
    from app.services import wallet_analyzer

    admin_key = "owner-test-key"
    settings = replace(payment_settings, admin_key=admin_key)
    server, _ = fake_payment_server(settings)
    client = TestClient(create_app(settings, server))
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [])

    with caplog.at_level("INFO", logger="app.payments"):
        response = client.post(
            path,
            json=payload,
            headers={"X-DeltaZero-Admin-Key": admin_key},
        )

    assert response.status_code == 200
    assert "PAYMENT-REQUIRED" not in response.headers
    assert "admin_bypass_used=true" in caplog.text
    assert admin_key not in caplog.text
    assert admin_key not in response.text
    assert admin_key not in json.dumps(dict(response.headers))


def test_admin_bypass_is_disabled_when_key_is_not_configured(
    payment_settings: PaymentSettings,
) -> None:
    server, _ = fake_payment_server(payment_settings)
    client = TestClient(create_app(payment_settings, server))

    response = client.post(
        "/strategy/build",
        json=BUILD_PAYLOAD,
        headers={"X-DeltaZero-Admin-Key": "any-value"},
    )

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers


def test_free_endpoint_stays_free_with_admin_key_configured(
    payment_settings: PaymentSettings,
) -> None:
    settings = replace(payment_settings, admin_key="owner-test-key")
    client = TestClient(create_app(settings, create_payment_server(settings)))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "PAYMENT-REQUIRED" not in response.headers


def test_valid_paid_replay_runs_handler_and_returns_settlement_header(
    paid_client: tuple[TestClient, FakeFacilitator],
) -> None:
    client, facilitator = paid_client
    challenge_response = client.post("/strategy/build", json=BUILD_PAYLOAD)
    challenge = json.loads(
        base64.b64decode(challenge_response.headers["PAYMENT-REQUIRED"])
    )
    payment_payload = PaymentPayload(
        payload={"signature": "facilitator-test-signature"},
        accepted=PaymentRequirements.model_validate(challenge["accepts"][0]),
    )

    response = client.post(
        "/strategy/build",
        json=BUILD_PAYLOAD,
        headers={
            "PAYMENT-SIGNATURE": encode_payment_signature_header(payment_payload),
        },
    )

    assert response.status_code == 200
    assert response.json()["service"] == "deltazero"
    assert "PAYMENT-RESPONSE" in response.headers
    settlement = json.loads(base64.b64decode(response.headers["PAYMENT-RESPONSE"]))
    assert settlement["success"] is True
    assert settlement["transaction"] == "0xabc123"
    assert facilitator.verify_calls == 1
    assert facilitator.settle_calls == 1


def test_payment_configuration_is_disabled_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "PAYMENT_RECEIVER",
        "PAYMENT_PRICE_USDT",
        "PAYMENT_NETWORK",
        "OKX_API_KEY",
        "OKX_SECRET_KEY",
        "OKX_PASSPHRASE",
        "DELTAZERO_ADMIN_KEY",
    ):
        monkeypatch.delenv(key, raising=False)

    assert PaymentSettings.from_environment() is None


def test_partial_payment_configuration_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "PAYMENT_RECEIVER",
        "0x1111111111111111111111111111111111111111",
    )
    monkeypatch.delenv("PAYMENT_PRICE_USDT", raising=False)
    monkeypatch.delenv("PAYMENT_NETWORK", raising=False)

    with pytest.raises(RuntimeError, match="Incomplete x402 payment configuration"):
        PaymentSettings.from_environment()


def test_three_payment_variables_enable_challenge_only_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "PAYMENT_RECEIVER",
        "0x1111111111111111111111111111111111111111",
    )
    monkeypatch.setenv("PAYMENT_PRICE_USDT", "0.01")
    monkeypatch.setenv("PAYMENT_NETWORK", "eip155:196")
    for key in ("OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"):
        monkeypatch.delenv(key, raising=False)

    settings = PaymentSettings.from_environment()

    assert settings is not None
    assert settings.has_facilitator_credentials is False
    client = TestClient(create_app(settings, create_payment_server(settings)))
    response = client.post("/strategy/build", json=BUILD_PAYLOAD)
    assert response.status_code == 402
    challenge = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
    assert challenge["accepts"][0]["amount"] == "10000"
    assert challenge["accepts"][0]["network"] == "eip155:196"


def test_challenge_only_mode_never_releases_protected_resource(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "PAYMENT_RECEIVER",
        "0x1111111111111111111111111111111111111111",
    )
    monkeypatch.setenv("PAYMENT_PRICE_USDT", "0.01")
    monkeypatch.setenv("PAYMENT_NETWORK", "eip155:196")
    for key in ("OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"):
        monkeypatch.delenv(key, raising=False)
    settings = PaymentSettings.from_environment()
    assert settings is not None
    client = TestClient(create_app(settings, create_payment_server(settings)))
    challenge_response = client.post("/strategy/build", json=BUILD_PAYLOAD)
    challenge = json.loads(
        base64.b64decode(challenge_response.headers["PAYMENT-REQUIRED"])
    )
    fake_payment = PaymentPayload(
        payload={"signature": "unverified"},
        accepted=PaymentRequirements.model_validate(challenge["accepts"][0]),
    )

    response = client.post(
        "/strategy/build",
        json=BUILD_PAYLOAD,
        headers={"PAYMENT-SIGNATURE": encode_payment_signature_header(fake_payment)},
    )

    assert response.status_code == 402
    rejection = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
    assert rejection["error"] == "facilitator_credentials_unavailable"


def test_partial_facilitator_credentials_are_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "PAYMENT_RECEIVER",
        "0x1111111111111111111111111111111111111111",
    )
    monkeypatch.setenv("PAYMENT_PRICE_USDT", "0.01")
    monkeypatch.setenv("PAYMENT_NETWORK", "eip155:196")
    monkeypatch.setenv("OKX_API_KEY", "key")
    monkeypatch.delenv("OKX_SECRET_KEY", raising=False)
    monkeypatch.delenv("OKX_PASSPHRASE", raising=False)

    with pytest.raises(RuntimeError, match="Incomplete OKX facilitator configuration"):
        PaymentSettings.from_environment()


@pytest.mark.parametrize("price", ["0", "-1", "0.0000001", "not-a-number"])
def test_invalid_payment_price_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
    price: str,
) -> None:
    monkeypatch.setenv(
        "PAYMENT_RECEIVER",
        "0x1111111111111111111111111111111111111111",
    )
    monkeypatch.setenv("PAYMENT_PRICE_USDT", price)
    monkeypatch.setenv("PAYMENT_NETWORK", "eip155:196")
    monkeypatch.setenv("OKX_API_KEY", "key")
    monkeypatch.setenv("OKX_SECRET_KEY", "secret")
    monkeypatch.setenv("OKX_PASSPHRASE", "passphrase")

    with pytest.raises(RuntimeError, match="PAYMENT_PRICE_USDT"):
        PaymentSettings.from_environment()
