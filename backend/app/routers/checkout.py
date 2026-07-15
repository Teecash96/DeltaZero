"""Free browser-checkout control plane; premium output is released only after settlement."""

from fastapi import APIRouter, HTTPException, Request

from app.checkout import (
    CheckoutCreateResponse,
    CheckoutRedeemRequest,
    CheckoutStatusResponse,
    create_checkout,
    get_checkout_status,
    redeem_checkout,
)
from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse
from app.payments import PaymentSettings

router = APIRouter(prefix="/checkout", tags=["checkout"])


def settings_from(request: Request) -> PaymentSettings:
    settings = getattr(request.app.state, "payment_settings", None)
    if settings is None:
        raise HTTPException(status_code=503, detail="Browser checkout is not configured")
    return settings


@router.post("/create", response_model=CheckoutCreateResponse)
async def checkout_create(body: RiskEnginePassRequest, request: Request) -> CheckoutCreateResponse:
    try:
        return await create_checkout(body, settings_from(request))
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/status/{payment_id}", response_model=CheckoutStatusResponse)
async def checkout_status(payment_id: str, request: Request) -> CheckoutStatusResponse:
    try:
        return await get_checkout_status(payment_id, settings_from(request))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/redeem", response_model=RiskEnginePassResponse)
async def checkout_redeem(body: CheckoutRedeemRequest, request: Request) -> RiskEnginePassResponse:
    try:
        return await redeem_checkout(body, settings_from(request))
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
