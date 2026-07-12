"""Deterministic institutional wallet-report explanations and aggregations."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from app.config import DecisionProfile, WalletRiskProfile
from app.models.wallet import (
    NormalizedPosition,
    WalletAllocationItem,
    WalletExecutiveSummary,
    WalletExposureAnalysis,
    WalletPlanStep,
    WalletPortfolioSummary,
    WalletPrimaryDriver,
    WalletRiskMetrics,
    WalletStrategyHealth,
    WalletStressProfile,
    WalletStressSummary,
)


@dataclass(frozen=True)
class WalletIntelligenceReport:
    executive_summary: WalletExecutiveSummary
    primary_drivers: list[WalletPrimaryDriver]
    recommended_plan: list[WalletPlanStep]
    exposure_analysis: WalletExposureAnalysis
    portfolio_allocation: list[WalletAllocationItem]
    stress_summary: WalletStressSummary


LONG_TYPES = {"spot", "lending_supply", "vault_deposit", "perpetual_long", "collateral"}
SHORT_TYPES = {"perpetual_short", "lending_borrow"}
ASSET_EQUITY_TYPES = {"spot", "lending_supply", "vault_deposit", "collateral"}


def _position_exposure(position: NormalizedPosition) -> float | None:
    """Return one directional exposure value without adding collateral twice.

    Derivatives and borrows use notional. Cash, lending supply, vault, and
    collateral positions use current value. Collateral attached to a position
    is excluded here because it supports equity rather than directional gross
    exposure.
    """
    value = (
        position.notional_usd
        if position.position_type in {"perpetual_long", "perpetual_short", "lending_borrow"}
        else position.current_value_usd
    )
    return abs(value) if value is not None else None


def calculate_exposure_analysis(positions: list[NormalizedPosition]) -> WalletExposureAnalysis:
    long_exposure = 0.0
    short_exposure = 0.0
    equity = 0.0
    equity_reliable = bool(positions)

    for position in positions:
        exposure = _position_exposure(position)
        if exposure is not None:
            if position.position_type in LONG_TYPES:
                long_exposure += exposure
            elif position.position_type in SHORT_TYPES:
                short_exposure += exposure

        # Portfolio equity is assets plus derivative collateral and reliable
        # unrealized PnL, less lending debt. Values that cannot be established
        # from the normalized position invalidate equity rather than becoming 0.
        if position.position_type in ASSET_EQUITY_TYPES:
            if position.current_value_usd is None:
                equity_reliable = False
            else:
                equity += position.current_value_usd
        elif position.position_type in {"perpetual_long", "perpetual_short"}:
            if position.collateral_usd is None or position.unrealized_pnl_usd is None:
                equity_reliable = False
            else:
                equity += position.collateral_usd + position.unrealized_pnl_usd
        elif position.position_type == "lending_borrow":
            if position.debt_usd is None:
                equity_reliable = False
            else:
                equity -= position.debt_usd
        else:
            equity_reliable = False

    gross = long_exposure + short_exposure
    net_delta = long_exposure - short_exposure
    net_delta_pct = (net_delta / gross * 100.0) if gross > 0 else 0.0
    portfolio_equity = round(equity, 2) if equity_reliable else None
    leverage = round(gross / portfolio_equity, 2) if portfolio_equity is not None and portfolio_equity > 0 else None
    return WalletExposureAnalysis(
        gross_exposure_usd=round(gross, 2),
        gross_long_exposure_usd=round(long_exposure, 2),
        gross_short_exposure_usd=round(short_exposure, 2),
        net_delta_usd=round(net_delta, 2),
        net_delta_pct=round(net_delta_pct, 2),
        portfolio_equity_usd=portfolio_equity,
        leverage_ratio=leverage,
        position_count=len(positions),
    )


def calculate_portfolio_allocation(positions: list[NormalizedPosition]) -> list[WalletAllocationItem]:
    by_asset: dict[str, float] = defaultdict(float)
    for position in positions:
        exposure = _position_exposure(position)
        if exposure is not None and exposure > 0:
            by_asset[position.asset.upper()] += exposure
    total = sum(by_asset.values())
    if total <= 0:
        return []

    ranked = sorted(by_asset.items(), key=lambda item: (-item[1], item[0]))
    visible = ranked[:8]
    remainder = sum(value for _, value in ranked[8:])
    if remainder > 0:
        visible.append(("Other", remainder))
    return [
        WalletAllocationItem(
            asset=asset,
            exposure_usd=round(exposure, 2),
            allocation_pct=round(exposure / total * 100.0, 2),
        )
        for asset, exposure in visible
    ]


def _driver(
    metric: str,
    label: str,
    state: str,
    value: float | str | None,
    unit: str | None,
    explanation: str,
) -> WalletPrimaryDriver:
    return WalletPrimaryDriver(
        metric=metric,
        label=label,
        state=state,  # type: ignore[arg-type]
        value=value,
        unit=unit,
        explanation=explanation,
    )


def build_primary_drivers(
    *,
    summary: WalletPortfolioSummary,
    risk: WalletRiskMetrics,
    data_quality: str,
    profile: DecisionProfile,
    wallet_profile: WalletRiskProfile,
    hedge_state: str,
    safety_state: str,
    capital_state: str,
    impairment_state: str,
) -> list[WalletPrimaryDriver]:
    drivers: list[WalletPrimaryDriver] = []
    impairment = risk.estimated_impairment_loss_pct
    if impairment is None:
        drivers.append(_driver("estimated_impairment_loss_pct", "Impairment risk", "unavailable", None, "%", "Estimated impairment is unavailable from the retrieved positions."))
    else:
        state = "critical" if impairment_state == "severe" else "warning" if impairment_state == "material" else "positive"
        explanation = (
            "Estimated impairment exceeds the severe configured limit."
            if state == "critical"
            else "Estimated impairment is above the configured warning limit."
            if state == "warning"
            else "Estimated impairment remains within the configured limit."
        )
        drivers.append(_driver("estimated_impairment_loss_pct", "Impairment risk", state, impairment, "%", explanation))

    safety = risk.safety_buffer_score
    if safety is None:
        drivers.append(_driver("safety_buffer_score", "Safety Buffer", "unavailable", None, "/ 100", "Safety Buffer could not be calculated from the available collateral data."))
    else:
        state = "critical" if safety_state == "weak" else "warning" if safety_state == "watch" else "positive"
        explanation = (
            f"Safety Buffer is below the configured critical level of {profile.safety_buffer_critical:.0f}."
            if state == "critical"
            else f"Safety Buffer is below the preferred level of {profile.safety_buffer_warning:.0f}."
            if state == "warning"
            else "Safety Buffer is adequate under the selected stress profile."
        )
        drivers.append(_driver("safety_buffer_score", "Safety Buffer", state, safety, "/ 100", explanation))

    drift = risk.hedge_drift_pct
    if drift is None:
        drivers.append(_driver("hedge_drift_pct", "Hedge alignment", "unavailable", None, "%", "Hedge drift is unavailable because a supported long/short relationship could not be established."))
    else:
        state = "critical" if hedge_state == "severe" else "warning" if hedge_state == "watch" else "positive"
        explanation = (
            "Hedge drift exceeds the configured critical tolerance."
            if state == "critical"
            else "Hedge drift is outside the preferred tolerance."
            if state == "warning"
            else "Hedge drift is within the configured tolerance."
        )
        drivers.append(_driver("hedge_drift_pct", "Hedge alignment", state, drift, "%", explanation))

    net_delta = summary.net_delta_pct
    delta_abs = abs(net_delta)
    delta_state = "critical" if delta_abs >= profile.hedge_drift_critical_pct else "warning" if delta_abs >= profile.hedge_drift_warning_pct else "positive"
    drivers.append(
        _driver(
            "net_delta_pct",
            "Directional exposure",
            delta_state,
            net_delta,
            "%",
            "Net delta exceeds the configured directional tolerance." if delta_state != "positive" else "Net directional exposure is within the configured tolerance.",
        )
    )

    capital_risk = risk.capital_at_risk_proxy
    if capital_risk is None:
        drivers.append(_driver("capital_at_risk_proxy", "Capital at risk", "unavailable", None, "USD", "Capital at risk could not be established from the retrieved positions."))
    else:
        capital_driver_state = "critical" if capital_state == "severe" else "warning" if capital_state == "elevated" else "positive"
        drivers.append(
            _driver(
                "capital_at_risk_proxy",
                "Capital at risk",
                capital_driver_state,
                capital_risk,
                "USD",
                "Capital exposure exceeds the configured critical limit." if capital_driver_state == "critical" else "Capital exposure is above the configured warning limit." if capital_driver_state == "warning" else "Capital exposure remains within the configured limit.",
            )
        )

    if risk.minimum_health_factor is not None:
        factor = risk.minimum_health_factor
        factor_state = "critical" if factor < wallet_profile.minimum_health_factor else "warning" if factor < wallet_profile.minimum_health_factor + 0.3 else "positive"
        drivers.append(
            _driver(
                "minimum_health_factor",
                "Collateral health",
                factor_state,
                factor,
                None,
                "Minimum health factor is below the configured requirement." if factor_state == "critical" else "Minimum health factor is close to the configured limit." if factor_state == "warning" else "Reported health factors remain above the configured requirement.",
            )
        )
    elif risk.liquidation_proximity_pct is None:
        drivers.append(_driver("minimum_health_factor", "Collateral health", "unavailable", None, None, "A protocol health factor was not available for the retrieved positions."))

    if data_quality == "partial":
        drivers.append(_driver("data_quality", "Portfolio coverage", "warning", "partial", None, "One or more selected sources were unavailable, so coverage is incomplete."))

    # Keep the most decision-relevant severe/warning facts first while
    # retaining positive and unavailable context. The UI receives 3–6 rows.
    order = {"critical": 0, "warning": 1, "positive": 2, "unavailable": 3}
    return sorted(drivers, key=lambda item: order[item.state])[:6]


def build_recommended_plan(action: str, profile: DecisionProfile) -> list[WalletPlanStep]:
    hedge_target = f"Target hedge ratio: {max(0.0, profile.target_hedge_ratio - 0.02):.2f} to {min(1.0, profile.target_hedge_ratio + 0.03):.2f}."
    delta_target = f"Target net delta: below {profile.hedge_drift_warning_pct:.0f}% of gross exposure."
    safety_target = f"Minimum Safety Buffer: {profile.safety_buffer_warning:.0f}."
    plans: dict[str, list[tuple[str, str, str | None]]] = {
        "HOLD": [
            ("Continue risk monitoring", "The retrieved metrics currently support maintaining the portfolio.", "Monitor funding, hedge drift, and collateral health."),
            ("Preserve hedge alignment", "Directional exposure is currently within tolerance.", hedge_target),
        ],
        "REBALANCE": [
            ("Reduce net directional exposure", "Hedge drift or net delta is outside the configured tolerance.", delta_target),
            ("Restore hedge alignment", "The long and short exposures should be brought closer to the configured relationship.", hedge_target),
            ("Review largest exposures first", "The largest assets contribute most to current gross exposure.", None),
        ],
        "REDUCE": [
            ("Lower gross exposure", "Capital, collateral, or impairment risk is beyond the configured warning range.", None),
            ("Strengthen collateral resilience", "A stronger buffer reduces liquidation and impairment sensitivity.", safety_target),
            ("Prioritize severe positions", "Review positions nearest liquidation or with the weakest collateral data first.", None),
        ],
        "CLOSE": [
            ("Materially de-risk severe positions", "Multiple severe evaluated conditions support the CLOSE recommendation.", None),
            ("Address weak collateral first", "Collateral and impairment conditions can compound under stress.", safety_target),
            ("Avoid increasing exposure", "Risk should return within configured limits before exposure is increased.", delta_target),
        ],
    }
    selected = plans.get(action, plans["REDUCE"])
    return [WalletPlanStep(priority=index, action=item[0], reason=item[1], target=item[2]) for index, item in enumerate(selected, 1)]


def _executive_summary(
    *,
    action: str,
    health: WalletStrategyHealth,
    position_count: int,
    protocol_count: int,
    primary_driver: WalletPrimaryDriver,
    data_quality: str,
) -> WalletExecutiveSummary:
    headline = {
        "HOLD": "Portfolio risk remains within configured limits",
        "REBALANCE": "Directional exposure requires rebalancing",
        "REDUCE": "Portfolio exposure should be reduced",
        "CLOSE": "Multiple severe conditions require material de-risking",
    }.get(action, "Portfolio action is required")
    protocol_word = "protocol" if protocol_count == 1 else "protocols"
    action_text = {
        "HOLD": "No immediate corrective action is required.",
        "REBALANCE": "Rebalancing is recommended to restore the configured exposure relationship.",
        "REDUCE": "Reducing exposure is recommended before additional risk is added.",
        "CLOSE": "Closing or materially de-risking the most severe positions is recommended.",
    }.get(action, "Review the recommended plan before changing exposure.")
    body = (
        f"DeltaZero analyzed {position_count} supported positions across {protocol_count} {protocol_word}. "
        f"Current risk level is {health}. {primary_driver.explanation} {action_text}"
    )
    if data_quality == "partial":
        body += " This assessment covers only successfully retrieved supported positions and may not represent the full wallet inventory."
    return WalletExecutiveSummary(
        headline=headline,
        body=body,
        position_count=position_count,
        protocol_count=protocol_count,
        risk_level=health,
    )


def build_wallet_intelligence_report(
    *,
    positions: list[NormalizedPosition],
    summary: WalletPortfolioSummary,
    risk: WalletRiskMetrics,
    health: WalletStrategyHealth,
    action: str,
    data_quality: str,
    stress_profile: WalletStressProfile,
    profile: DecisionProfile,
    wallet_profile: WalletRiskProfile,
    hedge_state: str,
    safety_state: str,
    capital_state: str,
    impairment_state: str,
) -> WalletIntelligenceReport:
    exposure = calculate_exposure_analysis(positions)
    allocation = calculate_portfolio_allocation(positions)
    drivers = build_primary_drivers(
        summary=summary,
        risk=risk,
        data_quality=data_quality,
        profile=profile,
        wallet_profile=wallet_profile,
        hedge_state=hedge_state,
        safety_state=safety_state,
        capital_state=capital_state,
        impairment_state=impairment_state,
    )
    primary = next((driver for driver in drivers if driver.state in {"critical", "warning"}), drivers[0])
    protocol_count = len({position.protocol for position in positions})
    executive = _executive_summary(
        action=action,
        health=health,
        position_count=len(positions),
        protocol_count=protocol_count,
        primary_driver=primary,
        data_quality=data_quality,
    )
    impairment_loss = risk.estimated_impairment_loss_usd or 0.0
    impairment_pct = risk.estimated_impairment_loss_pct or 0.0
    post_equity = risk.post_impairment_equity_usd or 0.0
    stress = WalletStressSummary(
        stress_profile=stress_profile,
        estimated_impairment_loss_usd=impairment_loss,
        estimated_impairment_loss_pct=impairment_pct,
        post_impairment_equity_usd=post_equity,
        dominant_risk=primary.label,
        summary=f"Under the {stress_profile} profile, {primary.explanation} The resulting recommendation is {action}.",
    )
    return WalletIntelligenceReport(
        executive_summary=executive,
        primary_drivers=drivers,
        recommended_plan=build_recommended_plan(action, profile),
        exposure_analysis=exposure,
        portfolio_allocation=allocation,
        stress_summary=stress,
    )
