"""Read-only normalized market data models."""

from typing import Literal

from pydantic import BaseModel, Field


class FundingHistorySummary(BaseModel):
    lookback_hours: int
    average_funding_apy: float
    minimum_funding_apy: float
    maximum_funding_apy: float
    observations: int


class HyperliquidMarketResponse(BaseModel):
    source: Literal["hyperliquid"] = "hyperliquid"
    asset: str
    market: str
    dex: str | None = None
    mark_price_usd: float
    oracle_price_usd: float
    current_funding_rate_hourly: float
    current_funding_apy: float
    funding_direction: Literal["longs_pay", "shorts_pay", "neutral"]
    open_interest_usd: float
    day_volume_usd: float
    premium: float | None = None
    data_timestamp: str
    data_quality: Literal["complete", "partial", "unavailable"]
    historical_funding: FundingHistorySummary | None = None


class MarketQuery(BaseModel):
    asset: str = Field(min_length=1, max_length=32)
    dex: str | None = Field(default=None, max_length=64)
    lookback_hours: int = Field(default=24, ge=1, le=168)
