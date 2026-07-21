"""Models for the public, no-wallet strategy comparison preview."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models.schemas import Asset, BuildResponse, RiskTolerance


class StrategyPreviewRequest(BaseModel):
    asset: Asset = "SOL"
    capital_usd: float = Field(default=5000, gt=0, le=1_000_000)
    risk_tolerance: RiskTolerance = "medium"
    long_yield_apy: float = Field(default=14, ge=-100, le=500)
    short_funding_apy: float = Field(default=3, ge=-500, le=500)
    fee_drag_apy: float = Field(default=1, ge=0, le=100)


class StrategyPreviewResponse(BaseModel):
    mode: Literal["public_preview"] = "public_preview"
    methodology: Literal["deltazero_v1"] = "deltazero_v1"
    conservative: BuildResponse
    aggressive: BuildResponse
    limitation: str
