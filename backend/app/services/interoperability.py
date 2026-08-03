"""Build the stable DeltaZero Risk Envelope from existing engine outputs."""

import hashlib
import json
from typing import Any

from app.models.interoperability import (
    RiskEnvelopeDecision,
    RiskEnvelopeEvidence,
    RiskEnvelopeMeasures,
    RiskEnvelopeProof,
    RiskEnvelopeProofVerification,
    RiskEnvelopeSubject,
    RiskEnvelopeV1,
)
from app.models.monte_carlo import MonteCarloResponse
from app.models.risk_engine import RiskEnginePassRequest
from app.models.schemas import AuditResponse, BuildResponse, StressTestResponse

ACTION_PRIORITY = {
    "OPEN": (0, "OPEN"), "PROCEED": (0, "OPEN"), "HOLD": (1, "HOLD"),
    "WAIT": (2, "WAIT"), "ADJUST": (3, "REBALANCE"), "REBALANCE": (3, "REBALANCE"),
    "REDUCE": (4, "REDUCE"), "AVOID": (4, "REDUCE"), "CLOSE": (5, "CLOSE"),
}


def canonical_json(value: Any) -> bytes:
    """Serialize a proof value using the public, deterministic wire format."""

    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def _request_hash(request: RiskEnginePassRequest) -> str:
    return canonical_hash(
        request.model_dump(mode="json", exclude={"include_ai_explanation"})
    )


def _envelope_output_hash(envelope: RiskEnvelopeV1) -> str:
    """Hash the envelope body without the proof to avoid self-reference."""

    return canonical_hash(envelope.model_dump(mode="json", exclude={"proof"}))


def _risk_zone(safety: float, drift: float, p95: float, action: str) -> str:
    if action == "CLOSE" or safety < 35 or drift > 25 or p95 > 20: return "critical"
    if action == "REDUCE" or safety < 50 or drift > 15 or p95 > 12: return "defensive"
    if action in {"REBALANCE", "WAIT"} or safety < 65 or drift > 8 or p95 > 6: return "watch"
    if safety >= 80 and drift <= 5 and p95 <= 4 and action in {"OPEN", "HOLD"}: return "optimal"
    return "healthy"


def build_risk_envelope(request: RiskEnginePassRequest, build: BuildResponse, audit: AuditResponse, stress: StressTestResponse, monte_carlo: MonteCarloResponse) -> RiskEnvelopeV1:
    """Normalize four coordinated reports into one stable decision contract."""
    module_actions = [build.recommendation.action, audit.recommendation.action, stress.recommendation.action, monte_carlo.summary.recommendation]
    action = max((ACTION_PRIORITY[item] for item in module_actions), key=lambda item: item[0])[1]
    p95 = monte_carlo.summary.p95_impairment_loss_pct
    zone = _risk_zone(build.metrics.safety_buffer_score, audit.metrics.hedge_drift_pct, p95, action)
    input_hash = _request_hash(request)
    envelope = RiskEnvelopeV1(
        analysis_id=f"dz_{input_hash[:24]}",
        subject=RiskEnvelopeSubject(asset=request.asset, strategy_style=request.target_style, capital_usd=request.capital_usd),
        decision=RiskEnvelopeDecision(action=action, risk_zone=zone, summary=f"Consolidated {zone} risk zone from Strategy Build, Hedge-Drift, Funding Stress, and Monte Carlo evidence."),
        measures=RiskEnvelopeMeasures(
            safety_buffer_score=build.metrics.safety_buffer_score,
            hedge_drift_pct=audit.metrics.hedge_drift_pct,
            net_carry_apy=build.metrics.estimated_net_carry_apy,
            p95_impairment_pct=p95,
            probability_capital_impairment_pct=monte_carlo.summary.probability_capital_impairment_pct,
            decision_confidence=min(build.decision_confidence, audit.decision_confidence, stress.decision_confidence),
        ),
        evidence=RiskEnvelopeEvidence(
            strategy_build_action=build.recommendation.action,
            hedge_audit_action=audit.recommendation.action,
            funding_stress_action=stress.recommendation.action,
            monte_carlo_action=monte_carlo.summary.recommendation,
            simulation_count=monte_carlo.simulation_count,
            seed=monte_carlo.seed,
        ),
        constraints=[
            "Read-only decision support; not an execution authorization.",
            "Safety Buffer is a heuristic, not a liquidation probability.",
            "Consumers must verify venue rules, liquidity, oracle behavior, and transaction costs.",
        ],
        proof=RiskEnvelopeProof(input_hash=input_hash, output_hash="0" * 64),
    )
    output_hash = _envelope_output_hash(envelope)
    return envelope.model_copy(
        update={
            "proof": RiskEnvelopeProof(
                input_hash=input_hash,
                output_hash=output_hash,
            )
        }
    )


def verify_risk_envelope_proof(
    request: RiskEnginePassRequest,
    envelope: RiskEnvelopeV1,
) -> RiskEnvelopeProofVerification:
    """Verify input commitment, output integrity, and deterministic analysis ID."""

    expected_input_hash = _request_hash(request)
    expected_output_hash = _envelope_output_hash(envelope)
    input_hash_matches = envelope.proof.input_hash == expected_input_hash
    output_hash_matches = envelope.proof.output_hash == expected_output_hash
    analysis_id_matches = envelope.analysis_id == f"dz_{expected_input_hash[:24]}"
    return RiskEnvelopeProofVerification(
        valid=input_hash_matches and output_hash_matches and analysis_id_matches,
        input_hash_matches=input_hash_matches,
        output_hash_matches=output_hash_matches,
        analysis_id_matches=analysis_id_matches,
        expected_input_hash=expected_input_hash,
        expected_output_hash=expected_output_hash,
    )
