"""Strategy API routes."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import AuditRequest, AuditResponse, BuildRequest, BuildResponse, StressTestRequest, StressTestResponse
from app.services.auditor import audit_strategy
from app.services.builder import build_strategy
from app.services.stress_test import stress_test_strategy
from app.services.market_data import MarketDataError, UnknownMarketError

router = APIRouter(prefix="/strategy", tags=["strategy"])


@router.post("/build", response_model=BuildResponse, response_model_exclude_none=True)
def strategy_build(request: BuildRequest) -> BuildResponse:
    try:
        return build_strategy(request)
    except UnknownMarketError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/audit", response_model=AuditResponse)
def strategy_audit(request: AuditRequest) -> AuditResponse:
    return audit_strategy(request)


@router.post("/stress-test", response_model=StressTestResponse)
def strategy_stress_test(request: StressTestRequest) -> StressTestResponse:
    return stress_test_strategy(request)
