"""Typed Monte Carlo sensitivity analysis contracts."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.schemas import Asset, RiskTolerance, TargetStyle


class MonteCarloRequest(BaseModel):
    model_config = {"allow_inf_nan": False}

    asset: Asset
    capital_usd: float = Field(gt=0)
    long_notional_usd: float = Field(ge=0)
    short_notional_usd: float = Field(ge=0)
    collateral_usd: float = Field(ge=0)
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float = Field(ge=0)
    risk_tolerance: RiskTolerance
    target_style: TargetStyle
    simulation_count: int = Field(default=1000, ge=100, le=10000)
    time_horizon_days: int = Field(default=30, ge=1, le=365)
    seed: int | None = None
    market_shock_mean_pct: float = Field(default=0, ge=-100, le=100)
    market_shock_volatility_pct: float = Field(default=12, ge=0, le=100)
    funding_shift_mean_apy: float = Field(default=0, ge=-100, le=100)
    funding_shift_volatility_apy: float = Field(default=8, ge=0, le=100)
    slippage_mean_pct: float = Field(default=0.3, ge=0, le=100)
    slippage_volatility_pct: float = Field(default=0.5, ge=0, le=100)
    collateral_haircut_mean_pct: float = Field(default=3, ge=0, le=100)
    collateral_haircut_volatility_pct: float = Field(default=5, ge=0, le=100)
    protocol_loss_mean_pct: float = Field(default=0, ge=0, le=100)
    protocol_loss_volatility_pct: float = Field(default=2, ge=0, le=100)
    systemic_risk_enabled: bool = True
    market_funding_correlation: float = Field(default=-0.55, ge=-0.95, le=0.95)
    market_collateral_correlation: float = Field(default=0.65, ge=-0.95, le=0.95)
    funding_collateral_correlation: float = Field(default=-0.40, ge=-0.95, le=0.95)
    systemic_degrees_of_freedom: int = Field(default=5, ge=3, le=30)
    collateral_depeg_volatility_pct: float = Field(default=4, ge=0, le=100)
    depeg_funding_amplifier: float = Field(default=0.75, ge=0, le=10)
    depeg_slippage_amplifier: float = Field(default=0.20, ge=0, le=10)

    @model_validator(mode="after")
    def validate_correlation_matrix(self) -> "MonteCarloRequest":
        """Require the configured three-factor correlation matrix to be PSD."""

        a = self.market_funding_correlation
        b = self.market_collateral_correlation
        c = self.funding_collateral_correlation
        determinant = 1 + (2 * a * b * c) - (a * a) - (b * b) - (c * c)
        if determinant < -1e-9:
            raise ValueError("The systemic correlation matrix must be positive semidefinite")
        return self


class MonteCarloSummary(BaseModel):
    expected_impairment_loss_usd: float
    expected_impairment_loss_pct: float
    median_impairment_loss_pct: float
    p95_impairment_loss_pct: float
    p99_impairment_loss_pct: float
    worst_case_impairment_loss_pct: float
    expected_post_stress_equity_usd: float
    probability_safety_buffer_breach_pct: float
    probability_hedge_drift_breach_pct: float
    probability_negative_carry_pct: float
    probability_capital_impairment_pct: float
    probability_collateral_depeg_pct: float
    expected_collateral_depeg_pct: float
    monte_carlo_score: float = Field(ge=0, le=100)
    recommendation: Literal["PROCEED", "ADJUST", "AVOID"]


class PercentileValues(BaseModel):
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float
    p99: float


class MonteCarloPercentiles(BaseModel):
    impairment_loss_pct: PercentileValues
    post_stress_equity_usd: PercentileValues


class SensitivityFactor(BaseModel):
    factor: Literal["market_shock", "funding_shift", "slippage", "collateral_haircut", "protocol_loss", "collateral_depeg"]
    contribution_pct: float = Field(ge=0, le=100)
    direction: Literal["positive", "negative", "mixed"]
    explanation: str


class MonteCarloPath(BaseModel):
    path_id: int
    market_shock_pct: float
    funding_shift_apy: float
    slippage_pct: float
    collateral_haircut_pct: float
    protocol_loss_pct: float
    collateral_depeg_pct: float
    impairment_loss_pct: float
    post_stress_equity_usd: float
    safety_buffer_score: float
    hedge_drift_pct: float


class SystemicRiskModel(BaseModel):
    enabled: bool
    distribution: Literal["student_t", "independent_normal"]
    degrees_of_freedom: int | None
    market_funding_correlation: float
    market_collateral_correlation: float
    funding_collateral_correlation: float
    observed_market_funding_correlation: float


class MonteCarloResponse(BaseModel):
    asset: Asset
    simulation_count: int
    time_horizon_days: int
    seed: int | None
    risk_tolerance: RiskTolerance
    target_style: TargetStyle
    summary: MonteCarloSummary
    percentiles: MonteCarloPercentiles
    sensitivity: list[SensitivityFactor]
    sample_paths: list[MonteCarloPath]
    systemic_risk_model: SystemicRiskModel
    generated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
