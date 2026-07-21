"""Client-owned Strategy Registry evaluation route."""

from fastapi import APIRouter

from app.models.registry import RegistryEvaluationRequest, RegistryEvaluationResponse
from app.services.strategy_registry import evaluate_strategy_registry


router = APIRouter(prefix="/strategy-registry", tags=["strategy-registry"])


@router.post(
    "/evaluate",
    response_model=RegistryEvaluationResponse,
    summary="Evaluate an opt-in, client-owned recommendation and outcome history",
)
def evaluate_registry(request: RegistryEvaluationRequest) -> RegistryEvaluationResponse:
    return evaluate_strategy_registry(request)
