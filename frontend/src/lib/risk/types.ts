export type RiskStatus = "PROCEED" | "WATCH" | "ADJUST" | "AVOID";

export type RiskCategory =
  | "health_factor"
  | "yield_optimisation"
  | "rebalancing"
  | "grid_trading";

export type SourceTrustTier =
  | "signed_onchain_or_official"
  | "verified_indexer_or_reputable_rpc"
  | "agent_signed_telemetry"
  | "self_reported_unsigned"
  | "unknown";

export interface ScoreResult<Components extends object = Record<string, number>> {
  score: number;
  components: Components;
}

export interface SafetyBufferResult<Components extends object = Record<string, number>> {
  safetyBuffer: number;
  components: Components;
  dataQualityPenalty?: number;
  feeEdgeAvailable?: boolean;
  assumptions?: string[];
}

export interface DataQualityInput {
  category: boolean;
  lastSuccessfulExecution: boolean;
  supportedProtocols: boolean;
  categoryCoreMetric: boolean;
  ageMinutes: number;
  sourceTrust: SourceTrustTier;
  matchingReplays: number;
  totalReplays: number;
}

export interface DataQualityComponents {
  completeness: number;
  freshness: number;
  sourceTrust: number;
  replayConsistency: number;
}

export interface DecisionConfidenceInput {
  inputCompleteness: number;
  dataQuality: number;
  deterministicReplayScore: number;
  endpointReliability: number;
}

export interface FunctionalityScoreInput {
  endpointAvailability: number;
  latencyP95Seconds: number;
  schemaValidity: number;
  paymentFlowValidity: number;
}

export interface DeltaZeroScoreInput {
  categorySafetyBuffer: number;
  decisionConfidence: number;
  dataQuality: number;
  functionality: number;
}

export interface DiversityScoreInput {
  categoryCoverage: number;
  protocolCoverage: number;
  riskProfileCoverage: number;
  liveAgentCoverage: number;
}

export interface DiversityScoreComponents {
  categoryCoverage: number;
  protocolCoverage: number;
  riskProfileCoverage: number;
  liveAgentCoverage: number;
}

export interface RiskStatusInput {
  dzs: number;
  safetyBuffer: number;
  decisionConfidence: number;
  dataQuality: number;
  criticalDataMissing?: boolean;
  staleData?: boolean;
  invalidData?: boolean;
}

export interface HealthFactorInput {
  healthFactor: number;
  liquidationDistancePct: number;
  collateralUtilisationPct: number;
  borrowRateIncreasePct: number;
}

export interface HealthFactorComponents {
  healthFactor: number;
  liquidationDistance: number;
  collateral: number;
  borrowStress: number;
}

export interface YieldOptimisationInput {
  netApy: number;
  riskFreeRate?: number;
  thirtyDayApyStdDev: number;
  exitLiquidityUsd: number;
  positionValueUsd: number;
  p95ImpairmentPct: number;
  exploitFlag: boolean;
  oracleRiskFlag: boolean;
  adminControlFlag: boolean;
  auditGapFlag: boolean;
}

export interface YieldOptimisationComponents {
  netCarry: number;
  stability: number;
  exitLiquidity: number;
  protocolRisk: number;
  tailLoss: number;
}

export interface RebalancingInput {
  hedgeDriftPct: number;
  netDelta: number;
  rebalanceCostBps: number;
  expectedSlippagePct: number;
  timeToBreachHours: number;
}

export interface RebalancingComponents {
  drift: number;
  delta: number;
  cost: number;
  slippage: number;
  trigger: number;
}

export interface GridTradingInput {
  gridRangePct: number;
  realizedVolatility24hPct: number;
  actualSpacingPct: number;
  inventorySkewPct?: number;
  liquidationDistancePct: number;
  feeCaptureApy?: number;
  adverseSelectionCostApy?: number;
}

export interface GridTradingComponents {
  coverage: number;
  spacing: number;
  inventory: number;
  margin: number;
  feeEdge: number;
}

export interface MockAgentScoreInput {
  categorySafetyBuffer: number;
  dataQuality: number;
  decisionConfidence: number;
  functionality: number;
}

export interface AgentScore {
  dzs: number;
  status: RiskStatus;
  safetyBuffer: number;
  decisionConfidence: number;
  dataQuality: number;
  functionality: number;
}

export interface RiskEvidence {
  metric: string;
  value: number | string | boolean;
  unit?: string;
  source: string;
  observedAt: string;
  formula?: string;
}

export interface SafetyBuffer {
  category: RiskCategory;
  score: number;
  status: RiskStatus;
  components: Record<string, number>;
  dataQualityPenalty?: number;
  generatedAt: string;
}

export interface RiskReportScores {
  deltaZeroScore: number;
  safetyBuffer: number;
  decisionConfidence: number;
  dataQuality: number;
  functionality: number;
  freshnessMinutes: number;
}

export interface RiskReport {
  id: string;
  agentId: string;
  category: RiskCategory;
  status: RiskStatus;
  scores: RiskReportScores;
  safetyBuffer: SafetyBuffer;
  evidence: RiskEvidence[];
  formulaVersion: string;
  sourceTimestamp: string;
  proofHash?: string;
  createdAt: string;
}
