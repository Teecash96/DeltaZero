"""Regression tests for institutional wallet intelligence fields."""

from __future__ import annotations

import re

import pytest

from app.config import WALLET_RISK_PROFILES
from app.models.wallet import NormalizedPosition, WalletPortfolioSummary, WalletRiskMetrics
from app.services.wallet_analyzer import _normalise_profile
from app.services.wallet_report import (
    build_wallet_intelligence_report,
    calculate_exposure_analysis,
    calculate_portfolio_allocation,
)


def position(
    asset: str,
    position_type: str,
    value: float | None,
    *,
    collateral: float | None = 0.0,
    pnl: float | None = 0.0,
) -> NormalizedPosition:
    return NormalizedPosition(
        protocol="hyperliquid",
        network="hyperliquid",
        position_type=position_type,  # type: ignore[arg-type]
        asset=asset,
        quantity=1.0,
        notional_usd=value,
        current_value_usd=value,
        entry_value_usd=value,
        unrealized_pnl_usd=pnl,
        collateral_usd=collateral,
        debt_usd=value if position_type == "lending_borrow" else 0.0,
        funding_apy=None,
        liquidation_price=None,
        health_factor=None,
        data_timestamp=None,
        data_quality="complete",
        market_context=None,
    )


def report_for(action: str, *, partial: bool = False, missing: bool = False):
    positions = [
        position("ETH", "spot", 5000),
        position("ETH", "perpetual_short", 4800, collateral=1200),
    ]
    summary = WalletPortfolioSummary(
        current_position_value_usd=9800,
        gross_long_exposure_usd=5000,
        gross_short_exposure_usd=4800,
        net_delta_usd=200,
        net_delta_pct=2.04,
        unrealized_pnl_usd=0,
        collateral_value_usd=1200,
        debt_value_usd=0,
        estimated_funding_exposure_apy=2.0,
    )
    severe = action in {"REDUCE", "CLOSE"}
    rebalance = action == "REBALANCE"
    risk = WalletRiskMetrics(
        hedge_ratio=None if missing else (0.70 if rebalance else 0.96),
        hedge_drift_pct=None if missing else (30.0 if rebalance else 3.0),
        collateral_health_score=None if missing else (25.0 if severe else 85.0),
        minimum_health_factor=None,
        liquidation_proximity_pct=None,
        safety_buffer_score=None if missing else (25.0 if severe else 82.0),
        capital_at_risk_proxy=None if missing else (8000.0 if severe else 200.0),
        estimated_impairment_loss_usd=None if missing else (3000.0 if severe else 200.0),
        estimated_impairment_loss_pct=None if missing else (30.0 if severe else 2.0),
        post_impairment_equity_usd=None if missing else (1000.0 if severe else 7000.0),
    )
    return build_wallet_intelligence_report(
        positions=positions,
        summary=summary,
        risk=risk,
        health="critical" if severe else "warning" if rebalance else "healthy",
        action=action,
        data_quality="partial" if partial else "complete",
        stress_profile="standard",
        profile=_normalise_profile("standard"),
        wallet_profile=WALLET_RISK_PROFILES["standard"],
        hedge_state="severe" if rebalance else "aligned",
        safety_state="weak" if severe else "strong",
        capital_state="severe" if severe else "manageable",
        impairment_state="severe" if severe else "light",
    )


@pytest.mark.parametrize(
    ("action", "phrase"),
    [
        ("HOLD", "No immediate corrective action"),
        ("REBALANCE", "Rebalancing is recommended"),
        ("REDUCE", "Reducing exposure is recommended"),
        ("CLOSE", "Closing or materially de-risking"),
    ],
)
def test_executive_summary_matches_action(action: str, phrase: str) -> None:
    report = report_for(action)
    assert phrase in report.executive_summary.body
    assert report.executive_summary.position_count == 2


def test_partial_data_disclaimer_appears() -> None:
    report = report_for("REBALANCE", partial=True)
    assert "may not represent the full wallet inventory" in report.executive_summary.body
    assert any(driver.metric == "data_quality" and driver.state == "warning" for driver in report.primary_drivers)


def test_primary_drivers_align_with_close() -> None:
    report = report_for("CLOSE")
    assert sum(driver.state == "critical" for driver in report.primary_drivers) >= 2
    assert report.stress_summary.dominant_risk in {driver.label for driver in report.primary_drivers if driver.state == "critical"}


def test_missing_metrics_are_unavailable() -> None:
    report = report_for("HOLD", missing=True)
    by_metric = {driver.metric: driver for driver in report.primary_drivers}
    assert by_metric["estimated_impairment_loss_pct"].state == "unavailable"
    assert by_metric["safety_buffer_score"].state == "unavailable"
    assert by_metric["hedge_drift_pct"].state == "unavailable"


def test_exposure_totals_and_no_double_counting() -> None:
    positions = [
        position("ETH", "spot", 5000, collateral=5000),
        position("ETH", "perpetual_short", 4500, collateral=1000),
        position("USDC", "vault_deposit", 2000, collateral=2000),
    ]
    exposure = calculate_exposure_analysis(positions)
    assert exposure.gross_long_exposure_usd == 7000
    assert exposure.gross_short_exposure_usd == 4500
    assert exposure.gross_exposure_usd == 11500
    assert exposure.portfolio_equity_usd == 8000


def test_portfolio_allocation_totals_approximately_100() -> None:
    allocation = calculate_portfolio_allocation(
        [position("ETH", "spot", 5000), position("BTC", "perpetual_short", 5000, collateral=1000)]
    )
    assert sum(item.allocation_pct for item in allocation) == pytest.approx(100.0, abs=0.01)


def test_other_allocation_aggregation() -> None:
    positions = [position(f"A{index}", "spot", float(100 - index)) for index in range(10)]
    allocation = calculate_portfolio_allocation(positions)
    assert len(allocation) == 9
    assert allocation[-1].asset == "Other"
    assert allocation[-1].exposure_usd == 183.0


def test_leverage_is_null_when_equity_is_unavailable() -> None:
    exposure = calculate_exposure_analysis([position("ETH", "perpetual_long", 5000, collateral=None, pnl=None)])
    assert exposure.portfolio_equity_usd is None
    assert exposure.leverage_ratio is None


def test_recommended_plan_does_not_invent_trade_sizes() -> None:
    for action in ["HOLD", "REBALANCE", "REDUCE", "CLOSE"]:
        report = report_for(action)
        combined = " ".join(f"{step.action} {step.reason} {step.target or ''}" for step in report.recommended_plan)
        assert not re.search(r"\$\s?\d", combined)
        assert not re.search(r"\b\d+(?:\.\d+)?\s+(?:ETH|BTC|SOL)\b", combined)


def test_position_report_fields_remain_nullable() -> None:
    item = NormalizedPosition(
        protocol="hyperliquid",
        network="hyperliquid",
        position_type="spot",
        asset="ETH",
    )
    assert item.side is None
    assert item.subaccount_name is None
    assert item.subaccount_address is None
    assert item.liquidation_price is None
    assert item.health_factor is None
