"""Verify and redeem an accidental direct USD₮0 transfer exactly once."""

from __future__ import annotations

from contextlib import closing
import hashlib
import json
import os
import sqlite3
from decimal import Decimal
from typing import Any

from eth_account import Account
from eth_account.messages import encode_defunct
import httpx

from app.models.payment_recovery import RecoveredPaymentReceipt
from app.models.risk_engine import RiskEnginePassRequest
from app.payments import PaymentSettings


XLAYER_RPC_URL = os.getenv("XLAYER_RPC_URL", "https://rpc.xlayer.tech")
USDT0_XLAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736"
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


class PaymentRecoveryError(ValueError):
    """A direct transfer cannot be safely redeemed."""


def request_fingerprint(analysis: RiskEnginePassRequest) -> str:
    payload = analysis.model_dump(mode="json", exclude_none=False)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def recovery_message(transaction_hash: str) -> str:
    return (
        "DeltaZero payment recovery\n"
        f"Transaction: {transaction_hash.lower()}"
    )


def verify_payer_signature(
    transaction_hash: str,
    payer: str,
    signature: str,
) -> None:
    raw_message = recovery_message(transaction_hash)
    # The first browser release included a final newline in the backend-only
    # verifier while the wallet signed the same text without it. Accept both
    # fixed, transaction-bound messages so existing payment attempts can be
    # recovered without accepting any free-form ownership claim.
    messages = (raw_message, raw_message + "\n")
    recovered_addresses: set[str] = set()
    for message_text in messages:
        encoded_hex = "0x" + message_text.encode().hex()
        for message in (
            encode_defunct(text=message_text),
            encode_defunct(text=encoded_hex),
        ):
            try:
                recovered_addresses.add(
                    Account.recover_message(message, signature=signature).lower()
                )
            except Exception:
                continue
    if not recovered_addresses:
        raise PaymentRecoveryError("Wallet ownership signature is invalid")
    if payer.lower() not in recovered_addresses:
        raise PaymentRecoveryError("Signature does not match the connected wallet")


def _rpc(method: str, params: list[Any]) -> Any:
    response = httpx.post(
        XLAYER_RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise PaymentRecoveryError("X Layer RPC rejected the verification request")
    return payload.get("result")


def verify_direct_transfer(
    transaction_hash: str,
    payer: str,
    settings: PaymentSettings,
) -> RecoveredPaymentReceipt:
    transaction = _rpc("eth_getTransactionByHash", [transaction_hash])
    receipt = _rpc("eth_getTransactionReceipt", [transaction_hash])
    if not transaction or not receipt:
        raise PaymentRecoveryError("Transaction was not found or is not confirmed on X Layer")
    if receipt.get("status") != "0x1":
        raise PaymentRecoveryError("Transaction did not settle successfully")
    if str(transaction.get("from", "")).lower() != payer.lower():
        expected = str(transaction.get("from", "")).lower()
        raise PaymentRecoveryError(
            f"Switch to the wallet that paid: {expected}. Connected wallet: {payer.lower()}"
        )
    if str(transaction.get("to", "")).lower() != USDT0_XLAYER:
        raise PaymentRecoveryError("Transaction did not transfer the supported X Layer USD₮0 token")

    expected_amount = int(Decimal(settings.price_usdt) * Decimal(1_000_000))
    matching_log = None
    for log in receipt.get("logs", []):
        topics = [str(topic).lower() for topic in log.get("topics", [])]
        if (
            str(log.get("address", "")).lower() == USDT0_XLAYER
            and len(topics) >= 3
            and topics[0] == TRANSFER_TOPIC
            and "0x" + topics[1][-40:] == payer.lower()
            and "0x" + topics[2][-40:] == settings.receiver.lower()
            and int(log.get("data", "0x0"), 16) == expected_amount
        ):
            matching_log = log
            break
    if matching_log is None:
        raise PaymentRecoveryError(
            f"No exact {settings.price_usdt} USD₮0 transfer to the DeltaZero receiver was found"
        )

    return RecoveredPaymentReceipt(
        transaction=transaction_hash,
        payer=payer,
        receiver=settings.receiver.lower(),
        asset=USDT0_XLAYER,
        amount_atomic=str(expected_amount),
        block_number=int(receipt["blockNumber"], 16),
    )


class RedemptionStore:
    """Atomically bind each payment hash to one immutable analysis request."""

    def __init__(self, path: str | None = None) -> None:
        self.path = path or os.getenv(
            "PAYMENT_REDEMPTION_DB_PATH", "/tmp/deltazero-payment-redemptions.sqlite3"
        )
        with closing(sqlite3.connect(self.path)) as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS payment_redemptions (
                    transaction_hash TEXT PRIMARY KEY,
                    request_fingerprint TEXT NOT NULL,
                    payer TEXT NOT NULL,
                    redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )"""
            )

    def claim(self, transaction_hash: str, fingerprint: str, payer: str) -> None:
        with closing(sqlite3.connect(self.path, timeout=10)) as connection:
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute(
                "SELECT request_fingerprint, payer FROM payment_redemptions WHERE transaction_hash = ?",
                (transaction_hash,),
            ).fetchone()
            if existing is None:
                connection.execute(
                    "INSERT INTO payment_redemptions(transaction_hash, request_fingerprint, payer) VALUES (?, ?, ?)",
                    (transaction_hash, fingerprint, payer),
                )
                connection.commit()
                return
            if existing != (fingerprint, payer):
                raise PaymentRecoveryError(
                    "This payment has already been redeemed for a different analysis"
                )
            connection.commit()
