import { describe, expect, it } from "vitest";

import {
  calculateDataQuality,
  calculateDecisionConfidence,
  calculateFunctionalityScore,
  calculateDiversityScore,
  calculateGridTradingSafetyBuffer,
  calculateHealthFactorSafetyBuffer,
  calculateRebalancingSafetyBuffer,
  calculateYieldOptimisationSafetyBuffer,
  clip,
  freshnessScore,
  latencyScore,
  mapRiskStatus,
  scoreMockAgent,
  sourceTrustScore,
} from "./scoring";

describe("shared risk score helpers", () => {
  it("clips finite values and rejects non-finite values", () => {
    expect(clip(-10)).toBe(0);
    expect(clip(45)).toBe(45);
    expect(clip(150)).toBe(100);
    expect(clip(Number.NaN)).toBe(0);
    expect(clip(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("maps freshness at the documented boundaries", () => {
    expect(freshnessScore(5)).toBe(100);
    expect(freshnessScore(30)).toBe(80);
    expect(freshnessScore(120)).toBe(60);
    expect(freshnessScore(1_440)).toBe(30);
    expect(freshnessScore(1_441)).toBe(0);
  });

  it("maps source trust and latency scores", () => {
    expect(sourceTrustScore("signed_onchain_or_official")).toBe(100);
    expect(sourceTrustScore("verified_indexer_or_reputable_rpc")).toBe(85);
    expect(sourceTrustScore("agent_signed_telemetry")).toBe(60);
    expect(sourceTrustScore("self_reported_unsigned")).toBe(30);
    expect(sourceTrustScore("unknown")).toBe(0);
    expect(latencyScore(1.9)).toBe(100);
    expect(latencyScore(5)).toBe(70);
    expect(latencyScore(10)).toBe(30);
    expect(latencyScore(10.01)).toBe(0);
  });
});

describe("common scores", () => {
  const completeEvidence = {
    category: true,
    lastSuccessfulExecution: true,
    supportedProtocols: true,
    categoryCoreMetric: true,
  };

  it("returns 100 data quality for complete fresh trusted deterministic data", () => {
    const result = calculateDataQuality({
      ...completeEvidence,
      ageMinutes: 2,
      sourceTrust: "signed_onchain_or_official",
      matchingReplays: 5,
      totalReplays: 5,
    });

    expect(result.score).toBe(100);
    expect(result.components).toEqual({
      completeness: 100,
      freshness: 100,
      sourceTrust: 100,
      replayConsistency: 100,
    });
  });

  it("combines decision confidence and functionality using the specified weights", () => {
    expect(
      calculateDecisionConfidence({
        inputCompleteness: 90,
        dataQuality: 80,
        deterministicReplayScore: 70,
        endpointReliability: 60,
      }).score,
    ).toBe(76.5);

    expect(
      calculateFunctionalityScore({
        endpointAvailability: 100,
        latencyP95Seconds: 5,
        schemaValidity: 100,
        paymentFlowValidity: 80,
      }).score,
    ).toBe(88.5);
  });

  it("calculates agent diversity using the marketplace coverage weights", () => {
    expect(
      calculateDiversityScore({
        categoryCoverage: 100,
        protocolCoverage: 80,
        riskProfileCoverage: 60,
        liveAgentCoverage: 40,
      }).score,
    ).toBe(78);
  });

  it("maps status with critical gates", () => {
    expect(
      mapRiskStatus({ dzs: 85, safetyBuffer: 80, decisionConfidence: 80, dataQuality: 80 }),
    ).toBe("PROCEED");
    expect(
      mapRiskStatus({ dzs: 85, safetyBuffer: 80, decisionConfidence: 70, dataQuality: 80 }),
    ).toBe("WATCH");
    expect(
      mapRiskStatus({ dzs: 55, safetyBuffer: 55, decisionConfidence: 55, dataQuality: 55 }),
    ).toBe("ADJUST");
    expect(
      mapRiskStatus({ dzs: 39, safetyBuffer: 55, decisionConfidence: 55, dataQuality: 55 }),
    ).toBe("AVOID");
    expect(
      mapRiskStatus({ dzs: 90, safetyBuffer: 80, decisionConfidence: 80, dataQuality: 80, criticalDataMissing: true }),
    ).toBe("AVOID");
  });
});

describe("category safety buffers", () => {
  it("calculates health factor safety buffer", () => {
    const result = calculateHealthFactorSafetyBuffer({
      healthFactor: 2,
      liquidationDistancePct: 25,
      collateralUtilisationPct: 20,
      borrowRateIncreasePct: 0,
    });

    expect(result.safetyBuffer).toBe(100);
    expect(result.components).toEqual({
      healthFactor: 100,
      liquidationDistance: 100,
      collateral: expect.closeTo(100, 6),
      borrowStress: 100,
    });
  });

  it("calculates yield optimisation safety buffer", () => {
    const result = calculateYieldOptimisationSafetyBuffer({
      netApy: 14,
      riskFreeRate: 4,
      thirtyDayApyStdDev: 0,
      exitLiquidityUsd: 5_000,
      positionValueUsd: 100_000,
      p95ImpairmentPct: 0,
      exploitFlag: false,
      oracleRiskFlag: false,
      adminControlFlag: false,
      auditGapFlag: false,
    });

    expect(result.safetyBuffer).toBeCloseTo(80.2, 6);
    expect(result.components.protocolRisk).toBe(100);
  });

  it("calculates rebalancing safety buffer", () => {
    const result = calculateRebalancingSafetyBuffer({
      hedgeDriftPct: 0,
      netDelta: 0,
      rebalanceCostBps: 0,
      expectedSlippagePct: 0,
      timeToBreachHours: 18,
    });

    expect(result.safetyBuffer).toBe(100);
    expect(Object.values(result.components)).toEqual([100, 100, 100, 100, 100]);
  });

  it("calculates grid safety buffer and redistributes missing fee-edge weight", () => {
    const result = calculateGridTradingSafetyBuffer({
      gridRangePct: 10,
      realizedVolatility24hPct: 2,
      actualSpacingPct: 0.9,
      inventorySkewPct: 0,
      liquidationDistancePct: 20,
      feeCaptureApy: 10,
      adverseSelectionCostApy: 2,
    });

    expect(result.feeEdgeAvailable).toBe(true);
    expect(result.safetyBuffer).toBeGreaterThan(0);
    expect(result.safetyBuffer).toBeLessThanOrEqual(100);

    const withoutFee = calculateGridTradingSafetyBuffer({
      gridRangePct: 10,
      realizedVolatility24hPct: 2,
      actualSpacingPct: 0.9,
      inventorySkewPct: 0,
      liquidationDistancePct: 20,
    });

    expect(withoutFee.feeEdgeAvailable).toBe(false);
    expect(withoutFee.dataQualityPenalty).toBeGreaterThan(0);
  });
});

describe("mock agent scoring", () => {
  it("scores an agent with the full deterministic score envelope", () => {
    const result = scoreMockAgent({
      categorySafetyBuffer: 80,
      dataQuality: 80,
      decisionConfidence: 80,
      functionality: 90,
    });

    expect(result.dzs).toBe(81);
    expect(result.status).toBe("PROCEED");
  });
});
