"""Stress test strategy under scenario shocks."""

from app.config import SERVICE_NAME
from app.models.schemas import Scenario, ScenarioResult, StressTestRequest, StressTestResponse
from app.services.metrics import compute_metrics
from app.services.recommendation import (
    actions_for_recommendation,
    assess_strategy_health,
    build_risk_notes,
    recommend_for_audit,
    strategy_name_for,
)


def apply_scenario(
    long_notional_usd: float,
    short_notional_usd: float,
    collateral_usd: float,
    long_yield_apy: float,
    short_funding_apy: float,
    scenario: Scenario,
) -> tuple[float, float, float, float, float]:
    """Apply deterministic scenario adjustments to position inputs."""
    stressed_long = long_notional_usd
    stressed_short = short_notional_usd
    stressed_collateral = collateral_usd
    stressed_long_yield = long_yield_apy
    stressed_short_funding = short_funding_apy
    magnitude = scenario.magnitude_pct

    if scenario.type == "funding_worsens":
        stressed_short_funding = short_funding_apy + magnitude
    elif scenario.type == "yield_drops":
        stressed_long_yield = max(0.0, long_yield_apy - magnitude)
    elif scenario.type == "price_drop":
        factor = 1.0 - (magnitude / 100.0)
        stressed_long = long_notional_usd * factor
        stressed_short = short_notional_usd * factor
        stressed_collateral = collateral_usd * factor
    elif scenario.type == "price_rise":
        factor = 1.0 + (magnitude / 100.0)
        stressed_long = long_notional_usd * factor
        stressed_short = short_notional_usd * factor
        stressed_collateral = collateral_usd * factor

    return (
        round(stressed_long, 2),
        round(stressed_short, 2),
        round(stressed_collateral, 2),
        round(stressed_long_yield, 2),
        round(stressed_short_funding, 2),
    )


def stress_test_strategy(request: StressTestRequest) -> StressTestResponse:
    """Run a scenario shock and re-evaluate strategy health."""
    base_metrics = compute_metrics(
        long_notional_usd=request.long_notional_usd,
        short_notional_usd=request.short_notional_usd,
        collateral_usd=request.collateral_usd,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=request.short_funding_apy,
        fee_drag_apy=request.fee_drag_apy,
    )
    base_health = assess_strategy_health(base_metrics)

    (
        stressed_long,
        stressed_short,
        stressed_collateral,
        stressed_long_yield,
        stressed_short_funding,
    ) = apply_scenario(
        long_notional_usd=request.long_notional_usd,
        short_notional_usd=request.short_notional_usd,
        collateral_usd=request.collateral_usd,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=request.short_funding_apy,
        scenario=request.scenario,
    )

    stressed_metrics = compute_metrics(
        long_notional_usd=stressed_long,
        short_notional_usd=stressed_short,
        collateral_usd=stressed_collateral,
        long_yield_apy=stressed_long_yield,
        short_funding_apy=stressed_short_funding,
        fee_drag_apy=request.fee_drag_apy,
    )
    stressed_health = assess_strategy_health(stressed_metrics)

    recommendation = recommend_for_audit(stressed_metrics, stressed_health)
    actions = actions_for_recommendation(recommendation, stressed_health)
    risk_notes = build_risk_notes(stressed_metrics, stressed_health)

    if stressed_health != base_health:
        risk_notes.insert(
            0,
            f"Scenario '{request.scenario.type}' shifted health from "
            f"{base_health} to {stressed_health}.",
        )

    scenario_result = ScenarioResult(
        scenario_type=request.scenario.type,
        magnitude_pct=request.scenario.magnitude_pct,
        stressed_long_notional_usd=stressed_long,
        stressed_short_notional_usd=stressed_short,
        stressed_collateral_usd=stressed_collateral,
        stressed_long_yield_apy=stressed_long_yield,
        stressed_short_funding_apy=stressed_short_funding,
        stressed_metrics=stressed_metrics,
        health_after_stress=stressed_health,
    )

    return StressTestResponse(
        service=SERVICE_NAME,
        strategy_name=strategy_name_for(request.asset),
        asset=request.asset,
        strategy_health=stressed_health,
        metrics=base_metrics,
        recommendation=recommendation,
        risk_notes=risk_notes,
        actions=actions,
        scenario_result=scenario_result,
    )
