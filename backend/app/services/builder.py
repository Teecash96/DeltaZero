"""Build neutral carry strategy from capital and yield inputs."""

from app.config import SERVICE_NAME
from app.models.schemas import BuildRequest, BuildResponse, RecommendedStructure
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

    collateral_usd = round(request.capital_usd * profile.collateral_reserve_pct, 2)
    long_notional_usd = round(request.capital_usd - collateral_usd, 2)
    short_notional_usd = round(long_notional_usd * profile.target_hedge_ratio, 2)
    target_hedge_ratio = round(profile.target_hedge_ratio, 4)

    metrics = compute_metrics(
        long_notional_usd=long_notional_usd,
        short_notional_usd=short_notional_usd,
        collateral_usd=collateral_usd,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=request.short_funding_apy,
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
    )
