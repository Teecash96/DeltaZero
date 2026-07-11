"""DeltaZero FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.strategy import router as strategy_router

app = FastAPI(
    title="DeltaZero",
    description="Pseudo-delta-neutral DeFi risk management API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://delta-zero-alpha.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategy_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
