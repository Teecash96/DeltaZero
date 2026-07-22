import type { PlanCatalogEntry } from "@okxweb3/app-x402-core/subscription";
import type { RouteConfig } from "@okxweb3/app-x402-core/server";

type PaymentOption = Exclude<RouteConfig["accepts"], Array<unknown>>;

export const NETWORK = "eip155:196" as const;
export const PLAN_ID = "deltazero_risk_engine_monthly";
export const MONTHLY_PRICE_ATOMIC = "5000000";

export function createMonthlyPlan(payTo: string): PlanCatalogEntry {
  return {
    id: PLAN_ID,
    tier: 1,
    payTo,
    amountPerPeriod: MONTHLY_PRICE_ATOMIC,
    periodMode: 1,
    periodSec: 0,
    maxPeriods: 12,
    initialCharge: {
      periodCount: 1,
      totalAmount: MONTHLY_PRICE_ATOMIC,
    },
    name: "DeltaZero Risk Engine Monthly",
  };
}

export function toAccept(plan: PlanCatalogEntry): PaymentOption {
  return {
    scheme: "period",
    network: NETWORK,
    payTo: plan.payTo,
    price: "$5",
    maxTimeoutSeconds: 600,
    extra: {
      amountPerPeriod: plan.amountPerPeriod,
      periodMode: plan.periodMode ?? 1,
      periodSec: plan.periodSec,
      maxPeriods: plan.maxPeriods,
      initialCharge: plan.initialCharge,
      plan: { id: plan.id, tier: plan.tier, name: plan.name },
    },
  };
}
