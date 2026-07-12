"""Scenario-based economic impairment calculations."""

from dataclasses import dataclass

from app.config import IMPAIRMENT_DEFAULTS
from app.models.impairment import ImpairmentBreakdown, ImpairmentResult


@dataclass(frozen=True)
class ImpairmentInputs:
    long_notional_usd: float
    short_notional_usd: float
    collateral_usd: float
    existing_unrealized_pnl_usd: float = 0.0
    liabilities_usd: float = 0.0
    asset_price_change_pct: float = 0.0
    collateral_haircut_pct: float = 0.0
    exit_slippage_pct: float = 0.0
    liquidation_penalty_pct: float = 0.0
    protocol_loss_pct: float = 0.0


def resolve_impairment_inputs(
    scenario_type: str,
    magnitude_pct: float,
    *,
    asset_price_change_pct: float | None = None,
    collateral_haircut_pct: float | None = None,
    exit_slippage_pct: float | None = None,
    liquidation_penalty_pct: float | None = None,
    protocol_loss_pct: float | None = None,
) -> ImpairmentInputs:
    """Resolve a deterministic impairment profile for the supplied scenario."""
    defaults = IMPAIRMENT_DEFAULTS.get(scenario_type, IMPAIRMENT_DEFAULTS["yield_drops"])
    price_change = (
        asset_price_change_pct
        if asset_price_change_pct is not None
        else defaults["asset_price_change_pct"] if scenario_type in {"funding_worsens", "yield_drops"} else defaults["asset_price_change_pct"]
    )
    if scenario_type == "price_drop" and asset_price_change_pct is None:
        price_change = -abs(magnitude_pct)
    elif scenario_type == "price_rise" and asset_price_change_pct is None:
        price_change = abs(magnitude_pct)

    return ImpairmentInputs(
        long_notional_usd=0.0,
        short_notional_usd=0.0,
        collateral_usd=0.0,
        asset_price_change_pct=price_change,
        collateral_haircut_pct=collateral_haircut_pct if collateral_haircut_pct is not None else defaults["collateral_haircut_pct"],
        exit_slippage_pct=exit_slippage_pct if exit_slippage_pct is not None else defaults["exit_slippage_pct"],
        liquidation_penalty_pct=liquidation_penalty_pct if liquidation_penalty_pct is not None else defaults["liquidation_penalty_pct"],
        protocol_loss_pct=protocol_loss_pct if protocol_loss_pct is not None else defaults["protocol_loss_pct"],
    )


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(upper, value))


def calculate_impairment(
    *,
    long_notional_usd: float,
    short_notional_usd: float,
    collateral_usd: float,
    existing_unrealized_pnl_usd: float = 0.0,
    liabilities_usd: float = 0.0,
    asset_price_change_pct: float = 0.0,
    collateral_haircut_pct: float = 0.0,
    exit_slippage_pct: float = 0.0,
    liquidation_penalty_pct: float = 0.0,
    protocol_loss_pct: float = 0.0,
) -> ImpairmentResult:
    """Compute scenario-based economic impairment from a portfolio-equity view."""
    price_multiplier = 1.0 + (asset_price_change_pct / 100.0)
    stressed_long_value_usd = max(0.0, long_notional_usd * price_multiplier)
    stressed_short_pnl_usd = short_notional_usd * (-asset_price_change_pct / 100.0)
    stressed_collateral_value_usd = max(
        0.0,
        collateral_usd * (1.0 - (collateral_haircut_pct / 100.0)),
    )
    stressed_liabilities_usd = max(0.0, liabilities_usd)

    asset_value_impact_usd = round(max(0.0, long_notional_usd - stressed_long_value_usd), 2)
    hedge_pnl_impact_usd = round(max(0.0, -stressed_short_pnl_usd), 2)
    collateral_haircut_usd = round(max(0.0, collateral_usd - stressed_collateral_value_usd), 2)
    exit_slippage_base = long_notional_usd + short_notional_usd
    exit_slippage_usd = round(max(0.0, exit_slippage_base * (exit_slippage_pct / 100.0)), 2)
    liquidation_penalty_base_usd = max(0.0, long_notional_usd + short_notional_usd - collateral_usd)
    liquidation_penalty_usd = round(max(0.0, liquidation_penalty_base_usd * (liquidation_penalty_pct / 100.0)), 2)
    protocol_loss_assumption_usd = round(max(0.0, collateral_usd * (protocol_loss_pct / 100.0)), 2)

    pre_stress_equity_usd = round(
        long_notional_usd + collateral_usd + existing_unrealized_pnl_usd - liabilities_usd,
        2,
    )
    post_stress_equity_usd = round(
        stressed_long_value_usd
        + stressed_short_pnl_usd
        + stressed_collateral_value_usd
        + existing_unrealized_pnl_usd
        - stressed_liabilities_usd
        - exit_slippage_usd
        - liquidation_penalty_usd
        - protocol_loss_assumption_usd,
        2,
    )
    estimated_impairment_loss_usd = round(max(0.0, pre_stress_equity_usd - post_stress_equity_usd), 2)
    estimated_impairment_loss_pct = round(
        _clamp((estimated_impairment_loss_usd / pre_stress_equity_usd) * 100.0 if pre_stress_equity_usd > 0 else (100.0 if estimated_impairment_loss_usd > 0 else 0.0)),
        2,
    )
    post_impairment_equity_usd = round(max(0.0, post_stress_equity_usd), 2)

    return ImpairmentResult(
        pre_stress_equity_usd=pre_stress_equity_usd,
        post_stress_equity_usd=post_stress_equity_usd,
        estimated_impairment_loss_usd=estimated_impairment_loss_usd,
        estimated_impairment_loss_pct=estimated_impairment_loss_pct,
        post_impairment_equity_usd=post_impairment_equity_usd,
        impairment_breakdown=ImpairmentBreakdown(
            asset_value_impact_usd=asset_value_impact_usd,
            hedge_pnl_impact_usd=hedge_pnl_impact_usd,
            collateral_haircut_usd=collateral_haircut_usd,
            exit_slippage_usd=exit_slippage_usd,
            liquidation_penalty_usd=liquidation_penalty_usd,
            protocol_loss_assumption_usd=protocol_loss_assumption_usd,
        ),
    )
