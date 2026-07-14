"""Deterministic seeded Monte Carlo sensitivity analysis."""

from __future__ import annotations

import math
import random
import statistics

from app.models.monte_carlo import (
    MonteCarloPath,
    MonteCarloPercentiles,
    MonteCarloRequest,
    MonteCarloResponse,
    MonteCarloSummary,
    PercentileValues,
    SensitivityFactor,
)
from app.services.impairment import calculate_impairment
from app.services.metrics import compute_metrics
from app.services.recommendation import builder_profile_for


def _clipped_normal(rng: random.Random, mean: float, deviation: float, low: float, high: float) -> float:
    return max(low, min(high, rng.gauss(mean, deviation)))


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = (len(ordered) - 1) * percentile
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def _percentiles(values: list[float]) -> PercentileValues:
    return PercentileValues(**{f"p{p}": round(_percentile(values, p / 100), 2) for p in (5, 25, 50, 75, 95, 99)})


def _sensitivity(factors: dict[str, list[float]], losses: list[float]) -> list[SensitivityFactor]:
    weights: dict[str, float] = {}
    loss_mean = statistics.fmean(losses)
    for name, values in factors.items():
        mean = statistics.fmean(values)
        covariance = statistics.fmean((value - mean) * (loss - loss_mean) for value, loss in zip(values, losses, strict=True))
        weights[name] = abs(covariance)
    total = sum(weights.values())
    contributions = {name: (weight / total * 100 if total else 0.0) for name, weight in weights.items()}
    labels = {
        "market_shock": "Market shock",
        "funding_shift": "Funding shift",
        "slippage": "Slippage",
        "collateral_haircut": "Collateral haircut",
        "protocol_loss": "Protocol loss",
    }
    ranked = sorted(contributions, key=lambda name: (-contributions[name], name))
    return [SensitivityFactor(
        factor=name,
        contribution_pct=round(contributions[name], 2),
        direction="mixed" if name in {"market_shock", "funding_shift"} else "negative",
        explanation=f"{labels[name]} accounts for {contributions[name]:.1f}% of measured impairment variance sensitivity.",
    ) for name in ranked]


def run_monte_carlo(request: MonteCarloRequest) -> MonteCarloResponse:
    """Simulate bounded stress assumptions using existing DeltaZero calculations."""
    rng = random.Random(request.seed)
    profile = builder_profile_for(request.risk_tolerance, request.target_style)
    horizon_scale = math.sqrt(request.time_horizon_days / 30.0)
    paths: list[MonteCarloPath] = []
    impairment_usd: list[float] = []
    impairment_pct: list[float] = []
    equities: list[float] = []
    factors: dict[str, list[float]] = {name: [] for name in ("market_shock", "funding_shift", "slippage", "collateral_haircut", "protocol_loss")}
    safety_breaches = hedge_breaches = negative_carry = capital_impairments = 0

    for path_id in range(1, request.simulation_count + 1):
        market = _clipped_normal(rng, request.market_shock_mean_pct, request.market_shock_volatility_pct * horizon_scale, -95, 100)
        funding = _clipped_normal(rng, request.funding_shift_mean_apy, request.funding_shift_volatility_apy * horizon_scale, -100, 100)
        slippage = _clipped_normal(rng, request.slippage_mean_pct, request.slippage_volatility_pct * horizon_scale, 0, 100)
        haircut = _clipped_normal(rng, request.collateral_haircut_mean_pct, request.collateral_haircut_volatility_pct * horizon_scale, 0, 100)
        protocol = _clipped_normal(rng, request.protocol_loss_mean_pct, request.protocol_loss_volatility_pct * horizon_scale, 0, 100)
        liquidation_penalty = max(0.0, (-market - 15.0) * 0.10)
        impairment = calculate_impairment(
            long_notional_usd=request.long_notional_usd,
            short_notional_usd=request.short_notional_usd,
            collateral_usd=request.collateral_usd,
            asset_price_change_pct=market,
            collateral_haircut_pct=haircut,
            exit_slippage_pct=slippage,
            liquidation_penalty_pct=liquidation_penalty,
            protocol_loss_pct=protocol,
        )
        stressed_long = max(0.0, request.long_notional_usd * (1 + market / 100))
        stressed_collateral = max(0.0, request.collateral_usd * (1 - haircut / 100))
        metrics = compute_metrics(stressed_long, request.short_notional_usd, stressed_collateral, request.long_yield_apy, request.short_funding_apy + funding, request.fee_drag_apy)
        loss_usd = min(request.capital_usd, impairment.estimated_impairment_loss_usd)
        loss_pct = min(100.0, loss_usd / request.capital_usd * 100)
        equity = max(0.0, request.capital_usd - loss_usd)
        impairment_usd.append(loss_usd); impairment_pct.append(loss_pct); equities.append(equity)
        for name, value in (("market_shock", market), ("funding_shift", funding), ("slippage", slippage), ("collateral_haircut", haircut), ("protocol_loss", protocol)):
            factors[name].append(value)
        safety_breaches += metrics.safety_buffer_score < 50
        hedge_breaches += metrics.hedge_drift_pct > profile.hedge_drift_warning_pct
        negative_carry += metrics.estimated_net_carry_apy < 0
        capital_impairments += equity < request.capital_usd * 0.8
        if path_id <= 50:
            paths.append(MonteCarloPath(path_id=path_id, market_shock_pct=round(market, 2), funding_shift_apy=round(funding, 2), slippage_pct=round(slippage, 2), collateral_haircut_pct=round(haircut, 2), protocol_loss_pct=round(protocol, 2), impairment_loss_pct=round(loss_pct, 2), post_stress_equity_usd=round(equity, 2), safety_buffer_score=metrics.safety_buffer_score, hedge_drift_pct=metrics.hedge_drift_pct))

    count = request.simulation_count
    probability_safety = safety_breaches / count * 100
    probability_hedge = hedge_breaches / count * 100
    probability_negative = negative_carry / count * 100
    probability_capital = capital_impairments / count * 100
    p95 = _percentile(impairment_pct, .95)
    score = max(0.0, 100 - (p95 * 2 + probability_safety * .2 + probability_hedge * .15 + probability_negative * .15 + probability_capital * .3))
    recommendation = "AVOID" if p95 >= profile.capital_risk_critical_pct or probability_safety >= 50 or probability_capital >= 35 else "ADJUST" if p95 >= profile.capital_risk_warning_pct or probability_hedge >= 25 or probability_negative >= 25 else "PROCEED"
    summary = MonteCarloSummary(
        expected_impairment_loss_usd=round(statistics.fmean(impairment_usd), 2), expected_impairment_loss_pct=round(statistics.fmean(impairment_pct), 2), median_impairment_loss_pct=round(_percentile(impairment_pct, .5), 2), p95_impairment_loss_pct=round(p95, 2), p99_impairment_loss_pct=round(_percentile(impairment_pct, .99), 2), worst_case_impairment_loss_pct=round(max(impairment_pct), 2), expected_post_stress_equity_usd=round(statistics.fmean(equities), 2), probability_safety_buffer_breach_pct=round(probability_safety, 2), probability_hedge_drift_breach_pct=round(probability_hedge, 2), probability_negative_carry_pct=round(probability_negative, 2), probability_capital_impairment_pct=round(probability_capital, 2), monte_carlo_score=round(score, 2), recommendation=recommendation,
    )
    return MonteCarloResponse(asset=request.asset, simulation_count=count, time_horizon_days=request.time_horizon_days, seed=request.seed, risk_tolerance=request.risk_tolerance, target_style=request.target_style, summary=summary, percentiles=MonteCarloPercentiles(impairment_loss_pct=_percentiles(impairment_pct), post_stress_equity_usd=_percentiles(equities)), sensitivity=_sensitivity(factors, impairment_pct), sample_paths=paths)
