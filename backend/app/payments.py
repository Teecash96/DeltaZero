"""x402 payment configuration for DeltaZero's paid API resources.

The implementation delegates challenge creation to the official OKX x402 SDK.
When facilitator credentials are configured, signature verification and on-chain
settlement are delegated as well. Without those credentials, the service remains
in challenge-only mode and never releases a protected resource.
"""

from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass, field, replace
from decimal import Decimal, InvalidOperation
import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import threading
import time
from typing import Any
import uuid

from x402.http import (
    OKXAuthConfig,
    OKXFacilitatorClient,
    OKXFacilitatorConfig,
    PaymentOption,
    RouteConfig,
)
from x402 import SettleResponse, SupportedKind, SupportedResponse, VerifyResponse
from x402.mechanisms.evm.deferred.server import AggrDeferredEvmScheme
from x402.mechanisms.evm.exact.server import ExactEvmScheme
from x402.server import x402ResourceServer
from x402.http.middleware.fastapi import PaymentMiddlewareASGI


_EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_CAIP2_EVM_NETWORK_RE = re.compile(r"^eip155:[1-9][0-9]*$")
_ADMIN_HEADER = b"x-deltazero-admin-key"
_PAYMENT_HEADERS = (b"payment-signature", b"x-payment")
_DEFAULT_PUBLIC_API_BASE_URL = "https://deltazero-production.up.railway.app"
_DEFAULT_PRICE_USDT = "1"

# USDT0 token address on XLayer (eip155:196) — the registered settlement token
# for all x402 payments.  Must appear in every accepts array so that OKX's
# x402 verification probe can validate the PaymentOption against the ASP's
# on-chain registration.
USDT0_XLAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736"
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PaymentSettings:
    """Validated configuration for OKX-facilitated x402 payments."""

    receiver: str
    price_usdt: str
    network: str
    okx_api_key: str | None = None
    okx_secret_key: str | None = None
    okx_passphrase: str | None = None
    okx_base_url: str = "https://web3.okx.com"
    public_api_base_url: str = _DEFAULT_PUBLIC_API_BASE_URL
    admin_key: str | None = field(default=None, repr=False)
    replay_db_path: str | None = None
    replay_ttl_seconds: int = 86_400

    @classmethod
    def from_environment(cls) -> PaymentSettings | None:
        """Load payment settings, returning ``None`` for an unconfigured local app.

        Receiver and network plus the canonical price are sufficient for safe
        challenge-only mode. The price defaults to 1 USDT when not overridden.
        Facilitator credentials are optional as a group; when absent, no paid
        request can reach business logic. A partially configured credential group
        is rejected.
        """

        values = {
            "PAYMENT_RECEIVER": os.getenv("PAYMENT_RECEIVER", "").strip(),
            "PAYMENT_NETWORK": os.getenv("PAYMENT_NETWORK", "").strip(),
            "OKX_API_KEY": os.getenv("OKX_API_KEY", "").strip(),
            "OKX_SECRET_KEY": os.getenv("OKX_SECRET_KEY", "").strip(),
            "OKX_PASSPHRASE": os.getenv("OKX_PASSPHRASE", "").strip(),
        }

        # DELTAZERO_PRICE_USDT is the only authoritative price for every paid
        # surface. Legacy REST/MCP price variables are considered only when
        # detecting an existing payment configuration; their values are never
        # allowed to override the canonical quote.
        configured_price_values = (
            os.getenv("DELTAZERO_PRICE_USDT", "").strip(),
            os.getenv("PAYMENT_PRICE_USDT", "").strip(),
            os.getenv("MCP_PAYMENT_PRICE_USDT", "").strip(),
        )
        payment_keys = ("PAYMENT_RECEIVER", "PAYMENT_NETWORK")
        if not any(values[key] for key in payment_keys) and not any(
            configured_price_values
        ):
            return None

        missing_payment = [key for key in payment_keys if not values[key]]
        if missing_payment:
            raise RuntimeError(
                "Incomplete x402 payment configuration; missing environment variables: "
                + ", ".join(missing_payment)
            )

        credential_keys = ("OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE")
        credential_count = sum(bool(values[key]) for key in credential_keys)
        if credential_count not in (0, len(credential_keys)):
            missing_credentials = [key for key in credential_keys if not values[key]]
            raise RuntimeError(
                "Incomplete OKX facilitator configuration; missing environment variables: "
                + ", ".join(missing_credentials)
            )

        receiver = values["PAYMENT_RECEIVER"]
        if not _EVM_ADDRESS_RE.fullmatch(receiver):
            raise RuntimeError("PAYMENT_RECEIVER must be a 42-character EVM address")

        network = values["PAYMENT_NETWORK"]
        if not _CAIP2_EVM_NETWORK_RE.fullmatch(network):
            raise RuntimeError("PAYMENT_NETWORK must use CAIP-2 EVM format, such as eip155:196")

        price = canonical_payment_price()
        base_url = os.getenv("OKX_BASE_URL", "https://web3.okx.com").strip()
        if not base_url.startswith("https://"):
            raise RuntimeError("OKX_BASE_URL must be an HTTPS URL")
        public_api_base_url = os.getenv(
            "PUBLIC_API_BASE_URL", _DEFAULT_PUBLIC_API_BASE_URL
        ).strip()
        if not public_api_base_url.startswith("https://"):
            raise RuntimeError("PUBLIC_API_BASE_URL must be an HTTPS URL")

        return cls(
            receiver=receiver,
            price_usdt=price,
            network=network,
            okx_api_key=values["OKX_API_KEY"] or None,
            okx_secret_key=values["OKX_SECRET_KEY"] or None,
            okx_passphrase=values["OKX_PASSPHRASE"] or None,
            okx_base_url=base_url.rstrip("/"),
            public_api_base_url=public_api_base_url.rstrip("/"),
            admin_key=os.getenv("DELTAZERO_ADMIN_KEY") or None,
            replay_db_path=os.getenv(
                "PAYMENT_REPLAY_DB_PATH",
                "/tmp/deltazero-payment-replays.sqlite3",
            ).strip()
            or None,
            replay_ttl_seconds=_positive_int_environment(
                "PAYMENT_REPLAY_TTL_SECONDS",
                86_400,
            ),
        )

    @property
    def has_facilitator_credentials(self) -> bool:
        """Return whether live verification and settlement can be enabled."""

        return bool(self.okx_api_key and self.okx_secret_key and self.okx_passphrase)


def _normalize_price(
    value: str,
    variable_name: str = "DELTAZERO_PRICE_USDT",
) -> str:
    """Validate a positive USDT amount with at most six decimal places."""

    try:
        price = Decimal(value)
    except InvalidOperation as exc:
        raise RuntimeError(
            f"{variable_name} must be a positive decimal amount"
        ) from exc

    if not price.is_finite() or price <= 0:
        raise RuntimeError(f"{variable_name} must be greater than zero")
    if price.as_tuple().exponent < -6:
        raise RuntimeError(f"{variable_name} supports at most six decimal places")

    return format(price.normalize(), "f")


def canonical_payment_price() -> str:
    """Return the single price used by REST and MCP payment challenges."""

    raw_price = os.getenv("DELTAZERO_PRICE_USDT", _DEFAULT_PRICE_USDT).strip()
    return _normalize_price(raw_price or _DEFAULT_PRICE_USDT)


def _positive_int_environment(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return value


def marketplace_payment_settings(settings: PaymentSettings) -> PaymentSettings:
    """Apply the canonical DeltaZero price to the marketplace endpoint."""

    price = canonical_payment_price()
    return replace(settings, price_usdt=price)


class PaymentReplayStore:
    """Durably cache successful paid responses for exact request retries."""

    def __init__(self, path: str, ttl_seconds: int) -> None:
        if path != ":memory:":
            parent = os.path.dirname(os.path.abspath(path))
            os.makedirs(parent, exist_ok=True)
        self.ttl_seconds = ttl_seconds
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(path, check_same_thread=False)
        if path != ":memory:":
            os.chmod(path, 0o600)
        with self._connection:
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS payment_replays (
                    replay_key TEXT PRIMARY KEY,
                    status_code INTEGER NOT NULL,
                    headers_json TEXT NOT NULL,
                    body BLOB NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )

    def get(self, replay_key: str) -> tuple[int, list[tuple[bytes, bytes]], bytes] | None:
        cutoff = time.time() - self.ttl_seconds
        with self._lock, self._connection:
            self._connection.execute(
                "DELETE FROM payment_replays WHERE created_at < ?",
                (cutoff,),
            )
            row = self._connection.execute(
                "SELECT status_code, headers_json, body FROM payment_replays "
                "WHERE replay_key = ?",
                (replay_key,),
            ).fetchone()
        if row is None:
            return None
        headers = [
            (name.encode("latin-1"), value.encode("latin-1"))
            for name, value in json.loads(row[1])
        ]
        return int(row[0]), headers, bytes(row[2])

    def put(
        self,
        replay_key: str,
        status_code: int,
        headers: list[tuple[bytes, bytes]],
        body: bytes,
    ) -> None:
        encoded_headers = json.dumps(
            [(name.decode("latin-1"), value.decode("latin-1")) for name, value in headers]
        )
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT OR REPLACE INTO payment_replays "
                "(replay_key, status_code, headers_json, body, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (replay_key, status_code, encoded_headers, body, time.time()),
            )


class ChallengeOnlyFacilitator:
    """Advertise supported X Layer schemes without accepting any payment.

    This mode exists solely to verify a production 402 challenge before official
    facilitator credentials are available. Verification always fails closed, so
    a forged or otherwise unverified payment header cannot release a resource.
    """

    def __init__(self, network: str) -> None:
        self.network = network

    def get_supported(self) -> SupportedResponse:
        return SupportedResponse(
            kinds=[
                SupportedKind(x402Version=2, scheme="exact", network=self.network),
                SupportedKind(
                    x402Version=2,
                    scheme="aggr_deferred",
                    network=self.network,
                ),
            ]
        )

    async def verify(self, payload, requirements) -> VerifyResponse:
        return VerifyResponse(
            isValid=False,
            invalidReason="facilitator_credentials_unavailable",
            invalidMessage=(
                "Paid settlement is disabled until official OKX facilitator "
                "credentials are configured."
            ),
        )

    async def settle(self, payload, requirements) -> SettleResponse:
        return SettleResponse(
            success=False,
            errorReason="facilitator_credentials_unavailable",
            errorMessage="Paid settlement is not configured.",
            transaction="",
            network=self.network,
        )


def create_payment_server(settings: PaymentSettings) -> x402ResourceServer:
    """Create a challenge-only or facilitator-backed x402 resource server."""

    if settings.has_facilitator_credentials:
        facilitator = OKXFacilitatorClient(
            OKXFacilitatorConfig(
                auth=OKXAuthConfig(
                    api_key=settings.okx_api_key or "",
                    secret_key=settings.okx_secret_key or "",
                    passphrase=settings.okx_passphrase or "",
                ),
                base_url=settings.okx_base_url,
                sync_settle=True,
                timeout=30.0,
            )
        )
    else:
        facilitator = ChallengeOnlyFacilitator(settings.network)

    server = x402ResourceServer(facilitator)
    server.register(settings.network, ExactEvmScheme())
    server.register(settings.network, AggrDeferredEvmScheme())
    return server


def paid_routes(settings: PaymentSettings) -> dict[str, RouteConfig]:
    """Return the exact set of paid DeltaZero resources."""

    price = f"${settings.price_usdt}"

    def _make_option(scheme: str) -> PaymentOption:
        return PaymentOption(
            scheme=scheme,
            price=price,
            network=settings.network,
            pay_to=settings.receiver,
            extra={"token": USDT0_XLAYER},
        )

    def route(path: str, description: str) -> RouteConfig:
        return RouteConfig(
            accepts=[
                _make_option("exact"),
                _make_option("aggr_deferred"),
            ],
            resource=f"{settings.public_api_base_url}{path}",
            description=description,
            mime_type="application/json",
        )

    return {
        "POST /": route(
            "",
            "Run the complete four-module DeltaZero Risk Engine pass",
        ),
        "POST /risk-engine/analyze": route(
            "/risk-engine/analyze",
            "Run the complete four-module DeltaZero Risk Engine pass",
        ),
        "POST /risk-envelope/evaluate": route(
            "/risk-envelope/evaluate",
            "Return a versioned portable DeltaZero Risk Envelope",
        ),
        "POST /strategy/build": route(
            "/strategy/build",
            "Build and evaluate a deterministic pseudo-delta-neutral strategy",
        ),
        "POST /strategy/audit": route(
            "/strategy/audit",
            "Audit an existing pseudo-delta-neutral position",
        ),
        "POST /strategy/stress-test": route(
            "/strategy/stress-test",
            "Run deterministic stress analysis using the legacy route",
        ),
        "POST /stress-test/run": route(
            "/stress-test/run",
            "Run deterministic stress analysis",
        ),
        "POST /monte-carlo/run": route(
            "/monte-carlo/run",
            "Run deterministic Monte Carlo sensitivity analysis",
        ),
        "POST /preview/compare": route(
            "/preview/compare",
            "Compare conservative and aggressive strategy styles",
        ),
    }


def mcp_paid_routes(settings: PaymentSettings) -> dict[str, RouteConfig]:
    """Protect every request to the marketplace-registered MCP resources."""

    price = f"${settings.price_usdt}"

    def _make_option(scheme: str) -> PaymentOption:
        return PaymentOption(
            scheme=scheme,
            price=price,
            network=settings.network,
            pay_to=settings.receiver,
            extra={"token": USDT0_XLAYER},
        )

    options = [
        _make_option("exact"),
        _make_option("aggr_deferred"),
    ]
    description = "Run a premium deterministic DeltaZero MCP risk tool"
    resource = f"{settings.public_api_base_url}/mcp"
    mcp_route = RouteConfig(
        accepts=options,
        resource=resource,
        description=description,
        mime_type="application/json",
    )
    call_route = RouteConfig(
        accepts=options,
        resource=f"{settings.public_api_base_url}/mcp/call",
        description="Call a DeltaZero MCP tool directly via A2MCP",
        mime_type="application/json",
    )
    return {
        "POST /mcp": mcp_route,
        "POST /mcp/": mcp_route,
        "GET /mcp": mcp_route,
        "GET /mcp/": mcp_route,
        "POST /mcp/call": call_route,
        "GET /mcp/call": call_route,
    }


class DeltaZeroPaymentMiddleware:
    """Apply x402 unless a configured owner-testing key matches exactly.

    The secret is compared in constant time and is never logged, returned, or
    forwarded into business logic. When no key is configured, this wrapper is
    behaviorally identical to the vendor x402 middleware.
    """

    def __init__(
        self,
        app: Any,
        *,
        routes: dict[str, RouteConfig],
        server: x402ResourceServer,
        admin_key: str | None,
        replay_db_path: str | None = None,
        replay_ttl_seconds: int = 86_400,
    ) -> None:
        self.app = app
        self.admin_key = admin_key
        self.protected_routes = frozenset(routes)
        self.payment_app = PaymentMiddlewareASGI(app, routes=routes, server=server)
        self.replay_store = (
            PaymentReplayStore(replay_db_path, replay_ttl_seconds)
            if replay_db_path
            else None
        )
        self._replay_locks: dict[str, asyncio.Lock] = {}

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        route_key = f"{scope.get('method', '')} {scope.get('path', '')}"
        if (
            scope.get("type") == "http"
            and route_key in self.protected_routes
            and self.admin_key is not None
        ):
            supplied_key = self._header_value(scope.get("headers", []))
            if supplied_key is not None and secrets.compare_digest(
                supplied_key,
                self.admin_key,
            ):
                logger.info("admin_bypass_used=true")
                sanitized_scope = dict(scope)
                sanitized_scope["headers"] = [
                    (name, value)
                    for name, value in scope.get("headers", [])
                    if name.lower() != _ADMIN_HEADER
                ]
                await self.app(sanitized_scope, receive, send)
                return

        if scope.get("type") != "http" or route_key not in self.protected_routes:
            await self.payment_app(scope, receive, send)
            return

        request_id = self._request_id(scope.get("headers", []))
        proof = self._payment_proof(scope.get("headers", []))
        started = time.monotonic()

        if proof is None:
            async def challenge_send(message: dict[str, Any]) -> None:
                if message.get("type") == "http.response.start":
                    status = int(message.get("status", 0))
                    message = self._with_response_header(
                        message,
                        b"x-deltazero-request-id",
                        request_id.encode(),
                    )
                    event = "payment_challenge_issued" if status == 402 else "payment_request_completed"
                    self._log_event(event, request_id, route_key, status, started)
                await send(message)

            await self.payment_app(scope, receive, challenge_send)
            return

        body, replay_receive = await self._buffer_request(receive)
        replay_key = self._replay_key(scope, body, proof)
        lock = self._replay_locks.setdefault(replay_key, asyncio.Lock())
        async with lock:
            cached = self.replay_store.get(replay_key) if self.replay_store else None
            if cached is not None:
                status, headers, cached_body = cached
                headers = self._replace_header(
                    headers,
                    b"x-deltazero-request-id",
                    request_id.encode(),
                )
                headers = self._replace_header(
                    headers,
                    b"x-deltazero-replay",
                    b"recovered",
                )
                self._log_event("payment_replay_recovered", request_id, route_key, status, started)
                try:
                    await send({"type": "http.response.start", "status": status, "headers": headers})
                    await send({"type": "http.response.body", "body": cached_body})
                except Exception:
                    logger.exception(
                        "payment_event=payment_result_delivery_failed request_id=%s route=%s replay=recovered",
                        request_id,
                        route_key,
                    )
                    raise
                logger.info(
                    "payment_event=payment_result_delivered request_id=%s route=%s replay=recovered",
                    request_id,
                    route_key,
                )
                self._replay_locks.pop(replay_key, None)
                return

            captured: list[dict[str, Any]] = []

            async def capture_send(message: dict[str, Any]) -> None:
                captured.append(dict(message))

            logger.info(
                "payment_event=payment_replay_started request_id=%s route=%s",
                request_id,
                route_key,
            )
            try:
                await self.payment_app(scope, replay_receive, capture_send)
            except Exception:
                logger.exception(
                    "payment_event=payment_replay_exception request_id=%s route=%s",
                    request_id,
                    route_key,
                )
                raise

            start_message = next(
                (message for message in captured if message.get("type") == "http.response.start"),
                None,
            )
            if start_message is None:
                logger.error(
                    "payment_event=payment_replay_missing_response request_id=%s route=%s",
                    request_id,
                    route_key,
                )
                for message in captured:
                    await send(message)
                return

            status = int(start_message.get("status", 0))
            headers = list(start_message.get("headers", []))
            response_body = b"".join(
                message.get("body", b"")
                for message in captured
                if message.get("type") == "http.response.body"
            )
            has_settlement = self._has_header(headers, b"payment-response")
            settlement_transaction = self._settlement_transaction(headers)
            event = "payment_replay_completed" if 200 <= status < 300 else "payment_replay_failed"
            self._log_event(
                event,
                request_id,
                route_key,
                status,
                started,
                has_settlement,
                settlement_transaction,
            )

            headers = self._replace_header(
                headers,
                b"x-deltazero-request-id",
                request_id.encode(),
            )
            start_message["headers"] = headers
            if (
                self.replay_store is not None
                and 200 <= status < 300
                and has_settlement
            ):
                self.replay_store.put(replay_key, status, headers, response_body)

            try:
                for message in captured:
                    await send(message)
            except Exception:
                logger.exception(
                    "payment_event=payment_result_delivery_failed request_id=%s route=%s replay=fresh transaction=%s",
                    request_id,
                    route_key,
                    settlement_transaction or "none",
                )
                raise
            logger.info(
                "payment_event=payment_result_delivered request_id=%s route=%s replay=fresh transaction=%s",
                request_id,
                route_key,
                settlement_transaction or "none",
            )

        self._replay_locks.pop(replay_key, None)

    @staticmethod
    def _header_value(headers: list[tuple[bytes, bytes]]) -> str | None:
        for name, value in headers:
            if name.lower() == _ADMIN_HEADER:
                try:
                    return value.decode("utf-8")
                except UnicodeDecodeError:
                    return None
        return None

    @staticmethod
    def _payment_proof(headers: list[tuple[bytes, bytes]]) -> bytes | None:
        for name, value in headers:
            if name.lower() in _PAYMENT_HEADERS:
                return value
        return None

    @staticmethod
    def _request_id(headers: list[tuple[bytes, bytes]]) -> str:
        for name, value in headers:
            if name.lower() == b"x-request-id":
                try:
                    candidate = value.decode("ascii")
                except UnicodeDecodeError:
                    break
                if 1 <= len(candidate) <= 128 and re.fullmatch(r"[A-Za-z0-9._:-]+", candidate):
                    return candidate
        return uuid.uuid4().hex

    @staticmethod
    async def _buffer_request(receive: Any) -> tuple[bytes, Any]:
        chunks: list[bytes] = []
        while True:
            message = await receive()
            if message.get("type") != "http.request":
                continue
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        sent = False

        async def replay_receive() -> dict[str, Any]:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        return body, replay_receive

    @staticmethod
    def _replay_key(scope: dict[str, Any], body: bytes, proof: bytes) -> str:
        digest = hashlib.sha256()
        digest.update(str(scope.get("method", "")).encode())
        digest.update(b"\0")
        digest.update(str(scope.get("path", "")).encode())
        digest.update(b"\0")
        digest.update(scope.get("query_string", b""))
        digest.update(b"\0")
        digest.update(body)
        digest.update(b"\0")
        digest.update(proof)
        return digest.hexdigest()

    @staticmethod
    def _has_header(headers: list[tuple[bytes, bytes]], name: bytes) -> bool:
        return any(header_name.lower() == name for header_name, _ in headers)

    @staticmethod
    def _settlement_transaction(headers: list[tuple[bytes, bytes]]) -> str | None:
        for name, value in headers:
            if name.lower() != b"payment-response":
                continue
            try:
                payload = json.loads(base64.b64decode(value))
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                return None
            transaction = payload.get("transaction")
            if isinstance(transaction, str) and re.fullmatch(r"0x[a-fA-F0-9]+", transaction):
                return transaction
        return None

    @staticmethod
    def _replace_header(
        headers: list[tuple[bytes, bytes]],
        name: bytes,
        value: bytes,
    ) -> list[tuple[bytes, bytes]]:
        return [(key, item) for key, item in headers if key.lower() != name] + [(name, value)]

    @classmethod
    def _with_response_header(
        cls,
        message: dict[str, Any],
        name: bytes,
        value: bytes,
    ) -> dict[str, Any]:
        updated = dict(message)
        updated["headers"] = cls._replace_header(list(message.get("headers", [])), name, value)
        return updated

    @staticmethod
    def _log_event(
        event: str,
        request_id: str,
        route: str,
        status: int,
        started: float,
        settlement_receipt: bool = False,
        settlement_transaction: str | None = None,
    ) -> None:
        logger.info(
            "payment_event=%s request_id=%s route=%s status=%s duration_ms=%s settlement_receipt=%s transaction=%s",
            event,
            request_id,
            route,
            status,
            round((time.monotonic() - started) * 1000, 2),
            str(settlement_receipt).lower(),
            settlement_transaction or "none",
        )
