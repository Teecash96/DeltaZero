"""DeltaZero FastAPI and MCP application entry point."""

from contextlib import asynccontextmanager
import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from x402.server import x402ResourceServer

from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse
from app.payments import DeltaZeroPaymentMiddleware, PaymentSettings, create_payment_server, paid_routes
from app.routers.market import router as market_router
from app.routers.monte_carlo import router as monte_carlo_router
from app.routers.risk_engine import router as risk_engine_router
from app.routers.registry import router as registry_router
from app.routers.preview import router as preview_router
from app.routers.standards import evaluation_router as envelope_router, router as standards_router
from app.routers.strategy import router as strategy_router, stress_router
from app.routers.wallet import router as wallet_router
from app.mcp_server import MCPToolPaymentGate, create_mcp_server
from app.services.risk_engine import run_risk_engine_pass
from app.services.builder import build_strategy
from app.services.auditor import audit_strategy
from app.services.stress_test import stress_test_strategy
from app.services.monte_carlo import run_monte_carlo as run_monte_carlo_analysis
from app.services.market_data import get_hyperliquid_market
from app.services.strategy_registry import evaluate_strategy_registry
from app.models.schemas import AuditRequest, BuildRequest, StressTestRequest
from app.models.monte_carlo import MonteCarloRequest
from app.models.registry import RegistryEvaluationRequest


A2MCP_REVIEW_PROBE = RiskEnginePassRequest(
    asset="SOL",
    capital_usd=5000,
    risk_tolerance="medium",
    target_style="neutral_yield",
    long_yield_apy=14,
    short_funding_apy=3,
    fee_drag_apy=1,
    stress_magnitude_pct=4,
    simulation_count=100,
    time_horizon_days=30,
    seed=42,
)


# ─── A2MCP tool dispatch table ──────────────────────────────────────────
# Maps tool names to handler functions for the /mcp/call endpoint.

def _call_risk_engine(args: dict[str, Any]) -> dict[str, Any]:
    req = RiskEnginePassRequest(**args) if args else A2MCP_REVIEW_PROBE
    return run_risk_engine_pass(req).model_dump(mode="json", exclude_none=True)


def _call_build(args: dict[str, Any]) -> dict[str, Any]:
    return build_strategy(BuildRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_audit(args: dict[str, Any]) -> dict[str, Any]:
    return audit_strategy(AuditRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_stress(args: dict[str, Any]) -> dict[str, Any]:
    return stress_test_strategy(StressTestRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_monte_carlo(args: dict[str, Any]) -> dict[str, Any]:
    return run_monte_carlo_analysis(MonteCarloRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_market(args: dict[str, Any]) -> dict[str, Any]:
    asset = args.get("asset", "SOL")
    lookback = args.get("lookback_hours", 24)
    dex = args.get("dex")
    return get_hyperliquid_market(asset, dex, lookback).model_dump(mode="json", exclude_none=True)


def _call_registry(args: dict[str, Any]) -> dict[str, Any]:
    return evaluate_strategy_registry(RegistryEvaluationRequest(**args)).model_dump(mode="json", exclude_none=True)


def _call_risk_envelope(args: dict[str, Any]) -> dict[str, Any]:
    req = RiskEnginePassRequest(**args) if args else A2MCP_REVIEW_PROBE
    return run_risk_engine_pass(req).risk_envelope.model_dump(mode="json", exclude_none=True)


_MCP_TOOL_DISPATCH: dict[str, Any] = {
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


def _dispatch_mcp_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any] | None:
    """Dispatch a tool call to the appropriate handler. Returns None if unknown."""
    handler = _MCP_TOOL_DISPATCH.get(tool_name)
    if handler is None:
        return None
    return handler(arguments)


def load_runtime_payment_settings() -> PaymentSettings | None:
    """Return paid settings only when production payment enforcement is enabled.

    DeltaZero defaults to temporary free access during the OKX.AI listing
    process. Setting ``DELTAZERO_ACCESS_MODE=paid`` restores the existing
    payment middleware without a code change.
    """

    access_mode = os.getenv("DELTAZERO_ACCESS_MODE", "free").strip().lower()
    if access_mode == "free":
        return None
    if access_mode == "paid":
        return PaymentSettings.from_environment()
    raise RuntimeError("DELTAZERO_ACCESS_MODE must be either 'free' or 'paid'")


def load_mcp_payment_settings() -> PaymentSettings | None:
    """Return payment settings for the MCP x402 gate.

    The MCP endpoint must always be x402-compliant for OKX.AI A2MCP listing,
    regardless of whether the REST routes are in free or paid mode.  This
    loads the same PAYMENT_* environment variables.  When they are absent
    (local development), returns None and the MCP gate is skipped.
    """

    # If full paid mode is active, reuse those settings.
    access_mode = os.getenv("DELTAZERO_ACCESS_MODE", "free").strip().lower()
    if access_mode == "paid":
        return PaymentSettings.from_environment()

    # Even in free mode, load payment settings for the MCP x402 gate if
    # the required variables are present.
    try:
        return PaymentSettings.from_environment()
    except RuntimeError:
        return None


def create_app(
    payment_settings: PaymentSettings | None = None,
    payment_server: x402ResourceServer | None = None,
    mcp_payment_settings: PaymentSettings | None = None,
) -> FastAPI:
    """Create the API, optionally protecting paid resources with x402.

    The MCP x402 gate is always active when ``mcp_payment_settings`` (or
    ``payment_settings``) is available, ensuring the /mcp endpoint returns
    HTTP 402 for unpaid requests as required by OKX.AI A2MCP listing.
    """

    mcp_server = create_mcp_server()
    mcp_application = mcp_server.streamable_http_app()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        async with mcp_application.router.lifespan_context(mcp_application):
            yield

    application = FastAPI(
        title="DeltaZero",
        description="Pseudo-delta-neutral DeFi risk management API",
        version="0.1.0",
        lifespan=lifespan,
    )
    application.state.payment_settings = payment_settings

    # Resolve MCP payment settings: prefer explicit, fall back to REST settings.
    effective_mcp_settings = mcp_payment_settings or payment_settings

    if payment_settings is not None:
        application.add_middleware(
            DeltaZeroPaymentMiddleware,
            routes=paid_routes(payment_settings),
            server=payment_server or create_payment_server(payment_settings),
            admin_key=payment_settings.admin_key,
        )

    # The MCP x402 gate is ALWAYS active when payment settings are available,
    # independent of DELTAZERO_ACCESS_MODE.  This ensures OKX's x402 probe
    # receives HTTP 402 (not 406 from MCP content negotiation).
    if effective_mcp_settings is not None:
        application.add_middleware(
            MCPToolPaymentGate,
            payment_settings=effective_mcp_settings,
        )

    # CORS is registered after x402 so browser clients can read payment headers
    # on both 402 challenges and successful settled responses.
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://delta-zero-alpha.vercel.app",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "PAYMENT-REQUIRED",
            "PAYMENT-RESPONSE",
            "Mcp-Session-Id",
            "Mcp-Protocol-Version",
        ],
    )

    application.include_router(strategy_router)
    application.include_router(stress_router)
    application.include_router(wallet_router)
    application.include_router(market_router)
    application.include_router(monte_carlo_router)
    application.include_router(risk_engine_router)
    application.include_router(registry_router)
    application.include_router(preview_router)
    application.include_router(standards_router)
    application.include_router(envelope_router)
    # Reuse the SDK's exact /mcp route without Starlette's mount redirect.
    application.router.routes.extend(mcp_application.routes)

    @application.get("/")
    def root() -> dict[str, str]:
        public_base_url = (
            payment_settings.public_api_base_url
            if payment_settings
            else "https://deltazero-production.up.railway.app"
        )
        return {
            "service": "DeltaZero Risk Engine",
            "status": "ok",
            "service_type": "A2MCP",
            "a2mcp_endpoint": f"{public_base_url}/mcp",
            "mcp_endpoint": f"{public_base_url}/mcp",
        }

    @application.post(
        "/",
        response_model=RiskEnginePassResponse,
        tags=["risk-engine"],
        summary="Run the complete DeltaZero Risk Engine pass",
    )
    def a2mcp_risk_engine(
        request: RiskEnginePassRequest | None = None,
    ) -> RiskEnginePassResponse:
        """Run a submitted analysis or a deterministic listing-review probe.

        OKX's free-service self-check performs a bare POST against the exact
        registered endpoint. Returning the documented reference scenario for
        that probe keeps the service directly testable while normal callers
        can continue to submit their own complete input object.
        """

        return run_risk_engine_pass(request or A2MCP_REVIEW_PROBE)

    @application.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    # ─── A2MCP direct tool-call endpoint ────────────────────────────────
    # OKX's A2MCP client POSTs to /mcp/call with a simplified body:
    #   {"tool": "run_complete_risk_engine", "arguments": {...}}
    # This is protected by the MCPToolPaymentGate (x402 402 for unpaid).
    @application.post("/mcp/call", tags=["a2mcp"])
    async def mcp_call(request: Request) -> JSONResponse:
        """Direct A2MCP tool invocation — returns the tool result as JSON."""
        try:
            body = await request.json()
        except Exception:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid JSON body"},
            )

        tool_name = body.get("tool") or body.get("name") or ""
        arguments = body.get("arguments") or body.get("params") or {}

        # Dispatch to the appropriate service function.
        result = _dispatch_mcp_tool(tool_name, arguments)
        if result is None:
            return JSONResponse(
                status_code=400,
                content={"error": f"Unknown tool: {tool_name}", "available_tools": sorted(_MCP_TOOL_DISPATCH.keys())},
            )
        return JSONResponse(content={"tool": tool_name, "result": result})

    return application


app = create_app(
    payment_settings=load_runtime_payment_settings(),
    mcp_payment_settings=load_mcp_payment_settings(),
)
