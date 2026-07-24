"""Agent-native Model Context Protocol surface for DeltaZero."""

from __future__ import annotations

import json
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.models.monte_carlo import MonteCarloRequest
from app.models.interoperability import RiskEnvelopeV1
from app.models.risk_engine import RiskEnginePassRequest
from app.models.registry import RegistryEvaluationRequest
from app.models.schemas import AuditRequest, BuildRequest, StressTestRequest
from app.payments import (
    DeltaZeroPaymentMiddleware,
    PaymentSettings,
    create_payment_server,
    mcp_paid_routes,
)
from app.services.auditor import audit_strategy
from app.services.builder import build_strategy
from app.services.market_data import get_hyperliquid_market
from app.services.monte_carlo import run_monte_carlo as run_monte_carlo_analysis
from app.services.risk_engine import run_risk_engine_pass
from app.services.strategy_registry import evaluate_strategy_registry
from app.services.stress_test import stress_test_strategy


PREMIUM_MCP_TOOLS = frozenset(
    {
        "build_neutral_strategy",
        "audit_hedge_drift",
        "run_funding_stress",
        "run_monte_carlo",
        "run_complete_risk_engine",
        "evaluate_risk_envelope",
        "explain_risk_recommendation",
    }
)

# MCP methods and tools that are always free (no x402 charge).
# Any request that is NOT one of these will receive a 402 challenge.
FREE_MCP_METHODS = frozenset(
    {
        "initialize",
        "notifications/initialized",
        "tools/list",
        "resources/list",
        "resources/read",
        "ping",
    }
)

FREE_MCP_TOOLS = frozenset(
    {
        "get_hyperliquid_market_context",
        "evaluate_strategy_memory",
    }
)


def create_mcp_server() -> FastMCP:
    """Create the stateless MCP server and register native typed tools."""

    server = FastMCP(
        "DeltaZero",
        instructions=(
            "Deterministic DeFi risk intelligence for pseudo-delta-neutral "
            "strategies. Calculations are decision support, not profit forecasts."
        ),
        website_url="https://delta-zero-alpha.vercel.app",
        stateless_http=True,
        json_response=True,
        streamable_http_path="/mcp",
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=[
                "deltazero-production.up.railway.app",
                "testserver",
                "localhost:*",
                "127.0.0.1:*",
            ],
            allowed_origins=[
                "https://delta-zero-alpha.vercel.app",
                "http://localhost:*",
                "http://127.0.0.1:*",
            ],
        ),
    )

    @server.tool(structured_output=True)
    def get_hyperliquid_market_context(
        asset: str,
        lookback_hours: int = 24,
        dex: str | None = None,
    ) -> dict[str, Any]:
        """Read free live Hyperliquid price, funding, volume, and open-interest context."""

        return get_hyperliquid_market(asset, dex, lookback_hours).model_dump(
            mode="json", exclude_none=True
        )

    @server.tool(structured_output=True)
    def build_neutral_strategy(request: BuildRequest) -> dict[str, Any]:
        """Build a deterministic pseudo-delta-neutral strategy from validated assumptions."""

        return build_strategy(request).model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def audit_hedge_drift(request: AuditRequest) -> dict[str, Any]:
        """Audit hedge drift, net delta, carry, collateral resilience, and corrective action."""

        return audit_strategy(request).model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def run_funding_stress(request: StressTestRequest) -> dict[str, Any]:
        """Apply deterministic funding and portfolio shocks to an existing structure."""

        return stress_test_strategy(request).model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def run_monte_carlo(request: MonteCarloRequest) -> dict[str, Any]:
        """Run seeded sensitivity paths and return impairment and breach distributions."""

        return run_monte_carlo_analysis(request).model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def run_complete_risk_engine(request: RiskEnginePassRequest) -> dict[str, Any]:
        """Return Strategy Build, Hedge-Drift, Funding Stress, and Monte Carlo in one pass."""

        return run_risk_engine_pass(request).model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def evaluate_risk_envelope(request: RiskEnginePassRequest) -> dict[str, Any]:
        """Return the portable Risk Envelope v1 without endpoint-specific parsing."""

        return run_risk_engine_pass(request).risk_envelope.model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def explain_risk_recommendation(request: RiskEnginePassRequest) -> dict[str, Any]:
        """Explain verified risk metrics without changing the deterministic recommendation."""
        explained_request = request.model_copy(update={"include_ai_explanation": True})
        explanation = run_risk_engine_pass(explained_request).narrative_explanation
        if explanation is None:  # pragma: no cover - defensive contract guard
            raise RuntimeError("Risk explanation was not generated.")
        return explanation.model_dump(mode="json", exclude_none=True)

    @server.tool(structured_output=True)
    def evaluate_strategy_memory(request: RegistryEvaluationRequest) -> dict[str, Any]:
        """Evaluate client-owned recommendation outcomes without persisting or retraining."""

        return evaluate_strategy_registry(request).model_dump(mode="json", exclude_none=True)

    @server.resource(
        "deltazero://methodology",
        title="DeltaZero methodology",
        mime_type="application/json",
    )
    def methodology() -> str:
        """Describe the formulas, assumptions, and limitations behind DeltaZero."""

        return json.dumps(
            {
                "model_version": "1.0",
                "methodology_url": "https://delta-zero-alpha.vercel.app/methodology",
                "core_metrics": {
                    "hedge_ratio": "short_notional / long_notional",
                    "hedge_drift_pct": "abs(1 - hedge_ratio) * 100",
                    "net_delta_pct": "(long_notional - short_notional) / long_notional * 100",
                    "safety_buffer": "min(100, collateral / short_notional * 200)",
                },
                "limitations": [
                    "Safety Buffer is a heuristic, not a liquidation probability.",
                    "Monte Carlo factors are independently sampled clipped-normal stresses.",
                    "Outputs are decision support and do not forecast profitability.",
                ],
            }
        )

    @server.resource(
        "deltazero://supported-protocols",
        title="Supported protocols and data boundaries",
        mime_type="application/json",
    )
    def supported_protocols() -> str:
        """Return the currently supported read-only integration boundaries."""

        return json.dumps(
            {
                "market_context": ["Hyperliquid"],
                "wallet_positions": ["Hyperliquid", "Aave", "Morpho"],
                "supported_assets": ["SOL", "ETH"],
                "access": "read_only",
                "custody": False,
                "trade_execution": False,
            }
        )

    @server.resource(
        "deltazero://schemas/risk-envelope-v1",
        title="DeltaZero Risk Envelope v1 JSON Schema",
        mime_type="application/schema+json",
    )
    def risk_envelope_schema() -> str:
        """Return the portable output contract embedded in complete risk passes."""

        return json.dumps(RiskEnvelopeV1.model_json_schema())

    return server


class MCPToolPaymentGate:
    """x402 payment gate for the MCP Streamable HTTP transport.

    Intercepts ALL POST requests to /mcp BEFORE MCP content negotiation.
    Only explicitly free operations (initialize, discovery, free tools) pass
    through without payment.  Any other request — including bare probes,
    unparseable bodies, and premium tool calls — receives a 402 challenge.

    This ordering guarantees OKX's x402 verification probe receives HTTP 402
    with a valid ``accepts`` array instead of the MCP transport's HTTP 406.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        payment_settings: PaymentSettings,
    ) -> None:
        self.app = app
        self.payment_app = DeltaZeroPaymentMiddleware(
            app,
            routes=mcp_paid_routes(payment_settings),
            server=create_payment_server(payment_settings),
            admin_key=payment_settings.admin_key,
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")
        compatible_scope = self._with_json_accept_compatibility(scope)

        # Non-POST requests to MCP paths (e.g. GET probes from x402-check)
        # go straight to the payment gate so they receive 402, not 405/406.
        if method != "POST":
            if path in ("/mcp", "/mcp/", "/mcp/call", "/mcp/call/"):
                await self.payment_app(compatible_scope, receive, send)
                return
            await self.app(compatible_scope, receive, send)
            return

        body, replay_receive = await self._buffer_request(receive)
        if self._is_free_operation(body):
            await self.app(compatible_scope, replay_receive, send)
            return
        # Everything else (premium tools, bare probes, unparseable bodies)
        # goes through x402 which returns 402 for unpaid requests.
        await self.payment_app(compatible_scope, replay_receive, send)

    @staticmethod
    def _with_json_accept_compatibility(scope: Scope) -> Scope:
        """Accept JSON-only MCP clients while preserving the SDK transport.

        The MCP SDK currently requires clients to advertise JSON and SSE even
        when json_response=True returns a standard JSON-RPC response. OKX's
        paid replay correctly advertises application/json only. Add the SSE
        capability internally so the caller still receives JSON instead of a
        406 response.
        """

        if scope.get("type") != "http" or scope.get("method") != "POST":
            return scope
        if scope.get("path", "").rstrip("/") != "/mcp":
            return scope

        headers = list(scope.get("headers", []))
        accept_values = [
            value for name, value in headers if name.lower() == b"accept"
        ]
        combined = b", ".join(accept_values).lower()
        if b"text/event-stream" in combined:
            return scope
        if accept_values and b"application/json" not in combined:
            return scope

        compatible_headers = [
            (name, value) for name, value in headers if name.lower() != b"accept"
        ]
        compatible_headers.append(
            (b"accept", b"application/json, text/event-stream")
        )
        compatible_scope = dict(scope)
        compatible_scope["headers"] = compatible_headers
        return compatible_scope

    @staticmethod
    async def _buffer_request(receive: Receive) -> tuple[bytes, Receive]:
        chunks: list[bytes] = []
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] != "http.request":
                continue
            chunks.append(message.get("body", b""))
            more_body = message.get("more_body", False)
        body = b"".join(chunks)
        sent = False

        async def replay() -> Message:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        return body, replay

    @staticmethod
    def _is_free_operation(body: bytes) -> bool:
        """Return True only if the body is a known free MCP operation.

        Any request that cannot be parsed as valid MCP JSON-RPC is treated
        as paid so that bare x402 probes receive 402 instead of falling
        through to the MCP content-negotiation layer (which returns 406).
        """
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            return False

        messages = payload if isinstance(payload, list) else [payload]
        if not messages:
            return False

        for message in messages:
            if not isinstance(message, dict):
                return False
            method = message.get("method")
            # Free protocol-level methods (initialize, discovery, notifications)
            if method in FREE_MCP_METHODS:
                continue
            # Free tool calls
            if (
                method == "tools/call"
                and isinstance(message.get("params"), dict)
                and message["params"].get("name") in FREE_MCP_TOOLS
            ):
                continue
            # Anything else is a paid operation
            return False
        return True
