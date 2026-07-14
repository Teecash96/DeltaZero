import type { WalletExposureImport } from "./types";

export const WALLET_HANDOFF_KEY = "deltazero.wallet-builder-handoff";
export const STRESS_HANDOFF_KEY = "deltazero.builder-stress-handoff";
export const MONTE_CARLO_HANDOFF_KEY = "deltazero.monte-carlo-handoff";

export interface MonteCarloHandoff {
  source: "strategy_builder" | "wallet_auditor";
  asset: "SOL" | "ETH";
  capital_usd: number | null;
  long_notional_usd: number;
  short_notional_usd: number;
  collateral_usd: number;
  long_yield_apy?: number;
  short_funding_apy?: number;
  fee_drag_apy?: number;
  risk_tolerance: "low" | "medium" | "high";
  target_style: "neutral_yield" | "conservative_income" | "aggressive_carry" | "capital_preservation";
}

export interface StressHandoff {
  source: "wallet_hedge_builder";
  wallet_address: string;
  snapshot_timestamp: string | null;
  asset: "SOL" | "ETH";
  current_long_notional_usd: number;
  current_short_notional_usd: number;
  proposed_short_notional_usd: number;
  collateral_usd: number;
  short_adjustment_usd: number;
  target_hedge_ratio: number;
  long_yield_apy: number;
  short_funding_apy: number;
  fee_drag_apy: number;
  risk_tolerance: "low" | "medium" | "high";
}

export function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function writeWalletHandoff(value: WalletExposureImport) {
  sessionStorage.setItem(WALLET_HANDOFF_KEY, JSON.stringify(value));
}
