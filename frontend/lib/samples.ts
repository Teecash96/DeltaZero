import type { AuditRequest, BuildRequest, StressTestRequest } from "./types";

export const BUILD_SAMPLE: BuildRequest = {
  asset: "SOL",
  capital_usd: 5000,
  risk_tolerance: "medium",
  target_style: "neutral_yield",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
};

export const AUDIT_SAMPLE: AuditRequest = {
  asset: "SOL",
  long_notional_usd: 3800,
  short_notional_usd: 3000,
  collateral_usd: 1200,
  risk_tolerance: "medium",
  long_yield_apy: 12,
  short_funding_apy: 4,
  fee_drag_apy: 1,
};

export const STRESS_TEST_SAMPLE: StressTestRequest = {
  asset: "SOL",
  long_notional_usd: 3500,
  short_notional_usd: 3150,
  collateral_usd: 1500,
  risk_tolerance: "medium",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
  scenario: {
    type: "funding_worsens",
    magnitude_pct: 4,
  },
};
