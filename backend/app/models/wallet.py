"""Wallet portfolio analysis models."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

WalletNetwork = Literal["ethereum", "arbitrum", "hyperliquid"]
WalletProtocol = Literal["hyperliquid", "aave", "morpho"]
WalletStressProfile = Literal["standard", "elevated", "strict"]
WalletAction = Literal["HOLD", "REBALANCE", "REDUCE", "CLOSE"]
WalletStrategyHealth = Literal["healthy", "warning", "fragile", "critical"]
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
    hedge_ratio: float | None
    hedge_drift_pct: float | None
    collateral_health_score: float | None
    minimum_health_factor: float | None
    liquidation_proximity_pct: float | None
    safety_buffer_score: float
    capital_at_risk_proxy: float
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float


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
    supported_positions_found: int
    unsupported_positions_found: int
    data_timestamp: str | None
    data_quality: WalletDataQuality
    portfolio_summary: WalletPortfolioSummary
    risk_metrics: WalletRiskMetrics
    strategy_health: WalletStrategyHealth
    recommendation: WalletRecommendation
    risk_notes: list[str]
    corrective_actions: list[str]
    positions: list[NormalizedPosition]
    protocol_errors: list[ProtocolError]
    warnings: list[str]
