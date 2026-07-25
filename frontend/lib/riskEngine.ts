export type Asset = "SOL" | "ETH";
export type RiskTolerance = "conservative" | "medium" | "aggressive";
export type TargetStyle = "neutral_yield" | "conservative_income" | "aggressive_carry" | "capital_preservation";
export type RiskZone = "Optimal" | "Healthy" | "Watch" | "Defensive" | "Critical";
export type Action = "OPEN" | "WAIT" | "HOLD" | "REBALANCE" | "REDUCE" | "CLOSE";

export interface StrategyInputs {
  asset: Asset;
  capital_usd: number;
  long_yield_apy: number;
  short_funding_apy: number;
  fee_drag_apy: number;
  risk_tolerance: RiskTolerance;
  target_style: TargetStyle;
}

export interface RiskReport {
  net_carry_apy: number;
  safety_buffer: number;
  hedge_drift_pct: number;
  risk_zone: RiskZone;
  decision_confidence: number;
  action: Action;
  zone_color: string;
}

const ZONE_THRESHOLDS: Record<RiskTolerance, Record<RiskZone, number>> = {
  conservative: { Optimal: 80, Healthy: 60, Watch: 40, Defensive: 20, Critical: 0 },
  medium: { Optimal: 70, Healthy: 50, Watch: 30, Defensive: 15, Critical: 0 },
  aggressive: { Optimal: 60, Healthy: 40, Watch: 20, Defensive: 10, Critical: 0 },
};

const RISK_TOLERANCE_MULTIPLIERS: Record<RiskTolerance, number> = {
  conservative: 1.5,
  medium: 1.0,
  aggressive: 0.6,
};

const ZONE_COLORS: Record<RiskZone, string> = {
  Optimal: "#10b981",
  Healthy: "#14b8a6",
  Watch: "#f59e0b",
  Defensive: "#f97316",
  Critical: "#f43f5e",
};

export const ZONE_COLORS_DARK: Record<RiskZone, string> = {
  Optimal: "#34d399",
  Healthy: "#2dd4bf",
  Watch: "#fbbf24",
  Defensive: "#fb923c",
  Critical: "#fb7185",
};

function getZone(safety_buffer: number, risk_tolerance: RiskTolerance): RiskZone {
  const thresholds = ZONE_THRESHOLDS[risk_tolerance];
  if (safety_buffer >= thresholds.Optimal) return "Optimal";
  if (safety_buffer >= thresholds.Healthy) return "Healthy";
  if (safety_buffer >= thresholds.Watch) return "Watch";
  if (safety_buffer >= thresholds.Defensive) return "Defensive";
  return "Critical";
}

function getAction(safety_buffer: number, hedge_drift: number, risk_tolerance: RiskTolerance): Action {
  const thresholds = ZONE_THRESHOLDS[risk_tolerance];

  if (safety_buffer >= thresholds.Optimal && hedge_drift < 3) return "OPEN";
  if (safety_buffer >= thresholds.Optimal) return "HOLD";
  if (safety_buffer >= thresholds.Healthy) {
    if (hedge_drift < 5) return "HOLD";
    return "WAIT";
  }
  if (safety_buffer >= thresholds.Watch) return "REBALANCE";
  if (safety_buffer >= thresholds.Defensive) return "REDUCE";
  return "CLOSE";
}

function getDecisionConfidence(safety_buffer: number, hedge_drift: number, risk_tolerance: RiskTolerance): number {
  const thresholds = ZONE_THRESHOLDS[risk_tolerance];
  const zones: RiskZone[] = ["Optimal", "Healthy", "Watch", "Defensive", "Critical"];
  let current_zone = getZone(safety_buffer, risk_tolerance);
  let idx = zones.indexOf(current_zone);

  let lower = idx < zones.length - 1 ? thresholds[zones[idx + 1]] : 0;
  let upper = thresholds[current_zone] ?? 100;
  let midpoint = (lower + upper) / 2;

  let raw = 100 - Math.abs(safety_buffer - midpoint) - hedge_drift * 5;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function calculateReport(inputs: StrategyInputs): RiskReport {
  const { capital_usd, long_yield_apy, short_funding_apy, fee_drag_apy, risk_tolerance } = inputs;

  // Net Carry APY
  let net_carry_apy = long_yield_apy - short_funding_apy - fee_drag_apy;

  // Capital at Risk: simplified model
  let capital_at_risk = capital_usd * (1 - Math.max(0, net_carry_apy / 100) * 0.1);
  let collateral_reserve = capital_usd * 0.4;

  // Safety Buffer
  let multiplier = RISK_TOLERANCE_MULTIPLIERS[risk_tolerance];
  let safety_buffer = (collateral_reserve / Math.max(capital_at_risk, 1)) * multiplier * 100;
  safety_buffer = Math.max(0, Math.min(100, Math.round(safety_buffer * 10) / 10));

  // Hedge Drift (deterministic from inputs, not random)
  let base_drift = 3.2 + (Math.abs(short_funding_apy) * 0.3);
  if (Math.abs(short_funding_apy) > 10) base_drift += 2;
  if (risk_tolerance === "aggressive") base_drift += 1.5;
  let hedge_drift = Math.min(15, Math.round(base_drift * 10) / 10);

  let zone = getZone(safety_buffer, risk_tolerance);
  let action = getAction(safety_buffer, hedge_drift, risk_tolerance);
  let confidence = getDecisionConfidence(safety_buffer, hedge_drift, risk_tolerance);

  return {
    net_carry_apy: Math.round(net_carry_apy * 10) / 10,
    safety_buffer,
    hedge_drift_pct: hedge_drift,
    risk_zone: zone,
    decision_confidence: confidence,
    action,
    zone_color: ZONE_COLORS[zone],
  };
}

export function calculateStressTest(
  base: RiskReport,
  scenario: { funding_apy?: number; long_yield_mult?: number; buffer_reduction?: number },
  inputs: StrategyInputs
): RiskReport {
  let stressed = { ...inputs };

  if (scenario.funding_apy !== undefined) {
    stressed.short_funding_apy = scenario.funding_apy;
  }
  if (scenario.long_yield_mult !== undefined) {
    stressed.long_yield_apy = inputs.long_yield_apy * scenario.long_yield_mult;
  }

  let report = calculateReport(stressed);

  if (scenario.buffer_reduction !== undefined) {
    report.safety_buffer = Math.max(0, report.safety_buffer - scenario.buffer_reduction);
    // Re-evaluate zone/action/confidence with reduced buffer
    report.risk_zone = getZone(report.safety_buffer, inputs.risk_tolerance);
    report.action = getAction(report.safety_buffer, report.hedge_drift_pct, inputs.risk_tolerance);
    report.decision_confidence = getDecisionConfidence(report.safety_buffer, report.hedge_drift_pct, inputs.risk_tolerance);
  }

  report.zone_color = ZONE_COLORS[report.risk_zone];
  return report;
}

export function estimateCriticalProbability(safety_buffer: number, risk_tolerance: RiskTolerance): number {
  // Estimate probability of entering Critical zone within 7 days
  // Derived from current buffer distance from critical threshold
  const critical_threshold = ZONE_THRESHOLDS[risk_tolerance].Critical;
  const distance = safety_buffer - critical_threshold;
  if (distance <= 0) return 95;
  return Math.max(0, Math.min(99, Math.round((100 - distance * 3) * 10) / 10));
}
