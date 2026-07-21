"""Coordinate the four premium risk views behind one paid request."""

from app.models.monte_carlo import MonteCarloRequest
from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse
from app.models.schemas import AuditRequest, BuildRequest, Scenario, StressTestRequest
from app.services.auditor import audit_strategy
from app.services.builder import build_strategy
from app.services.monte_carlo import run_monte_carlo
from app.services.stress_test import stress_test_strategy
from app.services.interoperability import build_risk_envelope


def run_risk_engine_pass(request: RiskEnginePassRequest) -> RiskEnginePassResponse:
    """Generate four internally consistent reports from one strategy build."""

    build = build_strategy(
        BuildRequest(
            asset=request.asset,
            capital_usd=request.capital_usd,
            risk_tolerance=request.risk_tolerance,
            target_style=request.target_style,
            long_yield_apy=request.long_yield_apy,
            short_funding_apy=request.short_funding_apy,
            fee_drag_apy=request.fee_drag_apy,
        )
    )
    structure = build.recommended_structure
    funding_apy = build.funding_rate_apy if build.funding_rate_apy is not None else request.short_funding_apy

    shared = dict(
        asset=request.asset,
        long_notional_usd=structure.long_notional_usd,
        short_notional_usd=structure.short_notional_usd,
        collateral_usd=structure.collateral_usd,
        risk_tolerance=request.risk_tolerance,
        long_yield_apy=request.long_yield_apy,
        short_funding_apy=funding_apy,
        fee_drag_apy=request.fee_drag_apy,
    )
    audit = audit_strategy(AuditRequest(**shared))
    stress = stress_test_strategy(
        StressTestRequest(
            **shared,
            scenario=Scenario(type="funding_worsens", magnitude_pct=request.stress_magnitude_pct),
        )
    )
    monte_carlo = run_monte_carlo(
        MonteCarloRequest(
            **shared,
            capital_usd=request.capital_usd,
            target_style=request.target_style,
            simulation_count=request.simulation_count,
            time_horizon_days=request.time_horizon_days,
            seed=request.seed,
        )
    )
    envelope = build_risk_envelope(request, build, audit, stress, monte_carlo)
    return RiskEnginePassResponse(
        strategy_build=build,
        hedge_drift_audit=audit,
        funding_stress_test=stress,
        monte_carlo_sensitivity=monte_carlo,
        risk_envelope=envelope,
    )
