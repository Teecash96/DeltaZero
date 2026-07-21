"""Natural-language explanation contracts for deterministic risk results."""

from typing import Literal

from pydantic import BaseModel, Field


class RiskExplanation(BaseModel):
    """A bounded narrative derived from an existing deterministic report."""

    headline: str = Field(min_length=1, max_length=120)
    explanation: str = Field(min_length=1, max_length=700)
    key_drivers: list[str] = Field(min_length=1, max_length=4)
    recommended_next_step: str = Field(min_length=1, max_length=240)
    time_horizon_hours: float | None = Field(default=None, gt=0)
    source: Literal["openai", "deterministic_fallback"]
    model: str | None = None
    fallback_reason: Literal[
        "missing_api_key",
        "provider_error",
        "invalid_structured_output",
        "grounding_validation_failed",
    ] | None = None
    provider_status_code: int | None = Field(default=None, ge=100, le=599)
    provider_error_code: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    analysis_id: str
    facts_used: list[str] = Field(min_length=1, max_length=10)
    limitations: list[str] = Field(min_length=1, max_length=5)
