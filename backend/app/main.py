"""DeltaZero FastAPI and MCP application entry point."""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

    return application


app = create_app(
    payment_settings=load_runtime_payment_settings(),
    mcp_payment_settings=load_mcp_payment_settings(),
)
