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


_JSONRPC_VERSION = "2.0"
_JSON_CONTENT_TYPE = b"application/json"


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


# ─── Tool dispatch for paid MCP replays ──────────────────────────────────
# Duplicated dispatch functions because mcp_server.py already imports every
# service function needed. Using these avoids circular imports from main.py.

def _call_risk_engine(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.risk_engine import RiskEnginePassRequest
    from app.services.risk_engine import run_risk_engine_pass

    req = RiskEnginePassRequest(**args) if args else RiskEnginePassRequest(
        asset="SOL", capital_usd=5000, risk_tolerance="medium",
        target_style="neutral_yield", long_yield_apy=14,
        short_funding_apy=3, fee_drag_apy=1, stress_magnitude_pct=4,
        simulation_count=100, time_horizon_days=30, seed=42,
    )
    return run_risk_engine_pass(req).model_dump(mode="json", exclude_none=True)


def _call_build(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.schemas import BuildRequest
    from app.services.builder import build_strategy
    return build_strategy(BuildRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_audit(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.schemas import AuditRequest
    from app.services.auditor import audit_strategy
    return audit_strategy(AuditRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_stress(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.schemas import StressTestRequest
    from app.services.stress_test import stress_test_strategy
    return stress_test_strategy(StressTestRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_monte_carlo(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.monte_carlo import MonteCarloRequest
    from app.services.monte_carlo import run_monte_carlo as _run_mc
    return _run_mc(MonteCarloRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_market(args: dict[str, Any]) -> dict[str, Any]:
    from app.services.market_data import get_hyperliquid_market
    asset = args.get("asset", "SOL")
    lookback = args.get("lookback_hours", 24)
    dex = args.get("dex")
    return get_hyperliquid_market(asset, dex, lookback).model_dump(mode="json", exclude_none=True)


def _call_registry(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.registry import RegistryEvaluationRequest
    from app.services.strategy_registry import evaluate_strategy_registry
    return evaluate_strategy_registry(RegistryEvaluationRequest(**args)).model_dump(
        mode="json", exclude_none=True
    )


def _call_risk_envelope(args: dict[str, Any]) -> dict[str, Any]:
    from app.models.risk_engine import RiskEnginePassRequest
    from app.services.risk_engine import run_risk_engine_pass
    req = RiskEnginePassRequest(**args) if args else RiskEnginePassRequest(
        asset="SOL", capital_usd=5000, risk_tolerance="medium",
        target_style="neutral_yield", long_yield_apy=14,
        short_funding_apy=3, fee_drag_apy=1, stress_magnitude_pct=4,
        simulation_count=100, time_horizon_days=30, seed=42,
    )
    return run_risk_engine_pass(req).risk_envelope.model_dump(mode="json", exclude_none=True)


_PAID_MCP_DISPATCH: dict[str, Any] = {
    "run_complete_risk_engine": _call_risk_engine,
    "build_neutral_strategy": _call_build,
    "audit_hedge_drift": _call_audit,
    "run_funding_stress": _call_stress,
    "run_monte_carlo": _call_monte_carlo,
    "get_hyperliquid_market_context": _call_market,
    "evaluate_strategy_memory": _call_registry,
    "evaluate_risk_envelope": _call_risk_envelope,
    "explain_risk_recommendation": _call_risk_engine,
}


class PaidMCPHandler:
    """ASGI app that handles paid MCP tool calls after x402 verification.

    After the x402 middleware validates the PAYMENT-SIGNATURE, it calls the
    inner app. This handler processes the JSON-RPC request directly, bypassing
    the MCP transport's security middleware (which validates Content-Type /
    Accept headers and returns 400/406 for non-standard x402 replay clients).
    """

    def __init__(self, protocol_app: ASGIApp) -> None:
        self.protocol_app = protocol_app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            return

        body = await _read_body(receive)
        if not body:
            return await _send_json_response(send, 400, {"error": "Empty request body"})

        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return await _send_json_response(send, 400, {"error": "Invalid JSON body"})

        path = scope.get("path", "").rstrip("/")

        # --- Custom /mcp/call format: {"tool": "...", "arguments": {...}} ---
        if path == "/mcp/call":
            result = self._dispatch_tool(
                payload.get("tool") or payload.get("name") or "",
                payload.get("arguments") or payload.get("params") or {},
            )
            if result is None:
                return await _send_json_response(send, 400, {
                    "error": "Unknown tool",
                    "available_tools": sorted(_PAID_MCP_DISPATCH.keys()),
                })
            return await _send_json_response(send, 200, {"result": result})

        # --- Standard JSON-RPC batch / single ---
        messages = payload if isinstance(payload, list) else [payload]
        if not messages:
            return await _send_json_response(send, 400, {"error": "Empty request array"})

        results: list[dict[str, Any]] = []
        for msg in messages:
            if not isinstance(msg, dict):
                results.append(_jsonrpc_error(None, -32600, "Invalid Request"))
                continue

            req_id = msg.get("id")
            method: str = msg.get("method", "")

            if method == "tools/call":
                params = msg.get("params", {})
                tool_name = (params.get("name", "") if isinstance(params, dict) else "")
                tool_args = (params.get("arguments", {}) if isinstance(params, dict) else {})
                # MCP SDK sends typed-parameter arguments wrapped in a dict
                # keyed by the parameter name (e.g. {"request": {...}}).
                # Unwrap single-key wrappers so dispatch gets flat fields.
                if isinstance(tool_args, dict) and len(tool_args) == 1 and "request" in tool_args:
                    tool_args = tool_args["request"]
                dispatched = self._dispatch_tool(tool_name, tool_args)
                if dispatched is None:
                    results.append(_jsonrpc_error(req_id, -32601, f"Unknown tool: {tool_name}"))
                else:
                    # Match the SDK's CombinationContent format: both a text
                    # content block and a structuredContent dict.
                    results.append({
                        "jsonrpc": _JSONRPC_VERSION,
                        "id": req_id,
                        "result": {
                            "content": [{"type": "text", "text": json.dumps(dispatched)}],
                            "structuredContent": dispatched,
                            "isError": False,
                        },
                    })
            elif method in ("initialize", "notifications/initialized", "ping"):
                results.append({
                    "jsonrpc": _JSONRPC_VERSION,
                    "id": req_id,
                    "result": {} if method != "initialize" else {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "serverInfo": {"name": "DeltaZero", "version": "0.1.0"},
                    },
                })
            else:
                # Let the real MCP server produce discovery, resource, and
                # protocol-level responses after payment verification. The
                # request body is replayed because it was consumed above.
                replayed = False

                async def replay_receive() -> Message:
                    nonlocal replayed
                    if not replayed:
                        replayed = True
                        return {"type": "http.request", "body": body, "more_body": False}
                    return {"type": "http.request", "body": b"", "more_body": False}

                await self.protocol_app(scope, replay_receive, send)
                return

        payload_out = results if isinstance(payload, list) else results[0]
        await _send_json_response(send, 200, payload_out)

    @staticmethod
    def _dispatch_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any] | None:
        handler = _PAID_MCP_DISPATCH.get(tool_name)
        return handler(arguments) if handler is not None else None


# ─── Helpers ─────────────────────────────────────────────────────────────

async def _read_body(receive: Receive) -> bytes:
    chunks: list[bytes] = []
    more_body = True
    while more_body:
        msg = await receive()
        if msg["type"] != "http.request":
            continue
        chunks.append(msg.get("body", b""))
        more_body = msg.get("more_body", False)
    return b"".join(chunks)


def _jsonrpc_error(req_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": _JSONRPC_VERSION, "id": req_id, "error": {"code": code, "message": message}}


async def _send_json_response(send: Send, status: int, body: Any) -> None:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"content-type", _JSON_CONTENT_TYPE),
            (b"content-length", str(len(data)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": data})


class MCPToolPaymentGate:
    """x402 payment gate for the MCP Streamable HTTP transport.

    Intercepts every request to the registered MCP resources before MCP
    content negotiation. Every unpaid request receives the same standard x402
    challenge, including initialize, discovery, bare probes, and tool calls.
    Public protocol data remains available through separate free REST routes;
    the marketplace-listed ``/mcp`` resource is consistently paid.

    After x402 verifies payment, PaidMCPHandler handles the replay instead of
    the MCP transport, bypassing the SDK's security middleware (which returns
    400/406 for non-standard x402 client headers).
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        payment_settings: PaymentSettings,
    ) -> None:
        self.app = app
        # After x402 verifies payment, it calls PaidMCPHandler instead of the
        # MCP transport. This bypasses the SDK's TransportSecurityMiddleware
        # (Content-Type validation) and Accept-header content negotiation,
        # both of which reject x402 replay clients with 400/406.
        self.payment_app = DeltaZeroPaymentMiddleware(
            PaidMCPHandler(app),
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

        # Only intercept /mcp POST paths.  All other POST routes go straight
        # to the FastAPI app (they are not MCP tool calls).
        if path not in ("/mcp", "/mcp/", "/mcp/call", "/mcp/call/"):
            await self.app(compatible_scope, receive, send)
            return

        _body, replay_receive = await self._buffer_request(receive)
        # One validator-friendly contract: every unpaid marketplace request
        # returns 402; every verified replay reaches the JSON-RPC handler.
        await self.payment_app(compatible_scope, replay_receive, send)

    @staticmethod
    def _with_json_accept_compatibility(scope: Scope) -> Scope:
        """Accept JSON-only MCP clients while preserving the MCP transport.

        The MCP transport requires text/event-stream in Accept headers even
        when json_response=True. x402 replay clients and some MCP tooling
        send only application/json. Patch the scope so free operations through
        the MCP transport don't get a 406 response.
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
