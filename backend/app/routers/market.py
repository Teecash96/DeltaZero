"""Read-only market context routes."""

from fastapi import APIRouter, HTTPException, Query

from app.models.market import HyperliquidMarketResponse
from app.services.market_data import MarketDataError, UnknownMarketError, get_hyperliquid_market

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/hyperliquid", response_model=HyperliquidMarketResponse)
def hyperliquid_market(
    asset: str = Query(..., min_length=1, max_length=32),
    dex: str | None = Query(default=None, max_length=64),
    lookback_hours: int = Query(default=24, ge=1, le=168),
) -> HyperliquidMarketResponse:
    try:
        return get_hyperliquid_market(asset, dex, lookback_hours)
    except UnknownMarketError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
