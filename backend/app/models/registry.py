"""Client-owned Strategy Registry contracts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


OutcomeStatus = Literal[
    "avoided_loss",
    "within_tolerance",
    "exceeded_risk",
    "not_executed",
    "incomplete",
]


class RegistryDecision(BaseModel):
    decision_id: str = Field(min_length=1, max_length=120)
    asset: str = Field(min_length=1, max_length=24)
    recommendation: str = Field(min_length=1, max_length=40)
    generated_at: datetime
    safety_buffer: float | None = Field(default=None, ge=0, le=100)
    p95_impairment_pct: float | None = Field(default=None, ge=0, le=100)
    outcome_status: OutcomeStatus | None = None
    observed_at: datetime | None = None
    realized_return_pct: float | None = Field(default=None, ge=-100, le=10000)
    max_drawdown_pct: float | None = Field(default=None, ge=0, le=100)
    final_safety_buffer: float | None = Field(default=None, ge=0, le=100)


class RegistryEvaluationRequest(BaseModel):
    decisions: list[RegistryDecision] = Field(min_length=1, max_length=100)


class RegistryEvaluationResponse(BaseModel):
    service: Literal["deltazero_strategy_registry"] = "deltazero_strategy_registry"
    decision_count: int
    observed_count: int
    outcome_coverage_pct: float
    exceeded_risk_count: int
    exceeded_risk_rate_pct: float
    average_realized_return_pct: float | None
    average_max_drawdown_pct: float | None
    average_final_safety_buffer: float | None
    outcome_breakdown: dict[str, int]
    refinement_signals: list[str]
    limitations: list[str]
