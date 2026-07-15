"""Browser checkout security and API tests."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.checkout import _decode_checkout_token, _encode_checkout_token
from app.main import create_app
from app.models.risk_engine import RiskEnginePassRequest
from app.payments import PaymentSettings


REQUEST = RiskEnginePassRequest(
    asset="SOL", capital_usd=5000, risk_tolerance="medium", target_style="neutral_yield",
    long_yield_apy=14, short_funding_apy=3, fee_drag_apy=1, simulation_count=100,
)
SETTINGS = PaymentSettings(
    receiver="0x1111111111111111111111111111111111111111", price_usdt="1", network="eip155:196",
    okx_api_key="key", okx_secret_key="secret", okx_passphrase="passphrase",
)


def test_checkout_token_binds_payment_to_exact_analysis() -> None:
    expires = (datetime.now(UTC) + timedelta(minutes=20)).isoformat()
    token = _encode_checkout_token("a2a_test", REQUEST, expires, SETTINGS)
    assert _decode_checkout_token(token, REQUEST, SETTINGS)["payment_id"] == "a2a_test"

    changed = REQUEST.model_copy(update={"capital_usd": 9000})
    try:
        _decode_checkout_token(token, changed, SETTINGS)
        assert False, "changed analysis must not redeem the original payment"
    except ValueError:
        pass


@patch("app.checkout.get_checkout_status", new_callable=AsyncMock)
def test_completed_checkout_releases_four_reports(mock_status: AsyncMock) -> None:
    from app.checkout import CheckoutStatusResponse

    mock_status.return_value = CheckoutStatusResponse(payment_id="a2a_test", status="completed", transaction_hash="0xabc")
    expires = (datetime.now(UTC) + timedelta(minutes=20)).isoformat()
    token = _encode_checkout_token("a2a_test", REQUEST, expires, SETTINGS)
    client = TestClient(create_app(SETTINGS))
    response = client.post("/checkout/redeem", json={"request": REQUEST.model_dump(), "checkout_token": token})
    assert response.status_code == 200
    assert response.json()["service"] == "risk_engine_pass"


@patch("app.checkout.get_checkout_status", new_callable=AsyncMock)
def test_pending_checkout_does_not_release_reports(mock_status: AsyncMock) -> None:
    from app.checkout import CheckoutStatusResponse

    mock_status.return_value = CheckoutStatusResponse(payment_id="a2a_test", status="pending")
    expires = (datetime.now(UTC) + timedelta(minutes=20)).isoformat()
    token = _encode_checkout_token("a2a_test", REQUEST, expires, SETTINGS)
    client = TestClient(create_app(SETTINGS))
    response = client.post("/checkout/redeem", json={"request": REQUEST.model_dump(), "checkout_token": token})
    assert response.status_code == 402
