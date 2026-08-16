import type { RiskCategory } from "../risk/types";

export interface CategoryDefinition {
  slug: RiskCategory;
  name: string;
  shortName: string;
  description: string;
  decisionQuestion: string;
  metrics: Array<{ key: string; label: string; unit?: string; explanation: string }>;
  thresholds: Array<{ label: string; value: string; meaning: string }>;
  protocols: string[];
}

export const CATEGORY_DEFINITIONS: Record<RiskCategory, CategoryDefinition> = {
  health_factor: {
    slug: "health_factor",
    name: "Health Factor Monitoring",
    shortName: "Health factor",
    description: "Monitor collateral coverage before a lending position approaches liquidation conditions.",
    decisionQuestion: "Can the position absorb borrow rate and collateral stress without breaching its safety policy?",
    metrics: [
      { key: "healthFactor", label: "Health factor", explanation: "Protocol health factor supplied by the agent." },
      { key: "liquidationDistancePct", label: "Liquidation distance", unit: "%", explanation: "Distance to the configured liquidation boundary." },
      { key: "collateralUtilisationPct", label: "Collateral utilisation", unit: "%", explanation: "Share of collateral currently committed to debt." },
      { key: "borrowRateIncreasePct", label: "Borrow rate stress", unit: "%", explanation: "Borrow cost increase used by the deterministic stress rule." },
    ],
    thresholds: [
      { label: "Proceed", value: "Safety Buffer ≥ 75", meaning: "Coverage and liquidation distance are inside policy." },
      { label: "Watch", value: "Safety Buffer 60–74", meaning: "Monitor utilisation and borrow cost." },
      { label: "Adjust", value: "Safety Buffer 40–59", meaning: "Reduce debt or add collateral before scaling." },
      { label: "Avoid", value: "Safety Buffer < 40", meaning: "Data or coverage is not safe enough to proceed." },
    ],
    protocols: ["Aave", "Venus", "Lista Lending"],
  },
  yield_optimisation: {
    slug: "yield_optimisation",
    name: "Yield Optimisation",
    shortName: "Yield",
    description: "Compare carry, stability, exit liquidity, and tail impairment before allocating capital to yield strategies.",
    decisionQuestion: "Is the expected carry still worth the protocol and exit risk?",
    metrics: [
      { key: "netApy", label: "Net APY", unit: "%", explanation: "Yield after the configured risk-free rate and costs." },
      { key: "thirtyDayApyStdDev", label: "30-day APY volatility", unit: "%", explanation: "Dispersion used to score yield stability." },
      { key: "exitLiquidityUsd", label: "Exit liquidity", unit: "USD", explanation: "Estimated liquidity available for an orderly exit." },
      { key: "p95ImpairmentPct", label: "P95 impairment", unit: "%", explanation: "Tail loss percentile from the deterministic stress model." },
      { key: "protocolRisk", label: "Protocol risk", explanation: "Composite penalty for exploit, oracle, admin, and audit-gap flags." },
    ],
    thresholds: [
      { label: "Proceed", value: "Safety Buffer ≥ 75", meaning: "Carry and exit conditions pass the policy." },
      { label: "Watch", value: "Safety Buffer 60–74", meaning: "Carry is usable but compression or tail risk needs monitoring." },
      { label: "Adjust", value: "Safety Buffer 40–59", meaning: "Reduce allocation or improve the exit plan." },
      { label: "Avoid", value: "Safety Buffer < 40", meaning: "Tail or protocol risk dominates expected carry." },
    ],
    protocols: ["Venus", "Aave", "PancakeSwap", "Lista"],
  },
  rebalancing: {
    slug: "rebalancing",
    name: "Rebalancing",
    shortName: "Rebalancing",
    description: "Detect hedge drift and quantify the cost of returning a long and short structure to its target range.",
    decisionQuestion: "Should the agent hold, rebalance, reduce, or exit the position now?",
    metrics: [
      { key: "hedgeDriftPct", label: "Hedge drift", unit: "%", explanation: "Distance from the target hedge ratio." },
      { key: "netDelta", label: "Net delta", explanation: "Residual directional exposure after the hedge." },
      { key: "rebalanceCostBps", label: "Rebalance cost", unit: "bps", explanation: "Estimated execution cost for the corrective action." },
      { key: "expectedSlippagePct", label: "Expected slippage", unit: "%", explanation: "Estimated price impact for the corrective trade." },
      { key: "timeToBreachHours", label: "Time to breach", unit: "hours", explanation: "Time before the configured drift policy is breached." },
    ],
    thresholds: [
      { label: "Proceed", value: "Drift ≤ 5%", meaning: "The structure is inside the preferred hedge band." },
      { label: "Watch", value: "Drift 5–8%", meaning: "Keep the position under active review." },
      { label: "Adjust", value: "Drift 8–15%", meaning: "Rebalance cost and slippage should be checked now." },
      { label: "Avoid", value: "Drift > 15%", meaning: "Directional exposure is outside the policy." },
    ],
    protocols: ["Hyperliquid", "Aster", "PancakeSwap Perps"],
  },
  grid_trading: {
    slug: "grid_trading",
    name: "Grid Trading",
    shortName: "Grid trading",
    description: "Test grid coverage, spacing, inventory skew, margin distance, and fee edge before deploying a grid agent.",
    decisionQuestion: "Can the grid absorb the observed volatility while keeping inventory and margin inside policy?",
    metrics: [
      { key: "gridRangePct", label: "Grid range", unit: "%", explanation: "Total range covered by the grid." },
      { key: "realizedVolatility24hPct", label: "24h volatility", unit: "%", explanation: "Observed volatility used to test range coverage." },
      { key: "actualSpacingPct", label: "Grid spacing", unit: "%", explanation: "Distance between grid levels." },
      { key: "inventorySkewPct", label: "Inventory skew", unit: "%", explanation: "Directional inventory imbalance." },
      { key: "liquidationDistancePct", label: "Liquidation distance", unit: "%", explanation: "Margin distance to the configured liquidation boundary." },
    ],
    thresholds: [
      { label: "Proceed", value: "Safety Buffer ≥ 75", meaning: "Range, spacing, and margin are aligned." },
      { label: "Watch", value: "Safety Buffer 60–74", meaning: "The grid works but inventory or fee edge needs attention." },
      { label: "Adjust", value: "Safety Buffer 40–59", meaning: "Resize the range, spacing, or inventory limits." },
      { label: "Avoid", value: "Safety Buffer < 40", meaning: "The grid is too exposed for the supplied conditions." },
    ],
    protocols: ["PancakeSwap", "Thena", "Wombat"],
  },
};

export const CATEGORY_ORDER: RiskCategory[] = [
  "health_factor",
  "yield_optimisation",
  "rebalancing",
  "grid_trading",
];

export function isRiskCategory(value: string): value is RiskCategory {
  return CATEGORY_ORDER.includes(value as RiskCategory);
}
