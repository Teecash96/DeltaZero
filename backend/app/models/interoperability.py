"""Versioned, agent-consumable interoperability contracts."""

from typing import Literal

from pydantic import BaseModel, Field

RiskZone = Literal["optimal", "healthy", "watch", "defensive", "critical"]
EnvelopeAction = Literal["OPEN", "WAIT", "HOLD", "REBALANCE", "REDUCE", "CLOSE"]


class RiskEnvelopeSubject(BaseModel):
    kind: Literal["pseudo_delta_neutral_strategy"] = "pseudo_delta_neutral_strategy"
    asset: str
    strategy_style: str
    capital_usd: float = Field(gt=0)


class RiskEnvelopeMeasures(BaseModel):
    safety_buffer_score: float = Field(ge=0, le=100)
    hedge_drift_pct: float = Field(ge=0)
    net_carry_apy: float
    p95_impairment_pct: float = Field(ge=0)
    probability_capital_impairment_pct: float = Field(ge=0, le=100)
    decision_confidence: int = Field(ge=0, le=100)


class RiskEnvelopeDecision(BaseModel):
    action: EnvelopeAction
    risk_zone: RiskZone
    summary: str
    human_approval_required: bool = True


class RiskEnvelopeEvidence(BaseModel):
    strategy_build_action: str
    hedge_audit_action: str
    funding_stress_action: str
    monte_carlo_action: str
    simulation_count: int = Field(ge=100)
    seed: int | None


class RiskEnvelopeProof(BaseModel):
    """Deterministic commitment that clients can recompute independently."""

    schema_id: Literal["https://deltazero.dev/schemas/risk-proof/v1"] = (
        "https://deltazero.dev/schemas/risk-proof/v1"
    )
    algorithm: Literal["sha256"] = "sha256"
    canonicalization: Literal["json_sort_keys_compact_utf8"] = (
        "json_sort_keys_compact_utf8"
    )
    input_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    output_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    deterministic: Literal[True] = True


class RiskEnvelopeV1(BaseModel):
    """Portable decision artifact embedded in a complete Risk Engine response."""

    schema_id: Literal["https://deltazero.dev/schemas/risk-envelope/v1"] = "https://deltazero.dev/schemas/risk-envelope/v1"
    schema_version: Literal["1.0.0"] = "1.0.0"
    methodology_version: Literal["deltazero-v1"] = "deltazero-v1"
    analysis_id: str
    subject: RiskEnvelopeSubject
    decision: RiskEnvelopeDecision
    measures: RiskEnvelopeMeasures
    evidence: RiskEnvelopeEvidence
    constraints: list[str]
    proof: RiskEnvelopeProof
    compatible_transports: list[Literal["REST", "MCP", "JSON"]] = Field(
        default_factory=lambda: ["REST", "MCP", "JSON"]
    )


class RiskEnvelopeProofVerification(BaseModel):
    """Result of checking a proof against the original request and envelope."""

    valid: bool
    input_hash_matches: bool
    output_hash_matches: bool
    analysis_id_matches: bool
    expected_input_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    expected_output_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
