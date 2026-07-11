"""Audit existing long/short position."""

from app.config import SERVICE_NAME
from app.models.schemas import AuditRequest, AuditResponse
from app.services.metrics import compute_metrics
from app.services.recommendation import (
    actions_for_recommendation,
    assess_strategy_health,
    build_risk_notes,
    recommend_for_audit,
    strategy_name_for,
)


def audit_strategy(request: AuditRequest) -> AuditResponse:
    """Evaluate an existing strategy and return management actions."""
    metrics = compute_metrics(
        long_notional_usd=request.long_notional_usd,
        short_notional_usd=request.short_notional_usd,
        collateral_usd=request.collateral_usd,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=request.short_funding_apy,
        fee_drag_apy=request.fee_drag_apy,
    )

    health = assess_strategy_health(metrics)
    recommendation = recommend_for_audit(metrics, health)
    actions = actions_for_recommendation(recommendation, health)
    risk_notes = build_risk_notes(metrics, health)

    return AuditResponse(
        service=SERVICE_NAME,
        strategy_name=strategy_name_for(request.asset),
        asset=request.asset,
        strategy_health=health,
        metrics=metrics,
        recommendation=recommendation,
        risk_notes=risk_notes,
        actions=actions,
    )
