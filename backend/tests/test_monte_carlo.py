"""Monte Carlo sensitivity regression tests."""

import math

import pytest
from pydantic import ValidationError

from app.models.monte_carlo import MonteCarloRequest
from app.services.monte_carlo import run_monte_carlo


BASE = dict(asset="SOL", capital_usd=5000, long_notional_usd=3500, short_notional_usd=3360, collateral_usd=1500, long_yield_apy=14, short_funding_apy=3, fee_drag_apy=1, risk_tolerance="medium", target_style="neutral_yield", simulation_count=100, seed=7)


def request(**changes) -> MonteCarloRequest:
    return MonteCarloRequest(**{**BASE, **changes})


def test_seed_is_repeatable_and_different_seed_changes_paths() -> None:
    first = run_monte_carlo(request())
    repeated = run_monte_carlo(request())
    assert first.model_dump(exclude={"generated_at"}) == repeated.model_dump(exclude={"generated_at"})
    assert first.sample_paths != run_monte_carlo(request(seed=8)).sample_paths


@pytest.mark.parametrize("changes", [{"simulation_count": 10001}, {"capital_usd": -1}, {"long_notional_usd": -1}, {"collateral_usd": -1}, {"slippage_mean_pct": -1}, {"protocol_loss_mean_pct": 101}])
def test_invalid_limits_and_values_are_rejected(changes: dict) -> None:
    with pytest.raises(ValidationError):
        request(**changes)


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_non_finite_values_are_rejected(value: float) -> None:
    with pytest.raises(ValidationError):
        request(market_shock_mean_pct=value)


def test_distribution_and_probability_invariants() -> None:
    result = run_monte_carlo(request())
    assert result.summary.p95_impairment_loss_pct >= result.summary.median_impairment_loss_pct
    for value in (result.summary.probability_safety_buffer_breach_pct, result.summary.probability_hedge_drift_breach_pct, result.summary.probability_negative_carry_pct, result.summary.probability_capital_impairment_pct):
        assert 0 <= value <= 100
    assert len(result.sample_paths) == 50
    assert all(path.slippage_pct >= 0 and path.collateral_haircut_pct >= 0 and path.protocol_loss_pct >= 0 for path in result.sample_paths)
    assert sum(item.contribution_pct for item in result.sensitivity) == pytest.approx(100, abs=.1)


@pytest.mark.parametrize(("changes", "expected"), [
    ({"market_shock_volatility_pct": 1, "funding_shift_volatility_apy": 1, "slippage_mean_pct": .1, "slippage_volatility_pct": .1, "collateral_haircut_mean_pct": 0, "collateral_haircut_volatility_pct": .1, "protocol_loss_volatility_pct": .1}, "PROCEED"),
    ({}, "ADJUST"),
    ({"market_shock_mean_pct": -40, "market_shock_volatility_pct": 25, "collateral_haircut_mean_pct": 30, "protocol_loss_mean_pct": 20}, "AVOID"),
])
def test_recommendation_bands(changes: dict, expected: str) -> None:
    assert run_monte_carlo(request(**changes)).summary.recommendation == expected


def test_route_and_openapi(client) -> None:
    response = client.post("/monte-carlo/run", json=request().model_dump())
    assert response.status_code == 200
    assert response.json()["simulation_count"] == 100
    assert "/monte-carlo/run" in client.get("/openapi.json").json()["paths"]
