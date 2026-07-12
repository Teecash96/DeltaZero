"""Build neutral carry strategy from capital and yield inputs."""

from app.config import SERVICE_NAME
from app.models.schemas import BuildRequest, BuildResponse, HedgeAdjustment, Recommendation, RecommendedStructure
from app.services.market_data import funding_cost_for_short, get_hyperliquid_market
from app.services.metrics import compute_metrics
from app.services.recommendation import (
    assess_strategy_health,
    build_risk_notes,
    builder_profile_for,
    calculate_decision_confidence,
    evaluate_decision_context,
    recommend_for_build,
    strategy_name_for,
)


def build_strategy(request: BuildRequest) -> BuildResponse:
    """Construct a recommended pseudo-delta-neutral structure."""
    profile = builder_profile_for(request.risk_tolerance, request.target_style)

    market = None
    effective_short_funding_apy = request.short_funding_apy
    if request.market_data_mode == "hyperliquid" and not request.override_live_funding:
        market = get_hyperliquid_market(request.asset, request.market_dex, request.funding_lookback_hours)
        effective_short_funding_apy = funding_cost_for_short(market.current_funding_apy)

    collateral_usd = round(request.capital_usd * profile.collateral_reserve_pct, 2)
    long_notional_usd = round(request.capital_usd - collateral_usd, 2)
    short_notional_usd = round(long_notional_usd * profile.target_hedge_ratio, 2)
    target_hedge_ratio = round(profile.target_hedge_ratio, 4)
    hedge_adjustment = None
    imported = request.wallet_exposure
    if imported is not None:
        current_long = imported.gross_long_exposure_usd
        current_short = imported.gross_short_exposure_usd
        limitation = None
        if current_long is None or current_short is None or current_long <= 0:
            limitation = "Reliable long and short exposure is required before DeltaZero can calculate a hedge amount."
        elif current_short > current_long:
            limitation = "The current wallet to Builder workflow supports long dominant portfolios that require a short hedge adjustment."
        if limitation:
            hedge_adjustment = HedgeAdjustment(target_hedge_ratio=target_hedge_ratio, limitation=limitation)
        else:
            assert current_long is not None and current_short is not None
            target_short = round(current_long * target_hedge_ratio, 2)
            adjustment = round(target_short - current_short, 2)
            tolerance = max(1.0, current_long * 0.005)
            direction = "no_change" if abs(adjustment) <= tolerance else "increase_short" if adjustment > 0 else "reduce_short"
            projected_short = current_short if direction == "no_change" else target_short
            projected_delta = round(current_long - projected_short, 2)
            projected_ratio = round(projected_short / current_long, 4)
            hedge_adjustment = HedgeAdjustment(
                current_long_notional_usd=round(current_long, 2),
                current_short_notional_usd=round(current_short, 2),
                target_short_notional_usd=target_short,
                short_adjustment_usd=0.0 if direction == "no_change" else adjustment,
                target_hedge_ratio=target_hedge_ratio,
                projected_hedge_ratio=projected_ratio,
                projected_net_delta_usd=projected_delta,
                projected_net_delta_pct=round(projected_delta / current_long * 100.0, 2),
                projected_hedge_drift_pct=round(abs(1 - projected_ratio) * 100.0, 2),
                adjustment_direction=direction,
            )
            long_notional_usd = round(current_long, 2)
            short_notional_usd = round(projected_short, 2)
            collateral_usd = round(request.capital_usd, 2)

    metrics = compute_metrics(
        long_notional_usd=long_notional_usd,
        short_notional_usd=short_notional_usd,
        collateral_usd=collateral_usd,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=effective_short_funding_apy,
        fee_drag_apy=request.fee_drag_apy,
    )

    context = evaluate_decision_context(
        metrics=metrics,
        risk_tolerance=request.risk_tolerance,
        capital_base_usd=request.capital_usd,
        profile=profile,
    )
    health = assess_strategy_health(context)
    recommendation = recommend_for_build(context)
    risk_notes = build_risk_notes(context)
    decision_confidence = calculate_decision_confidence(context, recommendation)
    if imported is not None:
        mapped_action = {"OPEN": "HOLD", "WAIT": "REDUCE"}.get(recommendation.action, recommendation.action)
        if hedge_adjustment and hedge_adjustment.limitation:
            mapped_action = imported.recommended_action
        elif hedge_adjustment and hedge_adjustment.adjustment_direction != "no_change" and mapped_action == "HOLD":
            mapped_action = "REBALANCE"
        recommendation = Recommendation(action=mapped_action, summary=(
            hedge_adjustment.limitation if hedge_adjustment and hedge_adjustment.limitation
            else f"{hedge_adjustment.adjustment_direction.replace('_', ' ').title()} to move the existing wallet exposure toward the configured hedge target."
            if hedge_adjustment else recommendation.summary
        ))
        if imported.data_quality == "partial":
            decision_confidence = max(0, decision_confidence - 12)
            risk_notes.insert(0, "Partial wallet coverage may exclude positions that could change the hedge requirement.")

    hedge_weight = min(long_notional_usd, short_notional_usd) / long_notional_usd if long_notional_usd > 0 else 0.0
    funding_contribution = round((market.current_funding_apy if market else -request.short_funding_apy) * hedge_weight, 2)

    return BuildResponse(
        service=SERVICE_NAME,
        strategy_name=strategy_name_for(request.asset, request.target_style),
        asset=request.asset,
        strategy_health=health,
        decision_confidence=decision_confidence,
        metrics=metrics,
        recommendation=recommendation,
        risk_notes=risk_notes,
        recommended_structure=RecommendedStructure(
            long_notional_usd=long_notional_usd,
            short_notional_usd=short_notional_usd,
            collateral_usd=collateral_usd,
            target_hedge_ratio=target_hedge_ratio,
        ),
        market_data_source="hyperliquid" if market else None,
        market_data_timestamp=market.data_timestamp if market else None,
        funding_rate_apy=market.current_funding_apy if market else None,
        funding_contribution_apy=funding_contribution if market else None,
        market_data_quality=market.data_quality if market else None,
        market_context=(
            {
                "mark_price_usd": market.mark_price_usd,
                "oracle_price_usd": market.oracle_price_usd,
                "funding_direction": market.funding_direction,
                "open_interest_usd": market.open_interest_usd,
                "day_volume_usd": market.day_volume_usd,
                "historical_funding": market.historical_funding.model_dump() if market.historical_funding else None,
            }
            if market else None
        ),
        hedge_adjustment=hedge_adjustment,
    )
