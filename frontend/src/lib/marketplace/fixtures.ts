import type { Address } from "viem";

import type {
  DataQualityInput,
  DecisionConfidenceInput,
  FunctionalityScoreInput,
  GridTradingInput,
  HealthFactorInput,
  RiskCategory,
  RiskEvidence,
  YieldOptimisationInput,
  RebalancingInput,
} from "../risk/types";
import {
  calculateDataQuality,
  calculateDecisionConfidence,
  calculateFunctionalityScore,
  calculateGridTradingSafetyBuffer,
  calculateHealthFactorSafetyBuffer,
  calculateRebalancingSafetyBuffer,
  calculateYieldOptimisationSafetyBuffer,
  scoreMockAgent,
} from "../risk/scoring";
import type { AgentDataMode, CategoryMetricValue, MarketplaceAgent, SourceRecord } from "./types";

const REGISTRY_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const OBSERVED_AT = "2026-08-16T08:00:00.000Z";

type CategoryInput = HealthFactorInput | YieldOptimisationInput | RebalancingInput | GridTradingInput;

function categoryBuffer(category: RiskCategory, input: CategoryInput) {
  switch (category) {
    case "health_factor":
      return calculateHealthFactorSafetyBuffer(input as HealthFactorInput);
    case "yield_optimisation":
      return calculateYieldOptimisationSafetyBuffer(input as YieldOptimisationInput);
    case "rebalancing":
      return calculateRebalancingSafetyBuffer(input as RebalancingInput);
    case "grid_trading":
      return calculateGridTradingSafetyBuffer(input as GridTradingInput);
  }
}

function metricsFor(category: RiskCategory, values: CategoryMetricValue[]): Record<RiskCategory, CategoryMetricValue[]> {
  return {
    health_factor: category === "health_factor" ? values : [],
    yield_optimisation: category === "yield_optimisation" ? values : [],
    rebalancing: category === "rebalancing" ? values : [],
    grid_trading: category === "grid_trading" ? values : [],
  };
}

function evidenceFor(category: RiskCategory, metrics: CategoryMetricValue[], source: string): RiskEvidence[] {
  return metrics.map((metric) => ({
    metric: `${category}.${metric.key}`,
    value: metric.value,
    unit: metric.unit,
    source,
    observedAt: OBSERVED_AT,
  }));
}

interface FixtureInput {
  id: string;
  erc8004AgentId: string;
  ownerAddress: Address;
  name: string;
  description: string;
  endpoint: string;
  category: RiskCategory;
  protocols: string[];
  price: string;
  categoryInput: CategoryInput;
  metrics: CategoryMetricValue[];
  dataQuality: DataQualityInput;
  decisionConfidence: DecisionConfidenceInput;
  functionality: FunctionalityScoreInput;
  tags: string[];
  sourceLabel: string;
  riskZoneLabel: string;
  dataMode?: AgentDataMode;
}

function makeFixture(input: FixtureInput): MarketplaceAgent {
  const categoryResult = categoryBuffer(input.category, input.categoryInput);
  const dataQuality = calculateDataQuality(input.dataQuality).score;
  const decisionConfidence = calculateDecisionConfidence(input.decisionConfidence).score;
  const functionality = calculateFunctionalityScore(input.functionality).score;
  const score = scoreMockAgent({
    categorySafetyBuffer: categoryResult.safetyBuffer,
    dataQuality,
    decisionConfidence,
    functionality,
  });
  const dataMode = input.dataMode ?? "verified_fixture";
  const verificationTime = "2026-08-16T08:02:00.000Z";
  const sourceRecords: SourceRecord[] = [
    {
      label: input.sourceLabel,
      source: dataMode === "live" ? input.endpoint : "DeltaZero verification fixture",
      observedAt: OBSERVED_AT,
      freshnessMinutes: 4,
      trust: dataMode === "live" ? "official" : "fixture",
    },
  ];

  return {
    id: input.id,
    erc8004AgentId: input.erc8004AgentId,
    chainId: 56,
    registryAddress: REGISTRY_ADDRESS,
    ownerAddress: input.ownerAddress,
    name: input.name,
    description: input.description,
    endpoint: input.endpoint,
    categories: [input.category],
    supportedProtocols: input.protocols,
    status: "ACTIVE",
    startingPrice: { amount: input.price, currency: "USDT", interval: "monthly" },
    risk: {
      deltaZeroScore: score.dzs,
      diversityScore: Math.min(100, 60 + input.protocols.length * 8),
      safetyBuffer: score.safetyBuffer,
      decisionConfidence: score.decisionConfidence,
      dataQuality: score.dataQuality,
      functionality: score.functionality,
      status: score.status,
      verifiedAt: verificationTime,
    },
    metadata: {
      version: "risk-engine-v1",
      capabilities: ["risk_report", "schema_check", "deterministic_replay"],
    },
    createdAt: "2026-07-24T10:00:00.000Z",
    updatedAt: verificationTime,
    dataMode,
    verification: {
      status: "passed",
      mode: dataMode,
      lastVerifiedAt: verificationTime,
      checkedAt: verificationTime,
      latencyMs: Math.round(input.functionality.latencyP95Seconds * 1000),
      schemaVersion: "risk-report.v1",
      endpoint: input.endpoint,
      checks: { health: true, schema: true, erc8004: true, categoryCoverage: true },
    },
    registryProof: {
      registryAddress: REGISTRY_ADDRESS,
      agentId: input.erc8004AgentId,
      ownerAddress: input.ownerAddress,
      chainId: 56,
      identitySource: dataMode === "live" ? "erc8004_onchain" : "erc8004_fixture",
      metadataUri: `ipfs://deltazero-demo/${input.id}`,
    },
    sources: sourceRecords,
    evidence: evidenceFor(input.category, input.metrics, input.sourceLabel),
    categoryMetrics: metricsFor(input.category, input.metrics),
    riskZoneLabel: input.riskZoneLabel,
    tags: input.tags,
  };
}

export const MARKETPLACE_AGENTS: MarketplaceAgent[] = [
  makeFixture({
    id: "aave-health-sentinel",
    erc8004AgentId: "bsc-8004-1042",
    ownerAddress: "0x2222222222222222222222222222222222222222" as Address,
    name: "Aave Health Sentinel",
    description: "A lending health monitor that turns collateral and borrow stress into a clear operator decision before liquidation risk compounds.",
    endpoint: "https://fixture.deltazero.local/aave-health-sentinel",
    category: "health_factor",
    protocols: ["Aave", "Venus"],
    price: "5",
    categoryInput: { healthFactor: 2.1, liquidationDistancePct: 18, collateralUtilisationPct: 55, borrowRateIncreasePct: 4 },
    metrics: [
      { key: "healthFactor", label: "Health factor", value: 2.1, description: "Current collateral coverage." },
      { key: "liquidationDistancePct", label: "Liquidation distance", value: 18, unit: "%", description: "Distance to policy liquidation boundary." },
      { key: "collateralUtilisationPct", label: "Collateral utilisation", value: 55, unit: "%", description: "Share of collateral committed." },
      { key: "borrowRateIncreasePct", label: "Borrow rate stress", value: 4, unit: "%", description: "Stress applied to borrow cost." },
    ],
    dataQuality: { category: true, lastSuccessfulExecution: true, supportedProtocols: true, categoryCoreMetric: true, ageMinutes: 4, sourceTrust: "verified_indexer_or_reputable_rpc", matchingReplays: 24, totalReplays: 24 },
    decisionConfidence: { inputCompleteness: 98, dataQuality: 94, deterministicReplayScore: 100, endpointReliability: 99 },
    functionality: { endpointAvailability: 100, latencyP95Seconds: 1.8, schemaValidity: 100, paymentFlowValidity: 100 },
    tags: ["lending", "liquidation", "collateral"],
    sourceLabel: "Aave public reserve data",
    riskZoneLabel: "Coverage inside policy",
  }),
  makeFixture({
    id: "venus-yield-desk",
    erc8004AgentId: "bsc-8004-1177",
    ownerAddress: "0x3333333333333333333333333333333333333333" as Address,
    name: "Venus Yield Desk",
    description: "A yield allocation agent that scores carry quality, exit liquidity, and protocol risk before it recommends a vault or market.",
    endpoint: "https://fixture.deltazero.local/venus-yield-desk",
    category: "yield_optimisation",
    protocols: ["Venus", "PancakeSwap", "Lista"],
    price: "8",
    categoryInput: { netApy: 12, riskFreeRate: 4, thirtyDayApyStdDev: 5, exitLiquidityUsd: 500000, positionValueUsd: 100000, p95ImpairmentPct: 4, exploitFlag: false, oracleRiskFlag: false, adminControlFlag: false, auditGapFlag: false },
    metrics: [
      { key: "netApy", label: "Net APY", value: 12, unit: "%", description: "Net annualised yield." },
      { key: "thirtyDayApyStdDev", label: "30-day APY volatility", value: 5, unit: "%", description: "Yield stability measure." },
      { key: "exitLiquidityUsd", label: "Exit liquidity", value: "$500k", description: "Available exit liquidity." },
      { key: "p95ImpairmentPct", label: "P95 impairment", value: 4, unit: "%", description: "Tail impairment estimate." },
      { key: "protocolRisk", label: "Protocol risk", value: "Low", description: "No configured exploit, oracle, admin, or audit-gap flags." },
    ],
    dataQuality: { category: true, lastSuccessfulExecution: true, supportedProtocols: true, categoryCoreMetric: true, ageMinutes: 18, sourceTrust: "signed_onchain_or_official", matchingReplays: 22, totalReplays: 24 },
    decisionConfidence: { inputCompleteness: 95, dataQuality: 92, deterministicReplayScore: 96, endpointReliability: 97 },
    functionality: { endpointAvailability: 99, latencyP95Seconds: 2.4, schemaValidity: 100, paymentFlowValidity: 100 },
    tags: ["yield", "carry", "vaults"],
    sourceLabel: "Venus and PancakeSwap public market data",
    riskZoneLabel: "Carry passes tail-loss policy",
  }),
  makeFixture({
    id: "bnb-rebalance-pilot",
    erc8004AgentId: "bsc-8004-1214",
    ownerAddress: "0x4444444444444444444444444444444444444444" as Address,
    name: "BNB Rebalance Pilot",
    description: "A hedge monitor that detects drift, estimates corrective cost, and returns a rebalance or hold decision for perpetual structures.",
    endpoint: "https://fixture.deltazero.local/bnb-rebalance-pilot",
    category: "rebalancing",
    protocols: ["Hyperliquid", "PancakeSwap Perps"],
    price: "4",
    categoryInput: { hedgeDriftPct: 4, netDelta: 0.05, rebalanceCostBps: 35, expectedSlippagePct: 0.4, timeToBreachHours: 24 },
    metrics: [
      { key: "hedgeDriftPct", label: "Hedge drift", value: 4, unit: "%", description: "Distance from target hedge ratio." },
      { key: "netDelta", label: "Net delta", value: 0.05, description: "Residual directional exposure." },
      { key: "rebalanceCostBps", label: "Rebalance cost", value: 35, unit: "bps", description: "Estimated corrective execution cost." },
      { key: "expectedSlippagePct", label: "Expected slippage", value: 0.4, unit: "%", description: "Expected price impact." },
      { key: "timeToBreachHours", label: "Time to breach", value: 24, unit: "hours", description: "Estimated time before drift policy breach." },
    ],
    dataQuality: { category: true, lastSuccessfulExecution: true, supportedProtocols: true, categoryCoreMetric: true, ageMinutes: 7, sourceTrust: "agent_signed_telemetry", matchingReplays: 20, totalReplays: 24 },
    decisionConfidence: { inputCompleteness: 91, dataQuality: 88, deterministicReplayScore: 96, endpointReliability: 94 },
    functionality: { endpointAvailability: 98, latencyP95Seconds: 2.9, schemaValidity: 100, paymentFlowValidity: 100 },
    tags: ["hedge drift", "perpetuals", "rebalancing"],
    sourceLabel: "Signed agent telemetry and venue metadata",
    riskZoneLabel: "Inside preferred hedge band",
  }),
  makeFixture({
    id: "pancake-grid-monitor",
    erc8004AgentId: "bsc-8004-1308",
    ownerAddress: "0x5555555555555555555555555555555555555555" as Address,
    name: "Pancake Grid Monitor",
    description: "A grid trading risk agent that tests range coverage, spacing, inventory skew, and margin distance against current volatility.",
    endpoint: "https://fixture.deltazero.local/pancake-grid-monitor",
    category: "grid_trading",
    protocols: ["PancakeSwap", "Thena", "Wombat"],
    price: "3",
    categoryInput: { gridRangePct: 18, realizedVolatility24hPct: 4, actualSpacingPct: 1.8, inventorySkewPct: 6, liquidationDistancePct: 16, feeCaptureApy: 15, adverseSelectionCostApy: 3 },
    metrics: [
      { key: "gridRangePct", label: "Grid range", value: 18, unit: "%", description: "Total range covered." },
      { key: "realizedVolatility24hPct", label: "24h volatility", value: 4, unit: "%", description: "Observed volatility input." },
      { key: "actualSpacingPct", label: "Grid spacing", value: 1.8, unit: "%", description: "Distance between levels." },
      { key: "inventorySkewPct", label: "Inventory skew", value: 6, unit: "%", description: "Directional inventory imbalance." },
      { key: "liquidationDistancePct", label: "Liquidation distance", value: 16, unit: "%", description: "Margin distance to policy boundary." },
    ],
    dataQuality: { category: true, lastSuccessfulExecution: true, supportedProtocols: true, categoryCoreMetric: true, ageMinutes: 26, sourceTrust: "verified_indexer_or_reputable_rpc", matchingReplays: 23, totalReplays: 24 },
    decisionConfidence: { inputCompleteness: 93, dataQuality: 90, deterministicReplayScore: 96, endpointReliability: 95 },
    functionality: { endpointAvailability: 99, latencyP95Seconds: 3.4, schemaValidity: 100, paymentFlowValidity: 100 },
    tags: ["grid", "inventory", "volatility"],
    sourceLabel: "PancakeSwap and Thena public pool data",
    riskZoneLabel: "Grid needs active monitoring",
  }),
];

export function getMarketplaceAgent(agentId: string): MarketplaceAgent | undefined {
  return MARKETPLACE_AGENTS.find((agent) => agent.id === agentId);
}

export function getAgentsForCategory(category: RiskCategory): MarketplaceAgent[] {
  return MARKETPLACE_AGENTS.filter((agent) => agent.categories.includes(category) && agent.verification.status === "passed");
}
