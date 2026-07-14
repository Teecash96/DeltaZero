export type RiskZoneLabel = "Optimal" | "Healthy" | "Watch" | "Defensive" | "Critical";

export interface RiskZoneInput {
  recommendation?: string | null;
  risk_level?: string | null;
  safety_buffer_score?: number | null;
  hedge_drift_pct?: number | null;
  monte_carlo_score?: number | null;
  probability_safety_buffer_breach_pct?: number | null;
  probability_hedge_drift_breach_pct?: number | null;
  expected_impairment_loss_pct?: number | null;
  p95_impairment_loss_pct?: number | null;
  capital_impairment_probability_pct?: number | null;
}

export interface RiskZoneResult {
  zone: RiskZoneLabel;
  severity: 1 | 2 | 3 | 4 | 5;
  explanation: string;
  action: string;
  metricInterpretation: string;
  keyDrivers: string[];
  isFallback: boolean;
}

const ZONE_COPY: Record<RiskZoneLabel, Pick<RiskZoneResult, "explanation" | "action" | "metricInterpretation">> = {
  Optimal: {
    explanation: "Strategy conditions are inside DeltaZero's preferred safety range.",
    action: "Maintain structure and continue monitoring funding, drift, and collateral quality.",
    metricInterpretation: "Core resilience, hedge alignment, and available impairment metrics are inside preferred limits.",
  },
  Healthy: {
    explanation: "Risk profile is acceptable, but not perfect.",
    action: "Proceed carefully and monitor drift, carry compression, and stress sensitivity.",
    metricInterpretation: "Available metrics indicate acceptable risk with room for continued monitoring.",
  },
  Watch: {
    explanation: "Risk is building across one or more core metrics.",
    action: "Review hedge size, exposure, funding assumptions, and Safety Buffer before adding capital.",
    metricInterpretation: "At least one available metric is approaching or crossing a review threshold.",
  },
  Defensive: {
    explanation: "Risk is elevated and the position may need adjustment before deployment.",
    action: "Reduce exposure, improve hedge coverage, or increase collateral buffer.",
    metricInterpretation: "One or more available metrics indicate elevated exposure or weakened resilience.",
  },
  Critical: {
    explanation: "Risk exceeds DeltaZero's preferred safety limits.",
    action: "Avoid deployment, reduce exposure, or unwind the weakest leg.",
    metricInterpretation: "At least one available metric exceeds a critical safety boundary.",
  },
};

const SEVERITY: Record<RiskZoneLabel, RiskZoneResult["severity"]> = {
  Optimal: 1,
  Healthy: 2,
  Watch: 3,
  Defensive: 4,
  Critical: 5,
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizedRecommendation(value: string | null | undefined) {
  const recommendation = value?.trim().toLowerCase().replaceAll("_", " ");
  if (["proceed", "open"].includes(recommendation ?? "")) return "proceed";
  if (recommendation === "hold") return "hold";
  if (["adjust", "wait", "rebalance"].includes(recommendation ?? "")) return "adjust";
  if (recommendation === "reduce") return "reduce";
  if (["avoid", "close"].includes(recommendation ?? "")) return "avoid";
  return undefined;
}

function normalizedRiskLevel(value: string | null | undefined) {
  const level = value?.trim().toLowerCase();
  if (level === "warning") return "medium";
  if (level === "fragile") return "high";
  return level;
}

function driversFor(input: RiskZoneInput, fallback: boolean) {
  const drivers: string[] = [];
  const recommendation = normalizedRecommendation(input.recommendation);
  const riskLevel = normalizedRiskLevel(input.risk_level);

  if (finite(input.safety_buffer_score) && input.safety_buffer_score < 65) drivers.push("Safety Buffer below threshold");
  if (finite(input.hedge_drift_pct) && input.hedge_drift_pct > 8) drivers.push("Hedge drift elevated");
  if (finite(input.p95_impairment_loss_pct) && input.p95_impairment_loss_pct > 6) drivers.push("P95 impairment elevated");
  if (finite(input.capital_impairment_probability_pct) && input.capital_impairment_probability_pct > 30) drivers.push("Capital impairment probability elevated");
  if (finite(input.probability_safety_buffer_breach_pct) && input.probability_safety_buffer_breach_pct > 25) drivers.push("Safety Buffer breach probability elevated");
  if (finite(input.probability_hedge_drift_breach_pct) && input.probability_hedge_drift_breach_pct > 20) drivers.push("Hedge drift breach probability elevated");
  if (riskLevel === "critical" || riskLevel === "high" || riskLevel === "medium") drivers.push(`${riskLevel[0].toUpperCase()}${riskLevel.slice(1)} backend risk level`);
  if (recommendation === "avoid" || recommendation === "reduce" || recommendation === "adjust") drivers.push(`${recommendation[0].toUpperCase()}${recommendation.slice(1)} recommendation detected`);
  if (fallback) drivers.push("Insufficient data for full zone confidence");

  return [...new Set(drivers)];
}

export function getRiskZone(input: RiskZoneInput): RiskZoneResult {
  const recommendation = normalizedRecommendation(input.recommendation);
  const riskLevel = normalizedRiskLevel(input.risk_level);
  const safety = input.safety_buffer_score;
  const drift = input.hedge_drift_pct;
  const p95 = input.p95_impairment_loss_pct;

  const critical = riskLevel === "critical"
    || recommendation === "avoid"
    || (finite(safety) && safety < 35)
    || (finite(drift) && drift > 25)
    || (finite(p95) && p95 > 20)
    || (finite(input.capital_impairment_probability_pct) && input.capital_impairment_probability_pct > 30);

  const defensive = riskLevel === "high"
    || (finite(safety) && safety >= 35 && safety < 50)
    || (finite(drift) && drift > 15 && drift <= 25)
    || (finite(p95) && p95 > 12 && p95 <= 20)
    || (finite(input.probability_safety_buffer_breach_pct) && input.probability_safety_buffer_breach_pct > 25)
    || recommendation === "reduce";

  const watch = riskLevel === "medium"
    || (finite(safety) && safety >= 50 && safety < 65)
    || (finite(drift) && drift > 8 && drift <= 15)
    || (finite(p95) && p95 > 6 && p95 <= 12)
    || (finite(input.probability_hedge_drift_breach_pct) && input.probability_hedge_drift_breach_pct > 20)
    || recommendation === "adjust";

  const optimal = finite(safety)
    && safety >= 80
    && finite(drift)
    && drift <= 5
    && (!finite(p95) || p95 <= 4)
    && recommendation === "proceed";

  const healthy = (finite(safety) && safety >= 65 && safety < 80)
    || (finite(drift) && drift <= 8)
    || (finite(p95) && p95 <= 6)
    || recommendation === "proceed"
    || recommendation === "hold";

  const zone: RiskZoneLabel = critical
    ? "Critical"
    : defensive
      ? "Defensive"
      : watch
        ? "Watch"
        : optimal
          ? "Optimal"
          : healthy
            ? "Healthy"
            : "Watch";
  const isFallback = zone === "Watch" && !watch;
  const copy = isFallback
    ? {
        ...ZONE_COPY.Watch,
        explanation: "Insufficient data for full zone confidence. Review key risk metrics before acting.",
        metricInterpretation: "Too few recognized report metrics are available for a higher-confidence classification.",
      }
    : ZONE_COPY[zone];

  return {
    zone,
    severity: SEVERITY[zone],
    ...copy,
    keyDrivers: driversFor(input, isFallback),
    isFallback,
  };
}
