"""Free discovery endpoints for DeltaZero interoperability contracts."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.models.interoperability import RiskEnvelopeProofVerification, RiskEnvelopeV1
from app.models.risk_engine import RiskEnginePassRequest
from app.services.interoperability import verify_risk_envelope_proof
from app.services.risk_engine import run_risk_engine_pass

router = APIRouter(prefix="/standards", tags=["standards"])
evaluation_router = APIRouter(prefix="/risk-envelope", tags=["standards"])


class RiskEnvelopeVerificationRequest(BaseModel):
    request: RiskEnginePassRequest
    envelope: RiskEnvelopeV1


@router.get("/risk-envelope/v1")
def risk_envelope_schema() -> dict[str, object]:
    """Return the versioned JSON Schema used in complete risk reports."""
    return RiskEnvelopeV1.model_json_schema()


@evaluation_router.post("/evaluate", response_model=RiskEnvelopeV1)
def evaluate_risk_envelope(request: RiskEnginePassRequest) -> RiskEnvelopeV1:
    """Return only the portable envelope from a complete deterministic pass."""
    return run_risk_engine_pass(request).risk_envelope


@evaluation_router.post("/verify", response_model=RiskEnvelopeProofVerification)
def verify_risk_envelope(request: RiskEnvelopeVerificationRequest) -> RiskEnvelopeProofVerification:
    """Verify a Risk Envelope proof against its original request assumptions."""
    return verify_risk_envelope_proof(request.request, request.envelope)
