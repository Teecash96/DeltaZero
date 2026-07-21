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
    compatible_transports: list[Literal["REST", "MCP", "JSON"]] = Field(
        default_factory=lambda: ["REST", "MCP", "JSON"]
    )
