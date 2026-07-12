"""Shared request and response models."""

from typing import Literal

from pydantic import BaseModel, Field

from app.config import SUPPORTED_ASSETS, ScenarioType, StrategyAction, StrategyHealth
from app.models.impairment import ImpairmentBreakdown

Asset = Literal["SOL", "ETH"]
RiskTolerance = Literal["low", "medium", "high"]
TargetStyle = Literal[
    "neutral_yield",
    "conservative_income",
    "aggressive_carry",
    "capital_preservation",
]


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
    asset_price_change_pct: float | None = None
    collateral_haircut_pct: float | None = None
    exit_slippage_pct: float | None = None
    liquidation_penalty_pct: float | None = None
    protocol_loss_pct: float | None = None


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
    pre_stress_equity_usd: float
    stressed_liabilities_usd: float
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    impairment_breakdown: ImpairmentBreakdown


class BuildRequest(BaseModel):
    asset: Asset
    capital_usd: float = Field(gt=0)
    risk_tolerance: RiskTolerance
    target_style: TargetStyle
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float = Field(ge=0)
    market_data_mode: Literal["manual", "hyperliquid"] = "manual"
    funding_lookback_hours: int = Field(default=24, ge=1, le=168)
    override_live_funding: bool = False
    market_dex: str | None = None
    wallet_exposure: "WalletExposureImport | None" = None


class WalletExposureImport(BaseModel):
    source: Literal["wallet_auditor"] = "wallet_auditor"
    wallet_address: str
    asset: str | None = None
    gross_long_exposure_usd: float | None = Field(default=None, ge=0)
    gross_short_exposure_usd: float | None = Field(default=None, ge=0)
    net_delta_usd: float | None = None
    net_delta_pct: float | None = None
    current_hedge_ratio: float | None = None
    portfolio_equity_usd: float | None = None
    largest_risk_asset: str | None = None
    recommended_action: Literal["HOLD", "REBALANCE", "REDUCE", "CLOSE"]
    data_quality: Literal["complete", "partial"]
    data_timestamp: str | None = None


class HedgeAdjustment(BaseModel):
    current_long_notional_usd: float | None = None
    current_short_notional_usd: float | None = None
    target_short_notional_usd: float | None = None
    short_adjustment_usd: float | None = None
    target_hedge_ratio: float
    projected_hedge_ratio: float | None = None
    projected_net_delta_usd: float | None = None
    projected_net_delta_pct: float | None = None
    projected_hedge_drift_pct: float | None = None
    adjustment_direction: Literal["increase_short", "reduce_short", "no_change"] | None = None
    limitation: str | None = None


BuildRequest.model_rebuild()


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
    existing_unrealized_pnl_usd: float = 0
    liabilities_usd: float = 0
    scenario: Scenario


class StrategyResponseBase(BaseModel):
    service: str
    strategy_name: str
    asset: Asset
    strategy_health: StrategyHealth
    decision_confidence: int = Field(ge=0, le=100)
    metrics: Metrics
    recommendation: Recommendation
    risk_notes: list[str]


class BuildResponse(StrategyResponseBase):
    recommended_structure: RecommendedStructure
    market_data_source: Literal["hyperliquid"] | None = None
    market_data_timestamp: str | None = None
    funding_rate_apy: float | None = None
    funding_contribution_apy: float | None = None
    market_data_quality: Literal["complete", "partial", "unavailable"] | None = None
    market_context: dict[str, object] | None = None
    hedge_adjustment: HedgeAdjustment | None = None


class AuditResponse(StrategyResponseBase):
    actions: list[StrategyAction]


class StressTestResponse(StrategyResponseBase):
    actions: list[StrategyAction]
    scenario_result: ScenarioResult
    pre_stress_equity_usd: float
    stressed_liabilities_usd: float
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    impairment_breakdown: ImpairmentBreakdown


def validate_asset(asset: str) -> None:
    if asset not in SUPPORTED_ASSETS:
        raise ValueError(f"Unsupported asset: {asset}. Supported: {', '.join(SUPPORTED_ASSETS)}")
