export type Asset = "SOL" | "ETH";
export type RiskTolerance = "low" | "medium" | "high";
export type TargetStyle =
  | "neutral_yield"
  | "conservative_income"
  | "aggressive_carry"
  | "capital_preservation";
export type StrategyAction =
  | "OPEN"
  | "WAIT"
  | "HOLD"
  | "REBALANCE"
  | "REDUCE"
  | "CLOSE";
export type StrategyHealth = "healthy" | "warning" | "critical";
export type ScenarioType =
  | "funding_worsens"
  | "price_drop"
  | "price_rise"
  | "yield_drops";
export type WalletNetwork = "ethereum" | "arbitrum" | "hyperliquid";
export type WalletProtocol = "hyperliquid" | "aave" | "morpho";
export type WalletStressProfile = "standard" | "elevated" | "strict";
export type WalletAction = "HOLD" | "REBALANCE" | "REDUCE" | "CLOSE";
export type WalletStrategyHealth = "healthy" | "warning" | "fragile" | "critical";
export type WalletDataQuality = "complete" | "partial" | "insufficient";
export type WalletAssessmentStatus =
  | "positions_found"
  | "no_supported_positions"
  | "partial_data"
  | "insufficient_data";
export type PositionType =
  | "spot"
  | "lending_supply"
  | "lending_borrow"
  | "vault_deposit"
  | "perpetual_long"
  | "perpetual_short"
  | "collateral"
  | "unknown";

export interface Metrics {
  hedge_ratio: number;
  hedge_drift_pct: number;
  net_delta_estimate: number;
  estimated_net_carry_apy: number;
  carry_efficiency_score: number;
  safety_buffer_score: number;
  capital_at_risk_proxy: number;
}

export interface Recommendation {
  action: StrategyAction;
  summary: string;
}

export interface RecommendedStructure {
  long_notional_usd: number;
  short_notional_usd: number;
  collateral_usd: number;
  target_hedge_ratio: number;
}

export interface Scenario {
  type: ScenarioType;
  magnitude_pct: number;
  asset_price_change_pct?: number | null;
  collateral_haircut_pct?: number | null;
  exit_slippage_pct?: number | null;
  liquidation_penalty_pct?: number | null;
  protocol_loss_pct?: number | null;
}

export interface ScenarioResult {
  scenario_type: ScenarioType;
  magnitude_pct: number;
  stressed_long_notional_usd: number;
  stressed_short_notional_usd: number;
  stressed_collateral_usd: number;
  stressed_long_yield_apy: number;
  stressed_short_funding_apy: number;
  stressed_metrics: Metrics;
  health_after_stress: StrategyHealth;
  pre_stress_equity_usd: number;
  stressed_liabilities_usd: number;
  estimated_impairment_loss_usd: number;
  estimated_impairment_loss_pct: number;
  post_impairment_equity_usd: number;
  impairment_breakdown: ImpairmentBreakdown;
}

export interface BuildRequest {
  asset: Asset;
  capital_usd: number;
  risk_tolerance: RiskTolerance;
  target_style: TargetStyle;
  long_yield_apy: number;
  short_funding_apy: number;
  fee_drag_apy: number;
  market_data_mode?: "manual" | "hyperliquid";
  funding_lookback_hours?: number;
  override_live_funding?: boolean;
  market_dex?: string | null;
  wallet_exposure?: WalletExposureImport | null;
}

export interface WalletExposureImport {
  source: "wallet_auditor";
  wallet_address: string;
  asset: string | null;
  gross_long_exposure_usd: number | null;
  gross_short_exposure_usd: number | null;
  net_delta_usd: number | null;
  net_delta_pct: number | null;
  current_hedge_ratio: number | null;
  portfolio_equity_usd: number | null;
  largest_risk_asset: string | null;
  recommended_action: WalletAction;
  data_quality: "complete" | "partial";
  data_timestamp: string | null;
}

export interface HedgeAdjustment {
  current_long_notional_usd: number | null;
  current_short_notional_usd: number | null;
  target_short_notional_usd: number | null;
  short_adjustment_usd: number | null;
  target_hedge_ratio: number;
  projected_hedge_ratio: number | null;
  projected_net_delta_usd: number | null;
  projected_net_delta_pct: number | null;
  projected_hedge_drift_pct: number | null;
  adjustment_direction: "increase_short" | "reduce_short" | "no_change" | null;
  limitation: string | null;
}

export interface FundingHistorySummary {
  lookback_hours: number;
  average_funding_apy: number;
  minimum_funding_apy: number;
  maximum_funding_apy: number;
  observations: number;
}

export interface HyperliquidMarketResponse {
  source: "hyperliquid";
  asset: string;
  market: string;
  dex: string | null;
  mark_price_usd: number;
  oracle_price_usd: number;
  current_funding_rate_hourly: number;
  current_funding_apy: number;
  funding_direction: "longs_pay" | "shorts_pay" | "neutral";
  open_interest_usd: number;
  day_volume_usd: number;
  premium: number | null;
  data_timestamp: string;
  data_quality: "complete" | "partial" | "unavailable";
  historical_funding: FundingHistorySummary | null;
}

export interface AuditRequest {
  asset: Asset;
  long_notional_usd: number;
  short_notional_usd: number;
  collateral_usd: number;
  risk_tolerance: RiskTolerance;
  long_yield_apy: number;
  short_funding_apy: number;
  fee_drag_apy: number;
}

export interface StressTestRequest {
  asset: Asset;
  long_notional_usd: number;
  short_notional_usd: number;
  collateral_usd: number;
  risk_tolerance: RiskTolerance;
  long_yield_apy: number;
  short_funding_apy: number;
  fee_drag_apy: number;
  existing_unrealized_pnl_usd?: number;
  liabilities_usd?: number;
  scenario: Scenario;
}

export interface StrategyResponseBase {
  service: string;
  strategy_name: string;
  asset: Asset;
  strategy_health: StrategyHealth;
  decision_confidence: number;
  metrics: Metrics;
  recommendation: Recommendation;
  risk_notes: string[];
}

export interface BuildResponse extends StrategyResponseBase {
  recommended_structure: RecommendedStructure;
  market_data_source?: "hyperliquid";
  market_data_timestamp?: string;
  funding_rate_apy?: number;
  funding_contribution_apy?: number;
  market_data_quality?: "complete" | "partial" | "unavailable";
  market_context?: {
    mark_price_usd: number;
    oracle_price_usd: number;
    funding_direction: string;
    open_interest_usd: number;
    day_volume_usd: number;
    historical_funding: FundingHistorySummary | null;
  };
  hedge_adjustment?: HedgeAdjustment;
}

export interface AuditResponse extends StrategyResponseBase {
  actions: StrategyAction[];
}

export interface StressTestResponse extends StrategyResponseBase {
  actions: StrategyAction[];
  scenario_result: ScenarioResult;
  pre_stress_equity_usd: number;
  stressed_liabilities_usd: number;
  estimated_impairment_loss_usd: number;
  estimated_impairment_loss_pct: number;
  post_impairment_equity_usd: number;
  impairment_breakdown: ImpairmentBreakdown;
}

export interface ImpairmentBreakdown {
  asset_value_impact_usd: number;
  hedge_pnl_impact_usd: number;
  collateral_haircut_usd: number;
  exit_slippage_usd: number;
  liquidation_penalty_usd: number;
  protocol_loss_assumption_usd: number;
}

export interface ImpairmentResult {
  pre_stress_equity_usd: number;
  post_stress_equity_usd: number;
  estimated_impairment_loss_usd: number;
  estimated_impairment_loss_pct: number;
  post_impairment_equity_usd: number;
  impairment_breakdown: ImpairmentBreakdown;
}

export interface NormalizedPosition {
  protocol: WalletProtocol;
  network: WalletNetwork;
  position_type: PositionType;
  asset: string;
  quantity: number | null;
  notional_usd: number | null;
  current_value_usd: number | null;
  entry_value_usd: number | null;
  unrealized_pnl_usd: number | null;
  collateral_usd: number | null;
  debt_usd: number | null;
  funding_apy: number | null;
  liquidation_price: number | null;
  health_factor: number | null;
  data_timestamp: string | null;
  data_quality: WalletDataQuality;
  market_context?: Record<string, unknown> | null;
  side: "long" | "short" | null;
  subaccount_name: string | null;
  subaccount_address: string | null;
}

export type WalletDriverState = "positive" | "warning" | "critical" | "unavailable";

export interface WalletExecutiveSummary {
  headline: string;
  body: string;
  position_count: number;
  protocol_count: number;
  risk_level: WalletStrategyHealth;
}

export interface WalletPrimaryDriver {
  metric: string;
  label: string;
  state: WalletDriverState;
  value: number | string | null;
  unit: string | null;
  explanation: string;
}

export interface WalletPlanStep {
  priority: number;
  action: string;
  reason: string;
  target: string | null;
}

export interface WalletExposureAnalysis {
  gross_exposure_usd: number;
  gross_long_exposure_usd: number;
  gross_short_exposure_usd: number;
  net_delta_usd: number;
  net_delta_pct: number;
  portfolio_equity_usd: number | null;
  leverage_ratio: number | null;
  position_count: number;
}

export interface WalletAllocationItem {
  asset: string;
  exposure_usd: number;
  allocation_pct: number;
}

export interface WalletStressSummary {
  stress_profile: WalletStressProfile;
  estimated_impairment_loss_usd: number;
  estimated_impairment_loss_pct: number;
  post_impairment_equity_usd: number;
  dominant_risk: string;
  summary: string;
  impairment_level: "LOW" | "MEDIUM" | "HIGH";
  impairment_label: "Contained" | "Elevated" | "Critical";
}

export interface WalletRiskContributor {
  asset: string;
  protocol: WalletProtocol;
  exposure_usd: number;
  risk_contribution_pct: number;
  primary_risk: string;
}

export interface WalletRiskTimelineItem {
  metric: string;
  state: "healthy" | "warning" | "critical" | "unavailable";
  explanation: string;
}

export interface WalletAnalyzeRequest {
  wallet_address: string;
  networks: WalletNetwork[];
  protocols: WalletProtocol[];
  stress_profile: WalletStressProfile;
}

export interface WalletPortfolioSummary {
  current_position_value_usd: number;
  gross_long_exposure_usd: number;
  gross_short_exposure_usd: number;
  net_delta_usd: number;
  net_delta_pct: number;
  unrealized_pnl_usd: number | null;
  collateral_value_usd: number;
  debt_value_usd: number;
  estimated_funding_exposure_apy: number | null;
}

export interface WalletRiskMetrics {
  hedge_ratio: number | null;
  hedge_drift_pct: number | null;
  collateral_health_score: number | null;
  minimum_health_factor: number | null;
  liquidation_proximity_pct: number | null;
  safety_buffer_score: number | null;
  capital_at_risk_proxy: number | null;
  estimated_impairment_loss_usd: number | null;
  estimated_impairment_loss_pct: number | null;
  post_impairment_equity_usd: number | null;
}

export interface WalletRecommendation {
  action: WalletAction;
  summary: string;
  confidence: number;
}

export interface ProtocolError {
  protocol: WalletProtocol;
  network: WalletNetwork;
  message: string;
  error_type: string;
  retryable: boolean;
}

export interface WalletPortfolioResponse {
  service: string;
  wallet_address: string;
  assessment_status: WalletAssessmentStatus;
  supported_positions_found: number;
  unsupported_positions_found: number;
  data_timestamp: string | null;
  data_quality: WalletDataQuality;
  portfolio_summary: WalletPortfolioSummary;
  risk_metrics: WalletRiskMetrics;
  strategy_health: WalletStrategyHealth | null;
  decision_confidence: number | null;
  recommendation: WalletRecommendation | null;
  risk_notes: string[];
  corrective_actions: string[];
  positions: NormalizedPosition[];
  protocol_errors: ProtocolError[];
  warnings: string[];
  debug?: Record<string, unknown> | null;
  executive_summary: WalletExecutiveSummary | null;
  primary_drivers: WalletPrimaryDriver[];
  recommended_plan: WalletPlanStep[];
  exposure_analysis: WalletExposureAnalysis | null;
  portfolio_allocation: WalletAllocationItem[];
  stress_summary: WalletStressSummary | null;
  largest_risk_contributors: WalletRiskContributor[];
  portfolio_observations: string[];
  risk_timeline: WalletRiskTimelineItem[];
}
