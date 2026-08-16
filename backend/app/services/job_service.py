"""Business logic for job creation, paid execution, verification, and Risk Guard."""

from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import json
from typing import Any

from app.models.jobs import (
    ERC8183JobTerms,
    JobCreateRequest,
    JobRecord,
    JobTimelineEvent,
    PaymentReceipt,
    ProofEnvelope,
    RiskGuardSnapshot,
    RiskPolicy,
    utc_now,
)
from app.models.risk_engine import RiskEnginePassRequest
from app.services.erc8183 import ERC8183Adapter, canonical_hash
from app.services.job_store import get_job_store
from app.services.risk_engine import run_risk_engine_pass


def _hash(value: object) -> str:
    return canonical_hash(value)


def _parse_time(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except (TypeError, ValueError):
        return None


def _transition(job: JobRecord, status: Any, message: str) -> JobRecord:
    return job.model_copy(
        update={
            "status": status,
            "updated_at": utc_now(),
            "timeline": [
                *job.timeline,
                JobTimelineEvent(event=status.lower(), status=status, message=message),
            ],
        }
    )


def create_job(request: JobCreateRequest) -> JobRecord:
    policy_hash = _hash(request.risk_policy.model_dump(mode="json"))
    input_hash = _hash(request.input_data)
    erc = ERC8183Adapter().create_job(
        agent_id=request.agent_erc8004_id,
        buyer=request.buyer_address,
        provider=request.provider_address,
        budget_amount=request.budget_amount,
        deadline=request.deadline,
        risk_policy_hash=policy_hash,
        expected_schema_hash=request.expected_schema_hash,
        request_fingerprint=input_hash,
    )
    now = utc_now()
    job = JobRecord(
        id=erc.terms.job_id,
        status="AWAITING_PAYMENT",
        agent_id=request.agent_id,
        agent_erc8004_id=request.agent_erc8004_id,
        agent_name=request.agent_name,
        provider_address=request.provider_address,
        buyer_address=request.buyer_address,
        agent_endpoint=request.agent_endpoint,
        category=request.category,
        objective=request.objective,
        input_data=request.input_data,
        budget_amount=request.budget_amount,
        budget_currency=request.budget_currency,
        deadline=request.deadline,
        risk_policy=request.risk_policy,
        risk_policy_hash=policy_hash,
        expected_schema_hash=request.expected_schema_hash,
        payment_amount=request.payment_amount,
        erc8183=erc.terms,
        execution_mode=erc.terms.mode,
        created_at=now,
        updated_at=now,
        timeline=[
            {"event": "created", "status": "CREATING", "message": erc.message},
            {"event": "awaiting_payment", "status": "AWAITING_PAYMENT", "message": "Job terms are prepared. Payment is required before execution."},
        ],
    )
    return get_job_store().save(job)


def get_job(job_id: str) -> JobRecord | None:
    return get_job_store().get(job_id)


def attach_payment(job_id: str, receipt: PaymentReceipt) -> JobRecord:
    job = _require_job(job_id)
    if job.payment is not None and job.payment.status in {"SETTLED", "SIMULATED"}:
        if job.payment.transaction_hash and receipt.transaction_hash and job.payment.transaction_hash != receipt.transaction_hash:
            raise ValueError("This job already has a different settled payment")
        merged = job.payment.model_copy(
            update={
                key: value
                for key, value in receipt.model_dump(mode="json").items()
                if value is not None and (key != "status" or value == job.payment.status)
            }
        )
        return get_job_store().save(job.model_copy(update={"payment": merged, "updated_at": utc_now()}))
    if receipt.amount != job.payment_amount:
        raise ValueError(f"Payment amount must equal the x402 service price of {job.payment_amount} USDT")
    if receipt.payer and receipt.payer.lower() != job.buyer_address.lower():
        raise ValueError("Payment payer does not match the job buyer")
    updated = _transition(
        job.model_copy(update={"payment": receipt}),
        "PAID",
        "Payment receipt attached and linked to the job.",
    )
    return get_job_store().save(updated)


def execute_job(
    job_id: str,
    *,
    payment_verified: bool = False,
    simulation: bool = False,
    payment_amount: str = "1",
    payment_network: str = "eip155:196",
    payment_payer: str | None = None,
    payment_recipient: str | None = None,
    payment_resource: str | None = None,
    payment_replay_key: str | None = None,
) -> JobRecord:
    job = _require_job(job_id)
    if job.status in {"CANCELLED", "DISPUTED"}:
        raise ValueError(f"Cannot execute a {job.status.lower()} job")
    if job.result is not None:
        return job
    if not payment_verified and not simulation:
        raise ValueError("Execution requires a verified x402 payment or explicit simulation mode")
    if payment_amount != job.payment_amount:
        raise ValueError(
            f"The verified payment price {payment_amount} USDT does not match the job price {job.payment_amount} USDT"
        )

    payment = PaymentReceipt(
        status="SETTLED" if payment_verified else "SIMULATED",
        network=payment_network,
        amount=payment_amount,
        currency=job.budget_currency,
        payer=payment_payer or job.buyer_address,
        recipient=payment_recipient or job.provider_address,
        resource=payment_resource,
        settlement_source="x402" if payment_verified else "simulation",
        replay_key=payment_replay_key,
    )
    running = _transition(job.model_copy(update={"payment": payment}), "RUNNING", "Starting the deterministic agent execution.")
    get_job_store().save(running)
    try:
        request = RiskEnginePassRequest.model_validate(job.input_data)
        result = run_risk_engine_pass(request).model_dump(mode="json", exclude_none=True)
    except Exception as exc:
        failed = _transition(running, "FAILED", f"Agent execution failed: {exc}")
        get_job_store().save(failed)
        raise

    completed = _transition(
        running.model_copy(update={"result": result}),
        "VERIFYING",
        "Agent result received. Schema, identity, payment, and proof checks are pending.",
    )
    return get_job_store().save(completed)


def verify_job(job_id: str) -> JobRecord:
    job = _require_job(job_id)
    if job.result is None:
        raise ValueError("No agent result is available to verify")
    if job.payment is None or job.payment.status not in {"SETTLED", "SIMULATED"}:
        raise ValueError("A verified payment receipt is required before result verification")

    result = job.result
    result_hash = _hash(result)
    request_hash = _hash(job.input_data)
    envelope = result.get("risk_envelope") if isinstance(result, dict) else None
    identity_verified = isinstance(envelope, dict) and envelope.get("subject", {}).get("asset") == job.input_data.get("asset")
    schema_validated = isinstance(result, dict) and all(
        key in result for key in ("generated_at", "risk_envelope", "strategy_build", "hedge_drift_audit", "funding_stress_test", "monte_carlo_sensitivity")
    )
    generated_at = result.get("generated_at") if isinstance(result, dict) else None
    timestamps_verified = _parse_time(generated_at) is not None if generated_at else False
    proof = ProofEnvelope(
        job_id=job.id,
        agent_id=job.agent_erc8004_id,
        expected_schema_hash=job.expected_schema_hash,
        request_hash=request_hash,
        result_hash=result_hash,
        identity_verified=identity_verified,
        job_id_verified=True,
        timestamps_verified=timestamps_verified,
        payment_verified=True,
        schema_validated=schema_validated,
        deterministic=True,
    )
    if not all((identity_verified, timestamps_verified, schema_validated)):
        raise ValueError("Result failed schema, identity, or timestamp verification")
    updated = _transition(job.model_copy(update={"proof": proof}), "MONITORING", "Result verified and proof envelope created.")
    updated = evaluate_risk_guard(updated)
    return get_job_store().save(updated)


def evaluate_risk_guard(job: JobRecord) -> JobRecord:
    if job.result is None:
        snapshot = RiskGuardSnapshot(state="PAUSE", endpoint_available=False, reasons=["No verified result is available."])
    else:
        result = job.result
        envelope = result.get("risk_envelope", {})
        measures = envelope.get("measures", {}) if isinstance(envelope, dict) else {}
        decision = envelope.get("decision", {}) if isinstance(envelope, dict) else {}
        safety = float(measures.get("safety_buffer_score", 0) or 0)
        confidence = float(measures.get("decision_confidence", 0) or 0)
        action = str(decision.get("action", "WAIT"))
        generated_at = _parse_time(str(result.get("generated_at", "")))
        age = max(0.0, (datetime.now(UTC) - generated_at).total_seconds() / 60) if generated_at else None
        deadline = _parse_time(job.deadline)
        deadline_ok = deadline is None or deadline > datetime.now(UTC)
        reasons: list[str] = []
        if not deadline_ok:
            state = "CANCEL"
            reasons.append("Job deadline has passed.")
        elif safety < job.risk_policy.safety_buffer_min:
            state = "PAUSE"
            reasons.append("Safety Buffer is below the job policy threshold.")
        elif confidence < job.risk_policy.decision_confidence_min:
            state = "PAUSE"
            reasons.append("Decision Confidence is below the job policy threshold.")
        elif age is None or age > job.risk_policy.data_freshness_max_minutes:
            state = "WATCH"
            reasons.append("The result is older than the allowed data freshness window.")
        elif action in {"CLOSE", "REDUCE"} or decision.get("risk_zone") == "critical":
            state = "ESCALATE"
            reasons.append("The agent recommends reducing or closing exposure.")
        elif action in {"REBALANCE", "WAIT"} or decision.get("risk_zone") in {"watch", "defensive"}:
            state = "WATCH"
            reasons.append("The result requires operator review before continuing.")
        else:
            state = "ALLOW"
            reasons.append("All configured Risk Guard thresholds are currently satisfied.")
        snapshot = RiskGuardSnapshot(
            state=state,
            safety_buffer=safety,
            decision_confidence=confidence,
            data_age_minutes=age,
            endpoint_available=True,
            deadline_ok=deadline_ok,
            action=action,
            reasons=reasons,
        )
    return job.model_copy(update={"risk_guard": snapshot, "updated_at": utc_now()})


def monitor_job(job_id: str) -> JobRecord:
    job = _require_job(job_id)
    return get_job_store().save(evaluate_risk_guard(job))


def monitor_active_jobs() -> int:
    """Refresh Risk Guard for non-terminal jobs.

    The API can call this from a small background worker. It does not perform
    trades or move funds. It only re-evaluates stored evidence and deadlines.
    """
    active = get_job_store().list(
        statuses={"AWAITING_PAYMENT", "PAYMENT_PENDING", "PAID", "RUNNING", "VERIFYING", "MONITORING"}
    )
    updated = 0
    for job in active:
        get_job_store().save(evaluate_risk_guard(job))
        updated += 1
    return updated


def complete_job(job_id: str, *, human_approved: bool = False) -> JobRecord:
    job = _require_job(job_id)
    if job.status == "COMPLETED":
        return job
    if job.proof is None or job.payment is None:
        raise ValueError("A verified proof envelope and payment receipt are required")
    if job.risk_guard and job.risk_guard.state == "CANCEL":
        raise ValueError("Risk Guard marked this job CANCEL; it cannot be completed")
    if job.risk_guard and job.risk_guard.state not in {"ALLOW", "COMPLETE"} and not human_approved:
        raise ValueError("Human approval is required while Risk Guard is not ALLOW")
    action = job.risk_guard.action if job.risk_guard else None
    if action in job.risk_policy.require_human_approval_for and not human_approved:
        raise ValueError("Human approval is required for this Risk Guard action")
    performance = get_job_store().record_completion(job.agent_id, utc_now())
    updated = _transition(job, "COMPLETED", "Job completed with linked payment receipt and proof envelope.")
    updated = updated.model_copy(update={
        "risk_guard": RiskGuardSnapshot(state="COMPLETE", reasons=["Completion receipt issued."]),
        "agent_performance": performance,
    })
    return get_job_store().save(updated)


def cancel_job(job_id: str) -> JobRecord:
    job = _require_job(job_id)
    return get_job_store().save(_transition(job, "CANCELLED", "Job cancelled by the buyer."))


def dispute_job(job_id: str) -> JobRecord:
    job = _require_job(job_id)
    return get_job_store().save(_transition(job, "DISPUTED", "Job marked for human dispute review."))


def _require_job(job_id: str) -> JobRecord:
    job = get_job(job_id)
    if job is None:
        raise KeyError(job_id)
    return job
