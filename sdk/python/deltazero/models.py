from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

Asset = Literal["SOL", "ETH"]
RiskTolerance = Literal["low", "medium", "high"]
TargetStyle = Literal["neutral_yield", "conservative_income", "aggressive_carry", "capital_preservation"]
StrategyAction = Literal["OPEN", "WAIT", "HOLD", "REBALANCE", "REDUCE", "CLOSE"]
StrategyHealth = Literal["healthy", "warning", "critical"]
ScenarioType = Literal["funding_worsens", "price_drop", "price_rise", "yield_drops"]
WalletNetwork = Literal["ethereum", "arbitrum", "hyperliquid"]
WalletProtocol = Literal["hyperliquid", "aave", "morpho"]
WalletStressProfile = Literal["standard", "elevated", "strict"]
WalletAction = Literal["HOLD", "REBALANCE", "REDUCE", "CLOSE"]
WalletStrategyHealth = Literal["healthy", "warning", "fragile", "critical"]
WalletDataQuality = Literal["complete", "partial", "insufficient"]
WalletAssessmentStatus = Literal["positions_found", "no_supported_positions", "partial_data", "insufficient_data"]
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


class Metrics(TypedDict):
    hedge_ratio: float
    hedge_drift_pct: float
    net_delta_estimate: float
    estimated_net_carry_apy: float
    carry_efficiency_score: float
    safety_buffer_score: float
    capital_at_risk_proxy: float


class Recommendation(TypedDict):
    action: StrategyAction
    summary: str


class RecommendedStructure(TypedDict):
    long_notional_usd: float
    short_notional_usd: float
    collateral_usd: float
    target_hedge_ratio: float


class Scenario(TypedDict, total=False):
    type: ScenarioType
    magnitude_pct: float
    asset_price_change_pct: float | None
    collateral_haircut_pct: float | None
    exit_slippage_pct: float | None
    liquidation_penalty_pct: float | None
    protocol_loss_pct: float | None


class ImpairmentBreakdown(TypedDict):
    asset_value_impact_usd: float
    hedge_pnl_impact_usd: float
    collateral_haircut_usd: float
    exit_slippage_usd: float
    liquidation_penalty_usd: float
    protocol_loss_assumption_usd: float


class ScenarioResult(TypedDict):
    scenario_type: ScenarioType
    magnitude_pct: float
    stressed_long_notional_usd: float
    stressed_short_notional_usd: float
    stressed_collateral_usd: float
    stressed_long_yield_apy: float
    stressed_short_funding_apy: float
    stressed_metrics: Metrics
    health_after_stress: StrategyHealth
    pre_stress_equity_usd: float
    stressed_liabilities_usd: float
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    impairment_breakdown: ImpairmentBreakdown


class BuildRequest(TypedDict):
    asset: Asset
    capital_usd: float
    risk_tolerance: RiskTolerance
    target_style: TargetStyle
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float
    market_data_mode: NotRequired[Literal["manual", "hyperliquid"]]
    funding_lookback_hours: NotRequired[int]
    override_live_funding: NotRequired[bool]
    market_dex: NotRequired[str | None]
    wallet_exposure: NotRequired[dict[str, object] | None]


class AuditRequest(TypedDict):
    asset: Asset
    long_notional_usd: float
    short_notional_usd: float
    collateral_usd: float
    risk_tolerance: RiskTolerance
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float


class StressTestRequest(TypedDict):
    asset: Asset
    long_notional_usd: float
    short_notional_usd: float
    collateral_usd: float
    risk_tolerance: RiskTolerance
    long_yield_apy: float
    short_funding_apy: float
    fee_drag_apy: float
    existing_unrealized_pnl_usd: float
    liabilities_usd: float
    scenario: Scenario


class StrategyResponseBase(TypedDict):
    service: str
    strategy_name: str
    asset: Asset
    strategy_health: StrategyHealth
    decision_confidence: int
    metrics: Metrics
    recommendation: Recommendation
    risk_notes: list[str]


class BuildResponse(StrategyResponseBase):
    recommended_structure: RecommendedStructure
    market_data_source: NotRequired[Literal["hyperliquid"]]
    market_data_timestamp: NotRequired[str]
    funding_rate_apy: NotRequired[float]
    funding_contribution_apy: NotRequired[float]
    market_data_quality: NotRequired[Literal["complete", "partial", "unavailable"]]
    market_context: NotRequired[dict[str, object]]
    hedge_adjustment: NotRequired[dict[str, object]]


class AuditResponse(StrategyResponseBase):
    actions: list[StrategyAction]


class StressTestResponse(StrategyResponseBase):
    actions: list[StrategyAction]
    scenario_result: ScenarioResult
    pre_stress_equity_usd: float
    stressed_liabilities_usd: float
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    impairment_breakdown: ImpairmentBreakdown


class RiskEnvelopeRequest(BuildRequest, total=False):
    stress_magnitude_pct: float
    simulation_count: int
    time_horizon_days: int
    seed: int | None


class RiskEnvelopeV1(TypedDict):
    schema_id: Literal["https://deltazero.dev/schemas/risk-envelope/v1"]
    schema_version: Literal["1.0.0"]
    methodology_version: Literal["deltazero-v1"]
    analysis_id: str
    subject: dict[str, object]
    decision: dict[str, object]
    measures: dict[str, float | int]
    evidence: dict[str, object]
    constraints: list[str]
    compatible_transports: list[Literal["REST", "MCP", "JSON"]]


class RiskExplanation(TypedDict):
    headline: str
    explanation: str
    key_drivers: list[str]
    recommended_next_step: str
    time_horizon_hours: float | None
    source: Literal["openai", "deterministic_fallback"]
    model: str | None
    fallback_reason: Literal[
        "missing_api_key",
        "provider_error",
        "invalid_structured_output",
        "grounding_validation_failed",
    ] | None
    analysis_id: str
    facts_used: list[str]
    limitations: list[str]


class NormalizedPosition(TypedDict, total=False):
    protocol: WalletProtocol
    network: WalletNetwork
    position_type: PositionType
    asset: str
    quantity: float | None
    notional_usd: float | None
    current_value_usd: float | None
    entry_value_usd: float | None
    unrealized_pnl_usd: float | None
    collateral_usd: float | None
    debt_usd: float | None
    funding_apy: float | None
    liquidation_price: float | None
    health_factor: float | None
    data_timestamp: str | None
    data_quality: WalletDataQuality
    side: Literal["long", "short"] | None
    subaccount_name: str | None
    subaccount_address: str | None
    market_context: dict[str, object] | None


class WalletExecutiveSummary(TypedDict):
    headline: str
    body: str
    position_count: int
    protocol_count: int
    risk_level: WalletStrategyHealth


class WalletPrimaryDriver(TypedDict):
    metric: str
    label: str
    state: Literal["positive", "warning", "critical", "unavailable"]
    value: float | None
    unit: str | None
    explanation: str


class WalletPlanStep(TypedDict):
    priority: int
    action: str
    reason: str
    target: str | None


class WalletExposureAnalysis(TypedDict):
    gross_exposure_usd: float
    gross_long_exposure_usd: float
    gross_short_exposure_usd: float
    net_delta_usd: float
    net_delta_pct: float
    portfolio_equity_usd: float | None
    leverage_ratio: float | None
    position_count: int


class WalletAllocationItem(TypedDict):
    asset: str
    exposure_usd: float
    allocation_pct: float


class WalletStressSummary(TypedDict):
    stress_profile: WalletStressProfile
    estimated_impairment_loss_usd: float
    estimated_impairment_loss_pct: float
    post_impairment_equity_usd: float
    dominant_risk: str
    summary: str
    impairment_level: Literal["LOW", "MEDIUM", "HIGH"]
    impairment_label: Literal["Contained", "Elevated", "Critical"]


class WalletRiskContributor(TypedDict):
    asset: str
    protocol: WalletProtocol
    exposure_usd: float
    risk_contribution_pct: float
    primary_risk: str


class WalletRiskTimelineItem(TypedDict):
    metric: str
    state: Literal["healthy", "warning", "critical", "unavailable"]
    explanation: str


class WalletAnalyzeRequest(TypedDict):
    wallet_address: str
    networks: list[WalletNetwork]
    protocols: list[WalletProtocol]
    stress_profile: WalletStressProfile


class WalletPortfolioSummary(TypedDict):
    current_position_value_usd: float
    gross_long_exposure_usd: float
    gross_short_exposure_usd: float
    net_delta_usd: float
    net_delta_pct: float
    unrealized_pnl_usd: float | None
    collateral_value_usd: float
    debt_value_usd: float
    estimated_funding_exposure_apy: float | None


class WalletRiskMetrics(TypedDict):
    hedge_ratio: float | None
    hedge_drift_pct: float | None
    collateral_health_score: float | None
    minimum_health_factor: float | None
    liquidation_proximity_pct: float | None
    safety_buffer_score: float | None
    capital_at_risk_proxy: float | None
    estimated_impairment_loss_usd: float | None
    estimated_impairment_loss_pct: float | None
    post_impairment_equity_usd: float | None


class WalletRecommendation(TypedDict):
    action: WalletAction
    summary: str
    confidence: int


class ProtocolError(TypedDict):
    protocol: WalletProtocol
    network: WalletNetwork
    message: str
    error_type: str
    retryable: bool


class WalletPortfolioResponse(TypedDict):
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
    decision_confidence: int | None
    recommendation: WalletRecommendation | None
    executive_summary: WalletExecutiveSummary | None
    primary_drivers: list[WalletPrimaryDriver]
    recommended_plan: list[WalletPlanStep]
    exposure_analysis: WalletExposureAnalysis | None
    portfolio_allocation: list[WalletAllocationItem]
    stress_summary: WalletStressSummary | None
    largest_risk_contributors: list[WalletRiskContributor]
    portfolio_observations: list[str]
    risk_timeline: list[WalletRiskTimelineItem]
    risk_notes: list[str]
    corrective_actions: list[str]
    positions: list[NormalizedPosition]
    protocol_errors: list[ProtocolError]
    warnings: list[str]
