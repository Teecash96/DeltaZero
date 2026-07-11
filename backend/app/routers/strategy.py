"""Strategy API routes."""

from fastapi import APIRouter

from app.models.schemas import AuditRequest, AuditResponse, BuildRequest, BuildResponse, StressTestRequest, StressTestResponse
from app.services.auditor import audit_strategy
from app.services.builder import build_strategy
from app.services.stress_test import stress_test_strategy

router = APIRouter(prefix="/strategy", tags=["strategy"])


@router.post("/build", response_model=BuildResponse)
def strategy_build(request: BuildRequest) -> BuildResponse:
    return build_strategy(request)


@router.post("/audit", response_model=AuditResponse)
def strategy_audit(request: AuditRequest) -> AuditResponse:
    return audit_strategy(request)


@router.post("/stress-test", response_model=StressTestResponse)
def strategy_stress_test(request: StressTestRequest) -> StressTestResponse:
    return stress_test_strategy(request)
