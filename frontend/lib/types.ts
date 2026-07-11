export type Asset = "SOL" | "ETH";
export type RiskTolerance = "low" | "medium" | "high";
export type TargetStyle = "neutral_yield";
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
}

export interface BuildRequest {
  asset: Asset;
  capital_usd: number;
  risk_tolerance: RiskTolerance;
  target_style: TargetStyle;
  long_yield_apy: number;
  short_funding_apy: number;
  fee_drag_apy: number;
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
  scenario: Scenario;
}

export interface StrategyResponseBase {
  service: string;
  strategy_name: string;
  asset: Asset;
  strategy_health: StrategyHealth;
  metrics: Metrics;
  recommendation: Recommendation;
  risk_notes: string[];
}

export interface BuildResponse extends StrategyResponseBase {
  recommended_structure: RecommendedStructure;
}

export interface AuditResponse extends StrategyResponseBase {
  actions: StrategyAction[];
}

export interface StressTestResponse extends StrategyResponseBase {
  actions: StrategyAction[];
  scenario_result: ScenarioResult;
}
