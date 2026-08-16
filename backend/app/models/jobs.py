"""Typed contracts for the Phase 2 hire and Risk Guard flow."""

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


JobStatus = Literal[
    "DRAFT",
    "CREATING",
    "AWAITING_PAYMENT",
    "PAYMENT_PENDING",
    "PAID",
    "RUNNING",
    "VERIFYING",
    "MONITORING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "DISPUTED",
]

RiskGuardState = Literal["ALLOW", "WATCH", "PAUSE", "ESCALATE", "CANCEL", "COMPLETE"]
PaymentState = Literal["PENDING", "SETTLED", "FAILED", "SIMULATED"]
ExecutionMode = Literal["erc8183_live", "simulation"]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class RiskPolicy(BaseModel):
    safety_buffer_min: float = Field(default=50, ge=0, le=100)
    decision_confidence_min: float = Field(default=70, ge=0, le=100)
    data_freshness_max_minutes: int = Field(default=30, ge=1, le=10_080)
    require_human_approval_for: list[str] = Field(
        default_factory=lambda: ["ADJUST", "REDUCE", "CLOSE"]
    )
    endpoint_timeout_seconds: int = Field(default=10, ge=1, le=120)


class ERC8183JobTerms(BaseModel):
    chain_id: int = 56
    contract_address: str | None = None
    job_id: str
    agent_id: str
    buyer: str
    provider: str
    budget_amount: str
    budget_currency: str = "USDT"
    deadline: str
    risk_policy_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    expected_schema_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    mode: ExecutionMode
    transaction_hash: str | None = None


class PaymentReceipt(BaseModel):
    status: PaymentState
    network: str
    amount: str
    currency: str = "USDT"
    payer: str | None = None
    recipient: str | None = None
    transaction_hash: str | None = None
    resource: str | None = None
    payment_response_header: str | None = None
    settlement_source: Literal["x402", "simulation", "manual"] = "x402"
    verified_at: str = Field(default_factory=utc_now)
    replay_key: str | None = None


class RiskGuardSnapshot(BaseModel):
    state: RiskGuardState
    safety_buffer: float | None = None
    decision_confidence: float | None = None
    data_age_minutes: float | None = None
    endpoint_available: bool = True
    deadline_ok: bool = True
    action: str | None = None
    reasons: list[str] = Field(default_factory=list)
    checked_at: str = Field(default_factory=utc_now)


class ProofEnvelope(BaseModel):
    schema_id: str = "https://deltazero.dev/schemas/job-proof/v1"
    schema_version: str = "1.0.0"
    job_id: str
    agent_id: str
    expected_schema_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    request_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    result_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    identity_verified: bool
    job_id_verified: bool
    timestamps_verified: bool
    payment_verified: bool
    schema_validated: bool = True
    deterministic: bool
    created_at: str = Field(default_factory=utc_now)


class JobTimelineEvent(BaseModel):
    event: str
    status: JobStatus
    message: str
    at: str = Field(default_factory=utc_now)


class JobCreateRequest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=128)
    agent_erc8004_id: str = Field(min_length=1, max_length=128)
    agent_name: str = Field(min_length=1, max_length=160)
    provider_address: str = Field(min_length=42, max_length=42)
    buyer_address: str = Field(min_length=42, max_length=42)
    agent_endpoint: str | None = None
    agent_verified: bool = True
    agent_status: Literal["ACTIVE"] = "ACTIVE"
    category: str = Field(min_length=1, max_length=64)
    objective: str = Field(min_length=5, max_length=2_000)
    input_data: dict[str, Any]
    budget_amount: str = Field(pattern=r"^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$")
    budget_currency: str = "USDT"
    deadline: str
    risk_policy: RiskPolicy = Field(default_factory=RiskPolicy)
    expected_schema_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    payment_amount: str = Field(default="1", pattern=r"^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$")
    allow_simulation: bool = False

    @model_validator(mode="after")
    def validate_verified_agent(self) -> "JobCreateRequest":
        if not self.agent_verified or self.agent_status != "ACTIVE":
            raise ValueError("Only verified ACTIVE agents can be hired")
        if self.budget_currency != "USDT":
            raise ValueError("Phase 2 currently supports USDT budgets only")
        return self


class PaymentAttachRequest(BaseModel):
    amount: str
    currency: str = "USDT"
    network: str
    payer: str | None = None
    recipient: str | None = None
    transaction_hash: str | None = None
    resource: str | None = None
    status: Literal["SETTLED", "SIMULATED"]
    payment_response_header: str | None = None
    settlement_source: Literal["x402", "simulation", "manual"] = "x402"


class JobRecord(BaseModel):
    id: str
    status: JobStatus
    agent_id: str
    agent_erc8004_id: str
    agent_name: str
    provider_address: str
    buyer_address: str
    agent_endpoint: str | None = None
    category: str
    objective: str
    input_data: dict[str, Any]
    budget_amount: str
    budget_currency: str
    deadline: str
    risk_policy: RiskPolicy
    risk_policy_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    expected_schema_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    payment_amount: str = Field(default="1", pattern=r"^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$")
    erc8183: ERC8183JobTerms
    execution_mode: ExecutionMode
    payment: PaymentReceipt | None = None
    result: dict[str, Any] | None = None
    proof: ProofEnvelope | None = None
    risk_guard: RiskGuardSnapshot | None = None
    agent_performance: dict[str, Any] | None = None
    timeline: list[JobTimelineEvent] = Field(default_factory=list)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class JobActionResponse(BaseModel):
    job: JobRecord
    message: str
