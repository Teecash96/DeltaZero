from __future__ import annotations

import httpx
import pytest

from app.models.market import FundingHistorySummary, HyperliquidMarketResponse
from app.models.schemas import BuildRequest, WalletExposureImport
from app.services import builder, market_data
from app.services.builder import build_strategy


META = [
    {"universe": [{"name": "ETH", "szDecimals": 4}]},
    [{"markPx": "2000", "oraclePx": "1998", "funding": "0.00001", "openInterest": "100", "dayNtlVlm": "2500000", "premium": "0.0002"}],
]
HISTORY = [{"fundingRate": "0.00001"}, {"fundingRate": "-0.000005"}]


@pytest.fixture(autouse=True)
def clear_cache() -> None:
    market_data._cache.clear()


def fake_post(body: dict[str, object]):
    return HISTORY if body["type"] == "fundingHistory" else META


def test_market_context_normalization_and_positive_funding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(market_data, "_post", fake_post)
    result = market_data.get_hyperliquid_market("ETH")
    assert result.mark_price_usd == 2000
    assert result.open_interest_usd == 200000
    assert result.current_funding_apy == pytest.approx(8.76)
    assert result.funding_direction == "longs_pay"
    assert result.historical_funding and result.historical_funding.average_funding_apy == pytest.approx(2.19)


def test_negative_funding_conversion_and_direction(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = [META[0], [{**META[1][0], "funding": "-0.00001"}]]
    monkeypatch.setattr(market_data, "_post", lambda body: HISTORY if body["type"] == "fundingHistory" else payload)
    result = market_data.get_hyperliquid_market("ETH")
    assert result.current_funding_apy == pytest.approx(-8.76)
    assert result.funding_direction == "shorts_pay"
    assert market_data.funding_cost_for_short(result.current_funding_apy) == pytest.approx(8.76)


def test_unknown_asset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(market_data, "_post", fake_post)
    with pytest.raises(market_data.UnknownMarketError):
        market_data.get_hyperliquid_market("NOPE")


def test_timeout_is_safe(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(market_data, "_post", lambda body: (_ for _ in ()).throw(httpx.TimeoutException("timeout")))
    with pytest.raises(market_data.MarketDataError):
        market_data.get_hyperliquid_market("ETH")


def test_market_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0
    def counted(body):
        nonlocal calls
        calls += 1
        return fake_post(body)
    monkeypatch.setattr(market_data, "_post", counted)
    market_data.get_hyperliquid_market("ETH")
    market_data.get_hyperliquid_market("ETH")
    assert calls == 2  # one context and one history request, then both cached


def market(funding: float) -> HyperliquidMarketResponse:
    return HyperliquidMarketResponse(
        asset="ETH", market="ETH-PERP", mark_price_usd=2000, oracle_price_usd=2000,
        current_funding_rate_hourly=funding / (24 * 365 * 100), current_funding_apy=funding,
        funding_direction="longs_pay" if funding > 0 else "shorts_pay", open_interest_usd=100000,
        day_volume_usd=500000, data_timestamp="2026-07-13T00:00:00Z", data_quality="complete",
        historical_funding=FundingHistorySummary(lookback_hours=24, average_funding_apy=funding, minimum_funding_apy=funding, maximum_funding_apy=funding, observations=24),
    )


def request(**changes) -> BuildRequest:
    data = dict(asset="ETH", capital_usd=5000, risk_tolerance="medium", target_style="neutral_yield", long_yield_apy=14, short_funding_apy=3, fee_drag_apy=1)
    data.update(changes)
    return BuildRequest(**data)


def test_manual_builder_unchanged() -> None:
    assert build_strategy(request()).metrics.estimated_net_carry_apy == pytest.approx(10.12)


def test_live_funding_sign_changes_carry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(builder, "get_hyperliquid_market", lambda *args: market(8.0))
    positive = build_strategy(request(market_data_mode="hyperliquid"))
    monkeypatch.setattr(builder, "get_hyperliquid_market", lambda *args: market(-8.0))
    negative = build_strategy(request(market_data_mode="hyperliquid"))
    assert positive.metrics.estimated_net_carry_apy > build_strategy(request()).metrics.estimated_net_carry_apy
    assert negative.metrics.estimated_net_carry_apy < build_strategy(request()).metrics.estimated_net_carry_apy
    assert positive.funding_contribution_apy > 0 > negative.funding_contribution_apy


@pytest.mark.parametrize(("long", "short", "direction"), [(1000, 500, "increase_short"), (1000, 1200, None), (1000, 958, "no_change")])
def test_wallet_hedge_adjustments(long: float, short: float, direction: str | None) -> None:
    imported = WalletExposureImport(wallet_address="0x" + "1" * 40, asset="ETH", gross_long_exposure_usd=long, gross_short_exposure_usd=short, recommended_action="REBALANCE", data_quality="complete")
    result = build_strategy(request(wallet_exposure=imported))
    assert result.hedge_adjustment
    if direction is None:
        assert result.hedge_adjustment.limitation
        assert result.hedge_adjustment.short_adjustment_usd is None
    else:
        assert result.hedge_adjustment.adjustment_direction == direction


def test_missing_exposure_and_partial_confidence() -> None:
    missing = WalletExposureImport(wallet_address="0x" + "1" * 40, recommended_action="REBALANCE", data_quality="complete")
    assert build_strategy(request(wallet_exposure=missing)).hedge_adjustment.short_adjustment_usd is None
    complete = WalletExposureImport(wallet_address="0x" + "1" * 40, gross_long_exposure_usd=1000, gross_short_exposure_usd=500, recommended_action="REBALANCE", data_quality="complete")
    partial = complete.model_copy(update={"data_quality": "partial"})
    assert build_strategy(request(wallet_exposure=partial)).decision_confidence <= build_strategy(request(wallet_exposure=complete)).decision_confidence
