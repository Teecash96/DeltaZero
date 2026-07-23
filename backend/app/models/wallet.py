"""Wallet portfolio analysis models."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

WalletNetwork = Literal["ethereum", "arbitrum", "hyperliquid", "okx-earn"]
WalletProtocol = Literal["hyperliquid", "aave", "morpho", "okx-earn"]
WalletStressProfile = Literal["standard", "elevated", "strict"]
WalletAction = Literal["HOLD", "REBALANCE", "REDUCE", "CLOSE"]
WalletStrategyHealth = Literal["healthy", "warning", "fragile", "critical"]
WalletAssessmentStatus = Literal["positions_found", "no_supported_positions", "partial_data", "insufficient_data"]
WalletDataQuality = Literal["complete", "partial", "insufficient"]
PositionType = Literal[
    "spot",
    "lending_supply",
    "lending_borrow",
    "vault_deposit",
    "perpetual_long",
    "perpetual_short",
    "collateral",
    "unknown",
]
DriverState = Literal["positive", "warning", "critical", "unavailable"]


class NormalizedPosition(BaseModel):
    protocol: WalletProtocol
    network: WalletNetwork
    position_type: PositionType
    asset: str
    quantity: float | None = None
    notional_usd: float | None = None
    current_value_usd: float | None = None
    entry_value_usd: float | None = None
    unrealized_pnl_usd: float | None = None
    collateral_usd: float | None = None
    debt_usd: float | None = None
    funding_apy: float | None = None
    liquidation_price: float | None = None
    health_factor: float | None = None
    data_timestamp: str | None = None
    data_quality: WalletDataQuality = "complete"
    market_context: dict[str, object] | None = None
    side: Literal["long", "short"] | None = None
    subaccount_name: str | None = None
    subaccount_address: str | None = None


class WalletExecutiveSummary(BaseModel):
    headline: str
    body: str
    position_count: int
    protocol_count: int
    risk_level: WalletStrategyHealth


class WalletPrimaryDriver(BaseModel):
    metric: str
    label: str
    state: DriverState
    value: float | str | None
    unit: str | None = None
    explanation: str


class WalletPlanStep(BaseModel):
    priority: int
    action: str
    reason: str
    target: str | None = None


class WalletExposureAnalysis(BaseModel):
    gross_exposure_usd: float
    gross_long_exposure_usd: float
    gross_short_exposure_usd: float
    net_delta_usd: float
    net_delta_pct: float
    portfolio_equity_usd: float | None = None
    leverage_ratio: float | None = None
    position_count: int


class WalletAllocationItem(BaseModel):
    asset: str
    exposure_usd: float
    allocation_pct: float


class WalletStressSummary(BaseModel):
    stress_profile: WalletStressProfile
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    dominant_risk: str
    summary: str
    impairment_level: Literal["LOW", "MEDIUM", "HIGH"]
    impairment_label: Literal["Contained", "Elevated", "Critical"]


class WalletRiskContributor(BaseModel):
    asset: str
    protocol: WalletProtocol
    exposure_usd: float
    risk_contribution_pct: float
    primary_risk: str


class WalletRiskTimelineItem(BaseModel):
    metric: str
    state: Literal["healthy", "warning", "critical", "unavailable"]
    explanation: str


class WalletAnalyzeRequest(BaseModel):
    wallet_address: str
    networks: list[WalletNetwork] = Field(min_length=1)
    protocols: list[WalletProtocol] = Field(min_length=1)
    stress_profile: WalletStressProfile = "standard"

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet_address(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Wallet address is required.")
        if not value.startswith("0x") or len(value) != 42:
            raise ValueError("Wallet address must be a 0x-prefixed 40-character hex string.")
        try:
            int(value[2:], 16)
        except ValueError as exc:  # pragma: no cover - defensive validation
            raise ValueError("Wallet address must contain hexadecimal characters only.") from exc
        return value

    @model_validator(mode="after")
    def validate_unique_networks_protocols(self) -> "WalletAnalyzeRequest":
        if len(set(self.networks)) != len(self.networks):
            raise ValueError("Duplicate network values are not allowed.")
        if len(set(self.protocols)) != len(self.protocols):
            raise ValueError("Duplicate protocol values are not allowed.")
        return self


class WalletPortfolioSummary(BaseModel):
    current_position_value_usd: float
    gross_long_exposure_usd: float
    gross_short_exposure_usd: float
    net_delta_usd: float
    net_delta_pct: float
    unrealized_pnl_usd: float | None = None
    collateral_value_usd: float
    debt_value_usd: float
    estimated_funding_exposure_apy: float | None = None


class WalletRiskMetrics(BaseModel):
    hedge_ratio: float | None = None
    hedge_drift_pct: float | None = None
    collateral_health_score: float | None = None
    minimum_health_factor: float | None = None
    liquidation_proximity_pct: float | None = None
    safety_buffer_score: float | None = None
    capital_at_risk_proxy: float | None = None
    estimated_impairment_loss_usd: float | None = None
    estimated_impairment_loss_pct: float | None = None
    post_impairment_equity_usd: float | None = None


class WalletRecommendation(BaseModel):
    action: WalletAction
    summary: str
    confidence: int = Field(ge=0, le=100)


class ProtocolError(BaseModel):
    protocol: WalletProtocol
    network: WalletNetwork
    message: str
    error_type: str
    retryable: bool = False


class WalletPortfolioResponse(BaseModel):
    service: str
    wallet_address: str
    assessment_status: WalletAssessmentStatus
    supported_positions_found: int
    unsupported_positions_found: int
    data_timestamp: str | None
    data_quality: WalletDataQuality
    portfolio_summary: WalletPortfolioSummary
    risk_metrics: WalletRiskMetrics
    strategy_health: WalletStrategyHealth | None
    decision_confidence: int | None = None
    recommendation: WalletRecommendation | None = None
    risk_notes: list[str]
    corrective_actions: list[str]
    positions: list[NormalizedPosition]
    protocol_errors: list[ProtocolError]
    warnings: list[str]
    debug: dict[str, object] | None = None
    executive_summary: WalletExecutiveSummary | None = None
    primary_drivers: list[WalletPrimaryDriver] = Field(default_factory=list)
    recommended_plan: list[WalletPlanStep] = Field(default_factory=list)
    exposure_analysis: WalletExposureAnalysis | None = None
    portfolio_allocation: list[WalletAllocationItem] = Field(default_factory=list)
    stress_summary: WalletStressSummary | None = None
    largest_risk_contributors: list[WalletRiskContributor] = Field(default_factory=list)
    portfolio_observations: list[str] = Field(default_factory=list)
    risk_timeline: list[WalletRiskTimelineItem] = Field(default_factory=list)
