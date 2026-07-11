"""Shared request and response models."""

from typing import Literal

from pydantic import BaseModel, Field

from app.config import SUPPORTED_ASSETS, ScenarioType, StrategyAction, StrategyHealth

Asset = Literal["SOL", "ETH"]
RiskTolerance = Literal["low", "medium", "high"]
TargetStyle = Literal["neutral_yield"]


class Metrics(BaseModel):
    hedge_ratio: float
    hedge_drift_pct: float
    net_delta_estimate: float
    estimated_net_carry_apy: float
    carry_efficiency_score: float
    safety_buffer_score: float
    capital_at_risk_proxy: float


class Recommendation(BaseModel):
    action: StrategyAction
    summary: str


class RecommendedStructure(BaseModel):
    long_notional_usd: float
    short_notional_usd: float
    collateral_usd: float
    target_hedge_ratio: float


class Scenario(BaseModel):
    type: ScenarioType
    magnitude_pct: float = Field(ge=0)


class ScenarioResult(BaseModel):
    scenario_type: ScenarioType
    magnitude_pct: float
    stressed_long_notional_usd: float
    stressed_short_notional_usd: float
    stressed_collateral_usd: float
    stressed_long_yield_apy: float
    stressed_short_funding_apy: float
    stressed_metrics: Metrics
    health_after_stress: StrategyHealth


class BuildRequest(BaseModel):
    asset: Asset
    capital_usd: float = Field(gt=0)
    risk_tolerance: RiskTolerance
    target_style: TargetStyle
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float = Field(ge=0)


class AuditRequest(BaseModel):
    asset: Asset
    long_notional_usd: float = Field(gt=0)
    short_notional_usd: float = Field(ge=0)
    collateral_usd: float = Field(ge=0)
    risk_tolerance: RiskTolerance
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float = Field(ge=0)


class StressTestRequest(BaseModel):
    asset: Asset
    long_notional_usd: float = Field(gt=0)
    short_notional_usd: float = Field(ge=0)
    collateral_usd: float = Field(ge=0)
    risk_tolerance: RiskTolerance
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float = Field(ge=0)
    scenario: Scenario


class StrategyResponseBase(BaseModel):
    service: str
    strategy_name: str
    asset: Asset
    strategy_health: StrategyHealth
    metrics: Metrics
    recommendation: Recommendation
    risk_notes: list[str]


class BuildResponse(StrategyResponseBase):
    recommended_structure: RecommendedStructure


class AuditResponse(StrategyResponseBase):
    actions: list[StrategyAction]


class StressTestResponse(StrategyResponseBase):
    actions: list[StrategyAction]
    scenario_result: ScenarioResult


def validate_asset(asset: str) -> None:
    if asset not in SUPPORTED_ASSETS:
        raise ValueError(f"Unsupported asset: {asset}. Supported: {', '.join(SUPPORTED_ASSETS)}")
