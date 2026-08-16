"""Phase 2 hire, payment, verification, and Risk Guard routes."""

from __future__ import annotations

import os
import hashlib
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.models.jobs import (
    JobActionResponse,
    JobCreateRequest,
    JobRecord,
    PaymentAttachRequest,
    PaymentReceipt,
)
from app.payments import PaymentSettings, canonical_payment_price
from app.services.job_service import (
    attach_payment,
    cancel_job,
    complete_job,
    create_job,
    dispute_job,
    execute_job,
    get_job,
    monitor_job,
    verify_job,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_or_404(job_id: str) -> JobRecord:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobRecord, status_code=201, include_in_schema=False)
def create_hire_job(payload: JobCreateRequest) -> JobRecord:
    try:
        return create_job(payload)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{job_id}", response_model=JobRecord)
def read_job(job_id: str) -> JobRecord:
    return _get_or_404(job_id)


@router.get("/{job_id}/payment-challenge")
def payment_challenge(job_id: str, request: Request) -> dict[str, Any]:
    job = _get_or_404(job_id)
    settings: PaymentSettings | None = getattr(request.app.state, "payment_settings", None)
    if settings is None:
        return {
            "job_id": job.id,
            "x402_required": True,
            "configured": False,
            "message": "x402 payment settings are not configured on this deployment.",
        }
    return {
        "job_id": job.id,
        "x402_required": True,
        "configured": True,
        "network": settings.network,
        "amount": job.payment_amount,
        "currency": job.budget_currency,
        "recipient": settings.receiver,
        "resource": f"{settings.public_api_base_url}/jobs/execute",
        "schemes": ["exact", "aggr_deferred"],
        "message": "Use an x402-compatible client to pay and replay POST /jobs/execute.",
    }


@router.post("/execute", response_model=JobRecord)
def execute_paid_job(payload: dict[str, str], request: Request) -> JobRecord:
    """Execute one job after the x402 middleware has verified the request.

    This endpoint is intentionally idempotent. A replay with the same payment
    proof is served from the middleware replay store and this handler returns
    the already stored result without creating another settlement.
    """

    job_id = payload.get("job_id")
    if not job_id:
        raise HTTPException(status_code=422, detail="job_id is required")
    settings: PaymentSettings | None = getattr(request.app.state, "payment_settings", None)
    simulation = settings is None and os.getenv("DELTAZERO_JOB_SIMULATION", "false").lower() == "true"
    if settings is None and not simulation:
        raise HTTPException(status_code=503, detail="Live x402 payment settings are not configured")
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if settings is not None and job.payment_amount != settings.price_usdt:
        raise HTTPException(
            status_code=409,
            detail="Job x402 price does not match the deployment payment price; create a new job.",
        )
    payment_signature = request.headers.get("payment-signature") or request.headers.get("x-payment")
    try:
        return execute_job(
            job_id,
            payment_verified=settings is not None,
            simulation=simulation,
            payment_amount=settings.price_usdt if settings else canonical_payment_price(),
            payment_network=settings.network if settings else "simulation",
            payment_payer=None,
            payment_recipient=settings.receiver if settings else None,
            payment_resource=f"{settings.public_api_base_url}/jobs/execute" if settings else None,
            payment_replay_key=hashlib.sha256(payment_signature.encode()).hexdigest()[:32] if payment_signature else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{job_id}/payment", response_model=JobActionResponse, include_in_schema=False)
def attach_job_payment(job_id: str, payload: PaymentAttachRequest) -> JobActionResponse:
    try:
        receipt = PaymentReceipt(
            status=payload.status,
            network=payload.network,
            amount=payload.amount,
            currency=payload.currency,
            payer=payload.payer,
            recipient=payload.recipient,
            transaction_hash=payload.transaction_hash,
            resource=payload.resource,
            payment_response_header=payload.payment_response_header,
            settlement_source=payload.settlement_source,
        )
        job = attach_payment(job_id, receipt)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return JobActionResponse(job=job, message="Payment receipt linked to the job.")


@router.post("/{job_id}/verify", response_model=JobActionResponse, include_in_schema=False)
def verify_job_result(job_id: str) -> JobActionResponse:
    try:
        job = verify_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return JobActionResponse(job=job, message="Result verified and proof envelope stored.")


@router.post("/{job_id}/monitor", response_model=JobActionResponse, include_in_schema=False)
def monitor_job_risk(job_id: str) -> JobActionResponse:
    try:
        job = monitor_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    return JobActionResponse(job=job, message="Risk Guard snapshot refreshed.")


@router.post("/{job_id}/complete", response_model=JobActionResponse, include_in_schema=False)
def complete_hire_job(job_id: str, payload: dict[str, bool] | None = None) -> JobActionResponse:
    try:
        job = complete_job(job_id, human_approved=bool((payload or {}).get("human_approved", False)))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return JobActionResponse(job=job, message="Completion receipt issued.")


@router.post("/{job_id}/cancel", response_model=JobActionResponse, include_in_schema=False)
def cancel_hire_job(job_id: str) -> JobActionResponse:
    try:
        job = cancel_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    return JobActionResponse(job=job, message="Job cancelled.")


@router.post("/{job_id}/dispute", response_model=JobActionResponse, include_in_schema=False)
def dispute_hire_job(job_id: str) -> JobActionResponse:
    try:
        job = dispute_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    return JobActionResponse(job=job, message="Job moved to dispute review.")
