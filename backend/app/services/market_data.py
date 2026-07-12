"""Cached read-only Hyperliquid market context and funding history."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from time import time

import httpx

from app.models.market import FundingHistorySummary, HyperliquidMarketResponse

INFO_URL = "https://api.hyperliquid.xyz/info"
TIMEOUT_SECONDS = 8.0
MARKET_CACHE_TTL = 30.0
HISTORY_CACHE_TTL = 300.0
FAILURE_CACHE_TTL = 10.0
FUNDING_PERIODS_PER_YEAR = 24 * 365

_client = httpx.Client(timeout=TIMEOUT_SECONDS)
_cache: dict[str, tuple[float, object, bool]] = {}
_lock = Lock()


class MarketDataError(RuntimeError):
    pass


class UnknownMarketError(MarketDataError):
    pass


def funding_rate_to_apy(hourly_rate: float) -> float:
    """Convert signed hourly decimal funding to signed annual percent."""
    return round(hourly_rate * FUNDING_PERIODS_PER_YEAR * 100.0, 6)


def funding_cost_for_short(market_funding_apy: float) -> float:
    """Map signed market funding to the Builder's short-side cost convention.

    Hyperliquid positive funding means longs pay shorts, so it is income to a
    short hedge and therefore a negative cost in the existing carry equation.
    """
    return round(-market_funding_apy, 6)


def _post(body: dict[str, object]) -> object:
    response = _client.post(INFO_URL, json=body)
    response.raise_for_status()
    return response.json()


def _cached(key: str, ttl: float, loader):
    now = time()
    with _lock:
        item = _cache.get(key)
        if item and now - item[0] < (FAILURE_CACHE_TTL if item[2] else ttl):
            if item[2]:
                raise MarketDataError(str(item[1]))
            return item[1]
    try:
        value = loader()
    except Exception as exc:
        with _lock:
            _cache[key] = (now, f"{exc.__class__.__name__}: market data unavailable", True)
        if isinstance(exc, MarketDataError):
            raise
        raise MarketDataError("Hyperliquid market data unavailable") from exc
    with _lock:
        _cache[key] = (now, value, False)
    return value


def _num(value: object, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise MarketDataError(f"Malformed Hyperliquid {field}") from exc


def _funding_history(asset: str, dex: str | None, lookback_hours: int) -> FundingHistorySummary:
    end_ms = int(time() * 1000)
    start_ms = end_ms - lookback_hours * 3_600_000
    coin = f"{dex}:{asset}" if dex else asset
    key = f"funding:{coin}:{lookback_hours}"

    def load() -> FundingHistorySummary:
        payload = _post({"type": "fundingHistory", "coin": coin, "startTime": start_ms, "endTime": end_ms})
        if not isinstance(payload, list):
            raise MarketDataError("Malformed Hyperliquid funding history")
        rates = [funding_rate_to_apy(_num(row.get("fundingRate"), "funding rate")) for row in payload if isinstance(row, dict)]
        if not rates:
            return FundingHistorySummary(lookback_hours=lookback_hours, average_funding_apy=0, minimum_funding_apy=0, maximum_funding_apy=0, observations=0)
        return FundingHistorySummary(
            lookback_hours=lookback_hours,
            average_funding_apy=round(sum(rates) / len(rates), 6),
            minimum_funding_apy=min(rates),
            maximum_funding_apy=max(rates),
            observations=len(rates),
        )

    return _cached(key, HISTORY_CACHE_TTL, load)


def get_hyperliquid_market(asset: str, dex: str | None = None, lookback_hours: int = 24) -> HyperliquidMarketResponse:
    asset = asset.strip().upper()
    dex = dex.strip() if dex else None
    if not asset or lookback_hours < 1 or lookback_hours > 168:
        raise ValueError("Asset and a 1-168 hour funding lookback are required")
    key = f"market:{dex or 'default'}:{asset}"

    def load_context() -> tuple[dict[str, object], dict[str, object]]:
        body: dict[str, object] = {"type": "metaAndAssetCtxs"}
        if dex:
            body["dex"] = dex
        payload = _post(body)
        if not isinstance(payload, list) or len(payload) != 2 or not isinstance(payload[0], dict) or not isinstance(payload[1], list):
            raise MarketDataError("Malformed Hyperliquid market context")
        universe = payload[0].get("universe")
        if not isinstance(universe, list):
            raise MarketDataError("Malformed Hyperliquid asset metadata")
        for index, metadata in enumerate(universe):
            if isinstance(metadata, dict) and str(metadata.get("name", "")).upper() == asset:
                context = payload[1][index] if index < len(payload[1]) else None
                if not isinstance(context, dict):
                    raise MarketDataError("Missing Hyperliquid asset context")
                return metadata, context
        raise UnknownMarketError(f"Unknown Hyperliquid perpetual asset: {asset}")

    metadata, context = _cached(key, MARKET_CACHE_TTL, load_context)
    mark = _num(context.get("markPx"), "mark price")
    oracle = _num(context.get("oraclePx"), "oracle price")
    hourly = _num(context.get("funding"), "current funding")
    open_interest_base = _num(context.get("openInterest"), "open interest")
    history: FundingHistorySummary | None
    quality = "complete"
    try:
        history = _funding_history(asset, dex, lookback_hours)
    except MarketDataError:
        history = None
        quality = "partial"
    apy = funding_rate_to_apy(hourly)
    return HyperliquidMarketResponse(
        asset=asset,
        market=f"{dex + ':' if dex else ''}{asset}-PERP",
        dex=dex,
        mark_price_usd=mark,
        oracle_price_usd=oracle,
        current_funding_rate_hourly=hourly,
        current_funding_apy=apy,
        funding_direction="longs_pay" if hourly > 0 else "shorts_pay" if hourly < 0 else "neutral",
        open_interest_usd=round(open_interest_base * mark, 2),
        day_volume_usd=_num(context.get("dayNtlVlm"), "day volume"),
        premium=_num(context.get("premium"), "premium") if context.get("premium") is not None else None,
        data_timestamp=datetime.now(timezone.utc).isoformat(),
        data_quality=quality,  # type: ignore[arg-type]
        historical_funding=history,
    )
