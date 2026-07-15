"""OKX-hosted browser checkout for a bundled Risk Engine pass."""

from __future__ import annotations

import base64
from datetime import UTC, datetime
import hashlib
import hmac
import json
import secrets
from typing import Any

import httpx
from pydantic import BaseModel

from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse
from app.payments import PaymentSettings
from app.services.risk_engine import run_risk_engine_pass


class CheckoutCreateResponse(BaseModel):
    payment_id: str
    payment_url: str
    status: str
    expires_at: str
    checkout_token: str
    amount: str
    symbol: str


class CheckoutStatusResponse(BaseModel):
    payment_id: str
    status: str
    transaction_hash: str | None = None
    failure_message: str | None = None


class CheckoutRedeemRequest(BaseModel):
    request: RiskEnginePassRequest
    checkout_token: str


def _canonical_request(request: RiskEnginePassRequest) -> bytes:
    return request.model_dump_json(exclude_none=True, by_alias=True).encode()


def _request_digest(request: RiskEnginePassRequest) -> str:
    return hashlib.sha256(_canonical_request(request)).hexdigest()


def _signing_key(settings: PaymentSettings) -> bytes:
    if not settings.okx_secret_key:
        raise RuntimeError("Browser checkout requires official OKX payment credentials")
    return settings.okx_secret_key.encode()


def _encode_checkout_token(payment_id: str, request: RiskEnginePassRequest, expires_at: str, settings: PaymentSettings) -> str:
    payload = json.dumps(
        {"payment_id": payment_id, "request_digest": _request_digest(request), "expires_at": expires_at},
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    signature = hmac.new(_signing_key(settings), payload, hashlib.sha256).digest()
    encoded_payload = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{encoded_payload}.{encoded_signature}"


def _decode_checkout_token(token: str, request: RiskEnginePassRequest, settings: PaymentSettings) -> dict[str, str]:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
        signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
        expected = hmac.new(_signing_key(settings), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        decoded = json.loads(payload)
        if decoded["request_digest"] != _request_digest(request):
            raise ValueError("request mismatch")
        if datetime.fromisoformat(decoded["expires_at"].replace("Z", "+00:00")) <= datetime.now(UTC):
            raise ValueError("checkout expired")
        return decoded
    except (KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid or expired checkout token") from exc


def _okx_signature(timestamp: str, method: str, path: str, body: str, settings: PaymentSettings) -> str:
    message = f"{timestamp}{method.upper()}{path}{body}".encode()
    digest = hmac.new(_signing_key(settings), message, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


async def create_checkout(request: RiskEnginePassRequest, settings: PaymentSettings) -> CheckoutCreateResponse:
    if not settings.has_facilitator_credentials:
        raise RuntimeError("Browser checkout is not configured")
    path = "/api/v6/pay/a2a/payment/create"
    external_id = f"dz-{_request_digest(request)[:20]}-{secrets.token_hex(5)}"
    payload = {
        "type": "charge",
        "amount": settings.price_usdt,
        "symbol": "USD₮0",
        "recipient": settings.receiver,
        "description": "DeltaZero complete four-module Risk Engine Pass",
        "externalId": external_id,
        "expiresIn": 1800,
        "deliveries": {"includeUrl": True},
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    timestamp = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    headers = {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": settings.okx_api_key or "",
        "OK-ACCESS-SIGN": _okx_signature(timestamp, "POST", path, body, settings),
        "OK-ACCESS-PASSPHRASE": settings.okx_passphrase or "",
        "OK-ACCESS-TIMESTAMP": timestamp,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"{settings.okx_base_url}{path}", content=body, headers=headers)
    response.raise_for_status()
    envelope = response.json()
    if envelope.get("code") != "0" or not envelope.get("data"):
        raise RuntimeError(envelope.get("msg") or "OKX could not create the checkout")
    data = envelope["data"]
    delivery = next((item for item in data.get("deliveries", []) if item.get("type") == "url"), None)
    if not delivery:
        raise RuntimeError("OKX checkout did not return a payment URL")
    token = _encode_checkout_token(data["paymentId"], request, data["expiresAt"], settings)
    return CheckoutCreateResponse(
        payment_id=data["paymentId"],
        payment_url=delivery["value"],
        status=data["status"],
        expires_at=data["expiresAt"],
        checkout_token=token,
        amount=settings.price_usdt,
        symbol="USD₮0",
    )


async def get_checkout_status(payment_id: str, settings: PaymentSettings) -> CheckoutStatusResponse:
    path = f"/api/v6/pay/a2a/p/{payment_id}/status"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(f"{settings.okx_base_url}{path}", headers={"Accept": "application/json"})
    response.raise_for_status()
    envelope: dict[str, Any] = response.json()
    if envelope.get("code") != "0" or not envelope.get("data"):
        raise RuntimeError(envelope.get("msg") or "Unable to verify checkout status")
    data = envelope["data"]
    return CheckoutStatusResponse(
        payment_id=payment_id,
        status=data["status"],
        transaction_hash=(data.get("executed") or {}).get("txHash"),
        failure_message=(data.get("failure") or {}).get("message"),
    )


async def redeem_checkout(body: CheckoutRedeemRequest, settings: PaymentSettings) -> RiskEnginePassResponse:
    token = _decode_checkout_token(body.checkout_token, body.request, settings)
    status = await get_checkout_status(token["payment_id"], settings)
    if status.status != "completed":
        raise ValueError(f"Payment is {status.status}; the report is not unlocked yet")
    return run_risk_engine_pass(body.request)
