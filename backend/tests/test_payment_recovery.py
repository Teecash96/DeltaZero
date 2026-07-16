"""Direct-transfer payment recovery security tests."""

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient

from app.main import create_app
from app.payments import PaymentSettings
from app.services.payment_recovery import (
    TRANSFER_TOPIC,
    USDT0_XLAYER,
    recovery_message,
)


ANALYSIS = {
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
TX_HASH = "0x" + "ab" * 32
RECEIVER = "0x1111111111111111111111111111111111111111"


def _settings() -> PaymentSettings:
    return PaymentSettings(
        receiver=RECEIVER,
        price_usdt="1",
        network="eip155:196",
    )


def _payload(account) -> dict:
    signature = "0x" + Account.sign_message(
        encode_defunct(text=recovery_message(TX_HASH)),
        account.key,
    ).signature.hex()
    return {
        "transaction_hash": TX_HASH,
        "payer": account.address,
        "signature": signature,
        "analysis": ANALYSIS,
    }


def _rpc_result(account):
    payer_topic = "0x" + "0" * 24 + account.address[2:].lower()
    receiver_topic = "0x" + "0" * 24 + RECEIVER[2:]

    def rpc(method: str, _params: list):
        if method == "eth_getTransactionByHash":
            return {"from": account.address, "to": USDT0_XLAYER}
        return {
            "status": "0x1",
            "blockNumber": "0x2a",
            "logs": [{
                "address": USDT0_XLAYER,
                "topics": [TRANSFER_TOPIC, payer_topic, receiver_topic],
                "data": hex(1_000_000),
            }],
        }

    return rpc


def test_recovery_verifies_transfer_and_returns_all_reports(monkeypatch, tmp_path) -> None:
    from app.services import payment_recovery

    account = Account.create()
    monkeypatch.setattr(payment_recovery, "_rpc", _rpc_result(account))
    monkeypatch.setenv("PAYMENT_REDEMPTION_DB_PATH", str(tmp_path / "redemptions.sqlite3"))
    client = TestClient(create_app(payment_settings=_settings()))

    response = client.post("/risk-engine/recover-payment", json=_payload(account))

    assert response.status_code == 200
    body = response.json()
    assert body["receipt"]["transfer_verified"] is True
    assert body["receipt"]["amount_atomic"] == "1000000"
    assert body["result"]["service"] == "risk_engine_pass"


def test_recovery_rejects_transaction_reuse_for_different_inputs(monkeypatch, tmp_path) -> None:
    from app.services import payment_recovery

    account = Account.create()
    monkeypatch.setattr(payment_recovery, "_rpc", _rpc_result(account))
    monkeypatch.setenv("PAYMENT_REDEMPTION_DB_PATH", str(tmp_path / "redemptions.sqlite3"))
    client = TestClient(create_app(payment_settings=_settings()))
    first = _payload(account)
    assert client.post("/risk-engine/recover-payment", json=first).status_code == 200

    changed = {**ANALYSIS, "capital_usd": 9000}
    signature = "0x" + Account.sign_message(
        encode_defunct(text=recovery_message(TX_HASH)),
        account.key,
    ).signature.hex()
    response = client.post("/risk-engine/recover-payment", json={
        **first,
        "signature": signature,
        "analysis": changed,
    })

    assert response.status_code == 400
    assert "already been redeemed" in response.json()["detail"]


def test_recovery_rejects_signature_from_different_wallet(monkeypatch, tmp_path) -> None:
    from app.services import payment_recovery

    payer = Account.create()
    attacker = Account.create()
    monkeypatch.setattr(payment_recovery, "_rpc", _rpc_result(payer))
    monkeypatch.setenv("PAYMENT_REDEMPTION_DB_PATH", str(tmp_path / "redemptions.sqlite3"))
    payload = _payload(attacker)
    payload["payer"] = payer.address

    response = TestClient(create_app(payment_settings=_settings())).post(
        "/risk-engine/recover-payment", json=payload
    )

    assert response.status_code == 400
    assert "Signature does not match" in response.json()["detail"]


def test_recovery_reports_the_required_payment_wallet(monkeypatch, tmp_path) -> None:
    from app.services import payment_recovery

    payer = Account.create()
    connected = Account.create()
    monkeypatch.setattr(payment_recovery, "_rpc", _rpc_result(payer))
    monkeypatch.setenv("PAYMENT_REDEMPTION_DB_PATH", str(tmp_path / "redemptions.sqlite3"))

    response = TestClient(create_app(payment_settings=_settings())).post(
        "/risk-engine/recover-payment", json=_payload(connected)
    )

    assert response.status_code == 400
    detail = response.json()["detail"].lower()
    assert "switch to the wallet that paid" in detail
    assert payer.address.lower() in detail
    assert connected.address.lower() in detail
