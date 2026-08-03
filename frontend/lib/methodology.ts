import type { RiskTolerance, TargetStyle, WalletStressProfile } from "@/lib/types";

export type RiskPolicy = {
  targetHedgeRatio?: number;
  hedgeDriftWarning: number;
  hedgeDriftCritical: number;
  safetyBufferWarning: number;
  safetyBufferCritical: number;
  minimumCarry: number;
  capitalRiskWarning?: number;
  capitalRiskCritical?: number;
  impairmentWarning?: number;
  impairmentCritical?: number;
};

const STYLE_POLICIES: Record<TargetStyle, RiskPolicy> = {
  neutral_yield: {
    targetHedgeRatio: 0.96,
    hedgeDriftWarning: 6,
    hedgeDriftCritical: 12,
    safetyBufferWarning: 60,
    safetyBufferCritical: 40,
    minimumCarry: 2,
    capitalRiskWarning: 18,
    capitalRiskCritical: 28,
    impairmentWarning: 10,
    impairmentCritical: 20,
  },
  conservative_income: {
    targetHedgeRatio: 0.985,
    hedgeDriftWarning: 4,
    hedgeDriftCritical: 8,
    safetyBufferWarning: 75,
    safetyBufferCritical: 58,
    minimumCarry: 1,
    capitalRiskWarning: 14,
    capitalRiskCritical: 22,
    impairmentWarning: 6,
    impairmentCritical: 14,
  },
  aggressive_carry: {
    targetHedgeRatio: 0.94,
    hedgeDriftWarning: 7,
    hedgeDriftCritical: 14,
    safetyBufferWarning: 55,
    safetyBufferCritical: 38,
    minimumCarry: 3,
    capitalRiskWarning: 24,
    capitalRiskCritical: 34,
    impairmentWarning: 14,
    impairmentCritical: 28,
  },
  capital_preservation: {
    targetHedgeRatio: 0.99,
    hedgeDriftWarning: 3,
    hedgeDriftCritical: 6,
    safetyBufferWarning: 82,
    safetyBufferCritical: 68,
    minimumCarry: 0.5,
    capitalRiskWarning: 10,
    capitalRiskCritical: 18,
    impairmentWarning: 4,
    impairmentCritical: 10,
  },
};

export function builderPolicy(riskTolerance: RiskTolerance, targetStyle: TargetStyle): RiskPolicy {
  const base = STYLE_POLICIES[targetStyle];
  if (riskTolerance === "low") {
    return {
      ...base,
      targetHedgeRatio: Math.min(0.995, (base.targetHedgeRatio ?? 0) + 0.005),
      hedgeDriftWarning: Math.max(2.5, base.hedgeDriftWarning - 1),
      hedgeDriftCritical: Math.max(5, base.hedgeDriftCritical - 1.5),
      safetyBufferWarning: Math.min(90, base.safetyBufferWarning + 4),
      safetyBufferCritical: Math.min(80, base.safetyBufferCritical + 3),
      minimumCarry: Math.max(0.5, base.minimumCarry + 0.5),
      capitalRiskWarning: Math.max(8, (base.capitalRiskWarning ?? 0) - 2),
      capitalRiskCritical: Math.max(12, (base.capitalRiskCritical ?? 0) - 3),
    };
  }
  if (riskTolerance === "high") {
    return {
      ...base,
      targetHedgeRatio: Math.max(0.9, (base.targetHedgeRatio ?? 0) - 0.005),
      hedgeDriftWarning: base.hedgeDriftWarning + 1,
      hedgeDriftCritical: base.hedgeDriftCritical + 2,
      safetyBufferWarning: Math.max(45, base.safetyBufferWarning - 4),
      safetyBufferCritical: Math.max(30, base.safetyBufferCritical - 3),
      minimumCarry: Math.max(0.25, base.minimumCarry - 0.25),
      capitalRiskWarning: (base.capitalRiskWarning ?? 0) + 2,
      capitalRiskCritical: (base.capitalRiskCritical ?? 0) + 3,
    };
  }
  return base;
}

export function decisionPolicy(riskTolerance: RiskTolerance): RiskPolicy {
  const policies: Record<RiskTolerance, RiskPolicy> = {
    low: { targetHedgeRatio: 0.92, hedgeDriftWarning: 4, hedgeDriftCritical: 8, safetyBufferWarning: 70, safetyBufferCritical: 50, minimumCarry: 3, capitalRiskWarning: 12, capitalRiskCritical: 20, impairmentWarning: 8, impairmentCritical: 16 },
    medium: { targetHedgeRatio: 0.96, hedgeDriftWarning: 6, hedgeDriftCritical: 12, safetyBufferWarning: 60, safetyBufferCritical: 40, minimumCarry: 2, capitalRiskWarning: 18, capitalRiskCritical: 28, impairmentWarning: 10, impairmentCritical: 20 },
    high: { targetHedgeRatio: 0.98, hedgeDriftWarning: 8, hedgeDriftCritical: 16, safetyBufferWarning: 50, safetyBufferCritical: 35, minimumCarry: 1, capitalRiskWarning: 22, capitalRiskCritical: 32, impairmentWarning: 12, impairmentCritical: 24 },
  };
  return policies[riskTolerance];
}

export function walletPolicy(profile: WalletStressProfile): RiskPolicy {
  const policies: Record<WalletStressProfile, RiskPolicy> = {
    standard: { hedgeDriftWarning: 6, hedgeDriftCritical: 12, safetyBufferWarning: 60, safetyBufferCritical: 40, minimumCarry: 0, capitalRiskWarning: 18, capitalRiskCritical: 30, impairmentWarning: 8, impairmentCritical: 18 },
    elevated: { hedgeDriftWarning: 5, hedgeDriftCritical: 10, safetyBufferWarning: 68, safetyBufferCritical: 48, minimumCarry: 0, capitalRiskWarning: 14, capitalRiskCritical: 24, impairmentWarning: 6, impairmentCritical: 14 },
    strict: { hedgeDriftWarning: 4, hedgeDriftCritical: 8, safetyBufferWarning: 74, safetyBufferCritical: 56, minimumCarry: 0, capitalRiskWarning: 10, capitalRiskCritical: 18, impairmentWarning: 4, impairmentCritical: 10 },
  };
  return policies[profile];
}

export function policyLines(policy: RiskPolicy): string[] {
  return [
    `Hedge drift warning at ${policy.hedgeDriftWarning}% and critical at ${policy.hedgeDriftCritical}%.`,
    `Safety Buffer warning at ${policy.safetyBufferWarning} and critical at ${policy.safetyBufferCritical}.`,
    policy.targetHedgeRatio === undefined ? "Target hedge ratio is inferred from the submitted position." : `Target hedge ratio is ${(policy.targetHedgeRatio * 100).toFixed(1)}%.`,
    policy.minimumCarry > 0 ? `Minimum carry to open is ${policy.minimumCarry}% APY.` : "Carry is reported for context and is not an opening gate for this wallet profile.",
    policy.capitalRiskWarning === undefined ? "Capital risk thresholds are unavailable for this report." : `Capital at risk warning is ${policy.capitalRiskWarning}% and critical is ${policy.capitalRiskCritical}%.`,
  ];
}

export const CORE_FORMULAS = [
  "Hedge ratio = short notional ÷ long notional.",
  "Hedge drift = |1 − hedge ratio| × 100.",
  "Net carry APY = long yield − weighted funding − fee drag.",
  "Safety Buffer = min(100, collateral ÷ short notional × 200).",
];

export const STRESS_FORMULAS = [
  "Post stress equity = pre stress equity − impairment components.",
  "Impairment = asset impact + hedge PnL + collateral haircut + exit slippage + liquidation penalty + protocol loss assumption.",
  "Stressed metrics are recalculated after the submitted scenario is applied.",
];

export const COMMON_LIMITATIONS = [
  "Safety Buffer is a heuristic score, not liquidation probability or a venue health factor.",
  "Thresholds are transparent engineering policies, not empirically calibrated trading limits.",
  "Outputs are decision support. They do not predict profitability or authorize execution.",
  "Users must verify venue rules, liquidity, oracle behavior, latency, and transaction costs.",
];
