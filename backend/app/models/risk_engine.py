"""Contracts for the bundled DeltaZero Risk Engine pass."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from app.models.monte_carlo import MonteCarloResponse
from app.models.schemas import (
    Asset,
    AuditResponse,
    BuildResponse,
    RiskTolerance,
    StressTestResponse,
    TargetStyle,
)


class RiskEnginePassRequest(BaseModel):
    """One set of assumptions used across all four coordinated analyses."""

    model_config = {"allow_inf_nan": False}

    asset: Asset
    capital_usd: float = Field(gt=0)
    risk_tolerance: RiskTolerance
    target_style: TargetStyle
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float = Field(ge=0)
    stress_magnitude_pct: float = Field(default=4, ge=0, le=100)
    simulation_count: int = Field(default=1000, ge=100, le=10000)
    time_horizon_days: int = Field(default=30, ge=1, le=365)
    seed: int | None = 42


class RiskEnginePassResponse(BaseModel):
    service: str = "risk_engine_pass"
    pass_scope: str = "one_strategy_analysis"
    strategy_build: BuildResponse
    hedge_drift_audit: AuditResponse
    funding_stress_test: StressTestResponse
    monte_carlo_sensitivity: MonteCarloResponse
    generated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
