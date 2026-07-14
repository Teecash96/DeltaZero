"""DeltaZero FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from x402.server import x402ResourceServer

from app.payments import DeltaZeroPaymentMiddleware, PaymentSettings, create_payment_server, paid_routes
from app.routers.market import router as market_router
from app.routers.monte_carlo import router as monte_carlo_router
from app.routers.strategy import router as strategy_router
from app.routers.wallet import router as wallet_router


def create_app(
    payment_settings: PaymentSettings | None = None,
    payment_server: x402ResourceServer | None = None,
) -> FastAPI:
    """Create the API, optionally protecting paid resources with x402."""

    application = FastAPI(
        title="DeltaZero",
        description="Pseudo-delta-neutral DeFi risk management API",
        version="0.1.0",
    )

    if payment_settings is not None:
        application.add_middleware(
            DeltaZeroPaymentMiddleware,
            routes=paid_routes(payment_settings),
            server=payment_server or create_payment_server(payment_settings),
            admin_key=payment_settings.admin_key,
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
        expose_headers=["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
    )

    application.include_router(strategy_router)
    application.include_router(wallet_router)
    application.include_router(market_router)
    application.include_router(monte_carlo_router)

    @application.get("/")
    def root() -> dict[str, str]:
        return {"service": "DeltaZero", "status": "ok"}

    @application.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app(payment_settings=PaymentSettings.from_environment())
