"""Bundled Risk Engine API route."""

from fastapi import APIRouter

from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse
from app.services.risk_engine import run_risk_engine_pass

router = APIRouter(prefix="/risk-engine", tags=["risk-engine"])


@router.post("/analyze", response_model=RiskEnginePassResponse)
def risk_engine_analyze(request: RiskEnginePassRequest) -> RiskEnginePassResponse:
    """Return all four premium reports after one x402 payment."""

    return run_risk_engine_pass(request)
