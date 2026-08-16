import type {
  AgentScore,
  DataQualityComponents,
  DataQualityInput,
  DecisionConfidenceInput,
  DeltaZeroScoreInput,
  DiversityScoreComponents,
  DiversityScoreInput,
  FunctionalityScoreInput,
  GridTradingComponents,
  GridTradingInput,
  HealthFactorComponents,
  HealthFactorInput,
  MockAgentScoreInput,
  RebalancingComponents,
  RebalancingInput,
  RiskStatus,
  RiskStatusInput,
  SafetyBufferResult,
  ScoreResult,
  SourceTrustTier,
  YieldOptimisationComponents,
  YieldOptimisationInput,
} from "./types";

/** Keep every public score in the documented 0..100 range. */
export function clip(value: number, minimum = 0, maximum = 100): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function freshnessScore(ageMinutes: number): number {
  if (!Number.isFinite(ageMinutes) || ageMinutes < 0) return 0;
  if (ageMinutes <= 5) return 100;
  if (ageMinutes <= 30) return 80;
  if (ageMinutes <= 120) return 60;
  if (ageMinutes <= 1_440) return 30;
  return 0;
}

export function sourceTrustScore(tier: SourceTrustTier): number {
  switch (tier) {
    case "signed_onchain_or_official":
      return 100;
    case "verified_indexer_or_reputable_rpc":
      return 85;
    case "agent_signed_telemetry":
      return 60;
    case "self_reported_unsigned":
      return 30;
    case "unknown":
    default:
      return 0;
  }
}

export function replayConsistencyScore(matchingReplays: number, totalReplays: number): number {
  if (!Number.isFinite(matchingReplays) || !Number.isFinite(totalReplays) || totalReplays <= 0) {
    return 0;
  }

  return clip((matchingReplays / totalReplays) * 100);
}

export function calculateDataQuality(
  input: DataQualityInput,
): ScoreResult<DataQualityComponents> {
  const requiredFields = [
    input.category,
    input.lastSuccessfulExecution,
    input.supportedProtocols,
    input.categoryCoreMetric,
  ];
  const completeness = (requiredFields.filter(Boolean).length / requiredFields.length) * 100;
  const freshness = freshnessScore(input.ageMinutes);
  const sourceTrust = sourceTrustScore(input.sourceTrust);
  const replayConsistency = replayConsistencyScore(input.matchingReplays, input.totalReplays);

  return {
    score: clip(
      0.3 * completeness +
        0.3 * freshness +
        0.25 * sourceTrust +
        0.15 * replayConsistency,
    ),
    components: { completeness, freshness, sourceTrust, replayConsistency },
  };
}

export function calculateDecisionConfidence(
  input: DecisionConfidenceInput,
): ScoreResult<{
  inputCompleteness: number;
  dataQuality: number;
  deterministicReplay: number;
  endpointReliability: number;
}> {
  const components = {
    inputCompleteness: clip(input.inputCompleteness),
    dataQuality: clip(input.dataQuality),
    deterministicReplay: clip(input.deterministicReplayScore),
    endpointReliability: clip(input.endpointReliability),
  };

  return {
    score: clip(
      0.3 * components.inputCompleteness +
        0.25 * components.dataQuality +
        0.25 * components.deterministicReplay +
        0.2 * components.endpointReliability,
    ),
    components,
  };
}

export function latencyScore(latencyP95Seconds: number): number {
  if (!Number.isFinite(latencyP95Seconds) || latencyP95Seconds < 0) return 0;
  if (latencyP95Seconds < 2) return 100;
  if (latencyP95Seconds <= 5) return 70;
  if (latencyP95Seconds <= 10) return 30;
  return 0;
}

export function calculateFunctionalityScore(
  input: FunctionalityScoreInput,
): ScoreResult<{
  endpointAvailability: number;
  latency: number;
  schemaValidity: number;
  paymentFlowValidity: number;
}> {
  const components = {
    endpointAvailability: clip(input.endpointAvailability),
    latency: latencyScore(input.latencyP95Seconds),
    schemaValidity: clip(input.schemaValidity),
    paymentFlowValidity: clip(input.paymentFlowValidity),
  };

  return {
    score: clip(
      0.35 * components.endpointAvailability +
        0.25 * components.latency +
        0.2 * components.schemaValidity +
        0.2 * components.paymentFlowValidity,
    ),
    components,
  };
}

export function calculateDeltaZeroScore(
  input: DeltaZeroScoreInput,
): ScoreResult<{
  categorySafetyBuffer: number;
  decisionConfidence: number;
  dataQuality: number;
  functionality: number;
}> {
  const components = {
    categorySafetyBuffer: clip(input.categorySafetyBuffer),
    decisionConfidence: clip(input.decisionConfidence),
    dataQuality: clip(input.dataQuality),
    functionality: clip(input.functionality),
  };

  return {
    score: clip(
      0.5 * components.categorySafetyBuffer +
        0.25 * components.decisionConfidence +
        0.15 * components.dataQuality +
        0.1 * components.functionality,
    ),
    components,
  };
}

export function calculateDiversityScore(
  input: DiversityScoreInput,
): ScoreResult<DiversityScoreComponents> {
  const components = {
    categoryCoverage: clip(input.categoryCoverage),
    protocolCoverage: clip(input.protocolCoverage),
    riskProfileCoverage: clip(input.riskProfileCoverage),
    liveAgentCoverage: clip(input.liveAgentCoverage),
  };

  return {
    score: clip(
      0.4 * components.categoryCoverage +
        0.25 * components.protocolCoverage +
        0.2 * components.riskProfileCoverage +
        0.15 * components.liveAgentCoverage,
    ),
    components,
  };
}

export function mapRiskStatus(input: RiskStatusInput): RiskStatus {
  const values = [input.dzs, input.safetyBuffer, input.decisionConfidence, input.dataQuality];
  if (
    input.criticalDataMissing ||
    input.staleData ||
    input.invalidData ||
    values.some((value) => !Number.isFinite(value))
  ) {
    return "AVOID";
  }

  const dzs = clip(input.dzs);
  const safetyBuffer = clip(input.safetyBuffer);
  const decisionConfidence = clip(input.decisionConfidence);
  const dataQuality = clip(input.dataQuality);

  if (dzs < 40) return "AVOID";
  if (dzs >= 80 && safetyBuffer >= 75 && decisionConfidence >= 75 && dataQuality >= 70) {
    return "PROCEED";
  }
  if (dzs >= 60) return "WATCH";
  return "ADJUST";
}

export function calculateHealthFactorSafetyBuffer(
  input: HealthFactorInput,
): SafetyBufferResult<HealthFactorComponents> {
  const components = {
    healthFactor: clip((input.healthFactor - 1) * 100),
    liquidationDistance: clip((input.liquidationDistancePct / 25) * 100),
    collateral: clip(((85 - input.collateralUtilisationPct) / 65) * 100),
    borrowStress: clip(100 - (input.borrowRateIncreasePct / 20) * 100),
  };

  return {
    safetyBuffer: clip(
      0.35 * components.healthFactor +
        0.3 * components.liquidationDistance +
        0.2 * components.collateral +
        0.15 * components.borrowStress,
    ),
    components,
  };
}

export function calculateYieldOptimisationSafetyBuffer(
  input: YieldOptimisationInput,
): SafetyBufferResult<YieldOptimisationComponents> {
  const riskFreeRate = input.riskFreeRate ?? 4;
  const positionValue = input.positionValueUsd;
  const exitLiquidityRatio = positionValue > 0 ? input.exitLiquidityUsd / positionValue : 0;
  const components = {
    netCarry: clip(((input.netApy - riskFreeRate) / 10) * 100),
    stability: clip(100 - (input.thirtyDayApyStdDev / 15) * 100),
    exitLiquidity: clip((exitLiquidityRatio / 5) * 100),
    protocolRisk: clip(
      100 -
        50 * Number(input.exploitFlag) -
        25 * Number(input.oracleRiskFlag) -
        15 * Number(input.adminControlFlag) -
        10 * Number(input.auditGapFlag),
    ),
    tailLoss: clip(100 - (input.p95ImpairmentPct / 20) * 100),
  };

  return {
    safetyBuffer: clip(
      0.25 * components.netCarry +
        0.2 * components.stability +
        0.2 * components.exitLiquidity +
        0.2 * components.protocolRisk +
        0.15 * components.tailLoss,
    ),
    components,
    assumptions: ["Risk-free rate defaults to 4% when omitted."],
  };
}

export function calculateRebalancingSafetyBuffer(
  input: RebalancingInput,
): SafetyBufferResult<RebalancingComponents> {
  const components = {
    drift: clip(100 - (Math.abs(input.hedgeDriftPct) / 10) * 100),
    delta: clip(100 - (Math.abs(input.netDelta) / 0.2) * 100),
    cost: clip(100 - (input.rebalanceCostBps / 80) * 100),
    slippage: clip(100 - (input.expectedSlippagePct / 1.5) * 100),
    trigger: clip((input.timeToBreachHours / 18) * 100),
  };

  return {
    safetyBuffer: clip(
      0.3 * components.drift +
        0.25 * components.delta +
        0.15 * components.cost +
        0.15 * components.slippage +
        0.15 * components.trigger,
    ),
    components,
  };
}

export function calculateGridTradingSafetyBuffer(
  input: GridTradingInput,
): SafetyBufferResult<GridTradingComponents> {
  const volatility = input.realizedVolatility24hPct;
  const coverage =
    volatility > 0
      ? clip(((input.gridRangePct / (2 * volatility) - 0.8) / 2.5) * 100)
      : 0;
  const targetSpacing = Math.max(0.25, 0.45 * Math.max(volatility, 0));
  const spacing =
    targetSpacing > 0
      ? clip(100 - (Math.abs(input.actualSpacingPct - targetSpacing) / targetSpacing) * 100)
      : 0;
  const inventoryAvailable = Number.isFinite(input.inventorySkewPct);
  const feeEdgeAvailable =
    Number.isFinite(input.feeCaptureApy) && Number.isFinite(input.adverseSelectionCostApy);
  const components = {
    coverage,
    spacing,
    inventory: inventoryAvailable
      ? clip(100 - (Math.abs(input.inventorySkewPct ?? 0) / 40) * 100)
      : 0,
    margin: clip((input.liquidationDistancePct / 20) * 100),
    feeEdge: feeEdgeAvailable
      ? clip(((input.feeCaptureApy! - input.adverseSelectionCostApy! + 3) / 20) * 100)
      : 0,
  };

  const weights = {
    coverage: 0.3,
    spacing: 0.25,
    inventory: inventoryAvailable ? 0.2 : 0,
    margin: 0.15,
    feeEdge: feeEdgeAvailable ? 0.1 : 0,
  };
  const missingWeight = 1 - Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const safetyBuffer = clip(
    weights.coverage * components.coverage +
      weights.spacing * components.spacing +
      weights.inventory * components.inventory +
      weights.margin * components.margin +
      weights.feeEdge * components.feeEdge,
  );

  return {
    safetyBuffer,
    components,
    dataQualityPenalty: clip(missingWeight * 100),
    feeEdgeAvailable,
    assumptions: [
      `Target grid spacing is max(0.25%, 0.45 × realized 24h volatility).`,
      ...(inventoryAvailable ? [] : ["Inventory skew was not supplied; its weight is withheld."]),
      ...(feeEdgeAvailable ? [] : ["Fee edge was not supplied; its weight is withheld."]),
    ],
  };
}

export function scoreMockAgent(input: MockAgentScoreInput): AgentScore {
  const dzs = calculateDeltaZeroScore(input).score;
  return {
    dzs,
    status: mapRiskStatus({
      dzs,
      safetyBuffer: input.categorySafetyBuffer,
      decisionConfidence: input.decisionConfidence,
      dataQuality: input.dataQuality,
    }),
    safetyBuffer: clip(input.categorySafetyBuffer),
    decisionConfidence: clip(input.decisionConfidence),
    dataQuality: clip(input.dataQuality),
    functionality: clip(input.functionality),
  };
}

/** Short aliases mirror the names used in the risk-score specification. */
export const calculateDQ = calculateDataQuality;
export const calculateDC = calculateDecisionConfidence;
export const calculateFS = calculateFunctionalityScore;
export const calculateDZS = calculateDeltaZeroScore;
