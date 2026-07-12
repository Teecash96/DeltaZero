"""Scenario-based economic impairment models."""

from pydantic import BaseModel


class ImpairmentBreakdown(BaseModel):
    asset_value_impact_usd: float
    hedge_pnl_impact_usd: float
    collateral_haircut_usd: float
    exit_slippage_usd: float
    liquidation_penalty_usd: float
    protocol_loss_assumption_usd: float


class ImpairmentResult(BaseModel):
    pre_stress_equity_usd: float
    post_stress_equity_usd: float
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    impairment_breakdown: ImpairmentBreakdown
