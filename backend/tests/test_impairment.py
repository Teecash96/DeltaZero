"""Tests for scenario-based economic impairment calculations."""

import pytest

from app.services.impairment import calculate_impairment


def test_impairment_avoids_double_counting() -> None:
    result = calculate_impairment(
        long_notional_usd=1000,
        short_notional_usd=1000,
        collateral_usd=200,
        asset_price_change_pct=-10,
        collateral_haircut_pct=0,
        exit_slippage_pct=0,
        liquidation_penalty_pct=0,
        protocol_loss_pct=0,
    )
    assert result.impairment_breakdown.asset_value_impact_usd == 100
    assert result.impairment_breakdown.hedge_pnl_impact_usd == 0
    assert result.estimated_impairment_loss_usd == 0
    assert result.post_impairment_equity_usd == pytest.approx(result.pre_stress_equity_usd)


def test_short_hedge_offsets_long_price_impairment() -> None:
    result = calculate_impairment(
        long_notional_usd=1500,
        short_notional_usd=1500,
        collateral_usd=300,
        asset_price_change_pct=-8,
        collateral_haircut_pct=0,
        exit_slippage_pct=0,
        liquidation_penalty_pct=0,
        protocol_loss_pct=0,
    )
    assert result.estimated_impairment_loss_usd == 0
    assert result.post_impairment_equity_usd == pytest.approx(result.pre_stress_equity_usd)


def test_exit_slippage_increases_impairment() -> None:
    base = calculate_impairment(
        long_notional_usd=1200,
        short_notional_usd=1200,
        collateral_usd=200,
        asset_price_change_pct=-5,
        collateral_haircut_pct=0,
        exit_slippage_pct=0,
        liquidation_penalty_pct=0,
        protocol_loss_pct=0,
    )
    slippage = calculate_impairment(
        long_notional_usd=1200,
        short_notional_usd=1200,
        collateral_usd=200,
        asset_price_change_pct=-5,
        collateral_haircut_pct=0,
        exit_slippage_pct=1.5,
        liquidation_penalty_pct=0,
        protocol_loss_pct=0,
    )
    assert slippage.estimated_impairment_loss_usd > base.estimated_impairment_loss_usd
    assert slippage.impairment_breakdown.exit_slippage_usd > 0


def test_liquidation_penalty_increases_impairment() -> None:
    base = calculate_impairment(
        long_notional_usd=1200,
        short_notional_usd=1000,
        collateral_usd=150,
        asset_price_change_pct=-7,
        collateral_haircut_pct=0,
        exit_slippage_pct=0,
        liquidation_penalty_pct=0,
        protocol_loss_pct=0,
    )
    penalized = calculate_impairment(
        long_notional_usd=1200,
        short_notional_usd=1000,
        collateral_usd=150,
        asset_price_change_pct=-7,
        collateral_haircut_pct=0,
        exit_slippage_pct=0,
        liquidation_penalty_pct=2.5,
        protocol_loss_pct=0,
    )
    assert penalized.estimated_impairment_loss_usd > base.estimated_impairment_loss_usd
    assert penalized.impairment_breakdown.liquidation_penalty_usd > 0


def test_impairment_percentage_remains_bounded() -> None:
    result = calculate_impairment(
        long_notional_usd=800,
        short_notional_usd=600,
        collateral_usd=100,
        asset_price_change_pct=12,
        collateral_haircut_pct=5,
        exit_slippage_pct=2,
        liquidation_penalty_pct=1,
        protocol_loss_pct=1,
    )
    assert 0 <= result.estimated_impairment_loss_pct <= 100
