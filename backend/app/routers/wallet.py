"""Wallet portfolio analysis routes."""

from fastapi import APIRouter, HTTPException, Request

from app.models.wallet import WalletAnalyzeRequest, WalletPortfolioResponse
from app.services.wallet_analyzer import analyze_wallet

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.post("/analyze", response_model=WalletPortfolioResponse)
def wallet_analyze(
    request: WalletAnalyzeRequest,
    http_request: Request,
) -> WalletPortfolioResponse:
    try:
        caller_id = http_request.client.host if http_request.client else "unknown"
        return analyze_wallet(request, caller_id=caller_id)
    except ValueError as exc:
        if "rate limit" in str(exc).lower():
            raise HTTPException(status_code=429, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
