"""Contracts for recovering a verified direct token payment."""

from pydantic import BaseModel, Field, field_validator

from app.models.risk_engine import RiskEnginePassRequest, RiskEnginePassResponse


class PaymentRecoveryRequest(BaseModel):
    transaction_hash: str
    payer: str
    signature: str
    analysis: RiskEnginePassRequest

    @field_validator("transaction_hash")
    @classmethod
    def validate_transaction_hash(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) != 66 or not normalized.startswith("0x"):
            raise ValueError("transaction_hash must be a 32-byte hexadecimal hash")
        int(normalized[2:], 16)
        return normalized

    @field_validator("payer")
    @classmethod
    def validate_payer(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) != 42 or not normalized.startswith("0x"):
            raise ValueError("payer must be a 20-byte EVM address")
        int(normalized[2:], 16)
        return normalized

    @field_validator("signature")
    @classmethod
    def validate_signature(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) != 132 or not normalized.startswith("0x"):
            raise ValueError("signature must be a 65-byte hexadecimal signature")
        int(normalized[2:], 16)
        return normalized


class RecoveredPaymentReceipt(BaseModel):
    transaction: str
    network: str = "eip155:196"
    payer: str
    receiver: str
    asset: str
    amount_atomic: str
    block_number: int
    status: str = "recovered"
    transfer_verified: bool = True


class PaymentRecoveryResponse(BaseModel):
    result: RiskEnginePassResponse
    receipt: RecoveredPaymentReceipt
    request_fingerprint: str = Field(min_length=64, max_length=64)
