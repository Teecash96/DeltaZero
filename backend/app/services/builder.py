"""Build neutral carry strategy from capital and yield inputs."""

from app.config import BUILD_ALLOCATION, SERVICE_NAME
from app.models.schemas import BuildRequest, BuildResponse, RecommendedStructure
from app.services.metrics import compute_metrics
from app.services.recommendation import (
    assess_strategy_health,
    build_risk_notes,
    recommend_for_build,
    strategy_name_for,
)


def build_strategy(request: BuildRequest) -> BuildResponse:
    """Construct a recommended pseudo-delta-neutral structure."""
    allocation = BUILD_ALLOCATION[request.risk_tolerance]

    long_notional_usd = round(request.capital_usd * allocation["long_pct"], 2)
    short_notional_usd = round(request.capital_usd * allocation["short_pct"], 2)
    collateral_usd = round(request.capital_usd * allocation["collateral_pct"], 2)
    target_hedge_ratio = round(
        short_notional_usd / long_notional_usd if long_notional_usd > 0 else 0.0,
        4,
    )

    metrics = compute_metrics(
        long_notional_usd=long_notional_usd,
        short_notional_usd=short_notional_usd,
        collateral_usd=collateral_usd,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=request.short_funding_apy,
        fee_drag_apy=request.fee_drag_apy,
    )

    health = assess_strategy_health(metrics)
    recommendation = recommend_for_build(metrics, health)
    risk_notes = build_risk_notes(metrics, health)

    return BuildResponse(
        service=SERVICE_NAME,
        strategy_name=strategy_name_for(request.asset, request.target_style),
        asset=request.asset,
        strategy_health=health,
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
