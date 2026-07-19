"""Bundled Risk Engine API route."""

from fastapi import APIRouter, HTTPException, Request

from app.models.payment_recovery import PaymentRecoveryRequest, PaymentRecoveryResponse
from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse
from app.payments import PaymentSettings
from app.services.payment_recovery import (
    PaymentRecoveryError,
    RedemptionStore,
    request_fingerprint,
    verify_direct_transfer,
    verify_payer_signature,
)
from app.services.risk_engine import run_risk_engine_pass

router = APIRouter(prefix="/risk-engine", tags=["risk-engine"])


@router.post("/analyze", response_model=RiskEnginePassResponse)
def risk_engine_analyze(request: RiskEnginePassRequest) -> RiskEnginePassResponse:
    """Return all four premium reports after one x402 payment."""

    return run_risk_engine_pass(request)


@router.post(
    "/recover-payment",
    response_model=PaymentRecoveryResponse,
    include_in_schema=False,
)
def recover_payment(payload: PaymentRecoveryRequest, request: Request) -> PaymentRecoveryResponse:
    """Recover one accidental direct transfer and bind it to one analysis."""

    settings: PaymentSettings | None = getattr(request.app.state, "payment_settings", None)
    if settings is None:
        raise HTTPException(status_code=503, detail="Payment recovery is not configured")
    fingerprint = request_fingerprint(payload.analysis)
    try:
        receipt = verify_direct_transfer(
            payload.transaction_hash,
            payload.payer,
            settings,
        )
        verify_payer_signature(
            payload.transaction_hash,
            payload.payer,
            payload.signature,
        )
        RedemptionStore().claim(payload.transaction_hash, fingerprint, payload.payer)
    except PaymentRecoveryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PaymentRecoveryResponse(
        result=run_risk_engine_pass(payload.analysis),
        receipt=receipt,
        request_fingerprint=fingerprint,
    )
