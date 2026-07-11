"""Deterministic strategy metric calculations."""

from app.config import MIN_MARGIN_RATIO
from app.models.schemas import Metrics


def compute_metrics(
    long_notional_usd: float,
    short_notional_usd: float,
    collateral_usd: float,
    long_yield_apy: float,
    short_funding_apy: float,
    fee_drag_apy: float,
) -> Metrics:
    """Compute heuristic strategy metrics from position inputs."""
    hedge_ratio = (
        round(short_notional_usd / long_notional_usd, 4)
        if long_notional_usd > 0
        else 0.0
    )
    hedge_drift_pct = round(abs(1.0 - hedge_ratio) * 100, 2)

    net_delta_estimate = (
        round((long_notional_usd - short_notional_usd) / long_notional_usd * 100, 2)
        if long_notional_usd > 0
        else 0.0
    )

    hedge_weight = (
        min(long_notional_usd, short_notional_usd) / long_notional_usd
        if long_notional_usd > 0
        else 0.0
    )
    estimated_net_carry_apy = round(
        long_yield_apy - (short_funding_apy * hedge_weight) - fee_drag_apy,
        2,
    )

    margin_ratio = (
        collateral_usd / short_notional_usd if short_notional_usd > 0 else 0.0
    )
    # Safety Buffer score: collateral coverage relative to short exposure.
    safety_buffer_score = round(min(100.0, margin_ratio * 200.0), 2)

    carry_efficiency_score = round(
        max(0.0, min(100.0, (estimated_net_carry_apy / 20.0) * 100.0)),
        2,
    )

    unhedged_notional = abs(long_notional_usd - short_notional_usd)
    min_margin_required = short_notional_usd * MIN_MARGIN_RATIO
    margin_deficit = max(0.0, min_margin_required - collateral_usd)
    capital_at_risk_proxy = round(unhedged_notional + margin_deficit, 2)

    return Metrics(
        hedge_ratio=hedge_ratio,
        hedge_drift_pct=hedge_drift_pct,
        net_delta_estimate=net_delta_estimate,
        estimated_net_carry_apy=estimated_net_carry_apy,
        carry_efficiency_score=carry_efficiency_score,
        safety_buffer_score=safety_buffer_score,
        capital_at_risk_proxy=capital_at_risk_proxy,
    )
