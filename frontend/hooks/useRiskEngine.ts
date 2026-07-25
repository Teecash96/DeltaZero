"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateReport, calculateStressTest, estimateCriticalProbability, type RiskReport, type StrategyInputs } from "@/lib/riskEngine";
import { runMonteCarlo, type MonteCarloResult } from "@/lib/monteCarlo";

const SCENARIOS = {
  "funding_flips": { label: "Funding Flips Negative", description: "Short funding changes to -8%", scenario: { funding_apy: -8 } },
  "yield_drops": { label: "Yield Drops 50%", description: "Long yield halves immediately", scenario: { long_yield_mult: 0.5 } },
  "price_shock": { label: "Price Shock -20%", description: "Safety Buffer reduced by 15 points", scenario: { buffer_reduction: 15 } },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

const URL_DEFAULTS: Partial<StrategyInputs> = {};

function parseURLParams(): Partial<StrategyInputs> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const result: Partial<StrategyInputs> = {};
  const assetParam = params.get("asset");
  if (assetParam === "SOL" || assetParam === "ETH") result.asset = assetParam;
  const capital = Number(params.get("capital"));
  if (Number.isFinite(capital) && capital >= 1000 && capital <= 50000) result.capital_usd = capital;
  const ly = Number(params.get("yield"));
  if (Number.isFinite(ly) && ly >= 0 && ly <= 25) result.long_yield_apy = ly;
  const sf = Number(params.get("funding"));
  if (Number.isFinite(sf) && sf >= -15 && sf <= 15) result.short_funding_apy = sf;
  const fd = Number(params.get("fee"));
  if (Number.isFinite(fd) && fd >= 0 && fd <= 5) result.fee_drag_apy = fd;
  const rt = params.get("risk");
  if (rt === "conservative" || rt === "medium" || rt === "aggressive") result.risk_tolerance = rt;
  const ts = params.get("style");
  if (ts === "neutral_yield" || ts === "conservative_income" || ts === "aggressive_carry" || ts === "capital_preservation") result.target_style = ts;
  return result;
}

const DEFAULTS: StrategyInputs = {
  asset: "SOL",
  capital_usd: 5000,
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
  risk_tolerance: "medium",
  target_style: "neutral_yield",
};

export function useRiskEngine() {
  const [inputs, setInputsRaw] = useState<StrategyInputs>(() => ({ ...DEFAULTS, ...parseURLParams() }));
  const [stressScenario, setStressScenario] = useState<ScenarioKey | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setInputs = useCallback((update: Partial<StrategyInputs> | ((prev: StrategyInputs) => StrategyInputs)) => {
    setInputsRaw(prev => {
      const next = typeof update === "function" ? update(prev) : { ...prev, ...update };
      // Debounced URL update
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          Object.entries(next).forEach(([k, v]) => {
            if (v !== undefined && v !== DEFAULTS[k as keyof StrategyInputs]) {
              url.searchParams.set(k, String(v));
            } else {
              url.searchParams.delete(k);
            }
          });
          window.history.replaceState({}, "", url.toString());
        }
      }, 200);
      return next;
    });
  }, []);

  const report = useMemo(() => calculateReport(inputs), [inputs]);

  const stressedReport = useMemo(() => {
    if (!stressScenario) return null;
    const s = SCENARIOS[stressScenario].scenario;
    return calculateStressTest(report, s, inputs);
  }, [stressScenario, report, inputs]);

  const criticalProbability = useMemo(() =>
    estimateCriticalProbability(stressedReport?.safety_buffer ?? report.safety_buffer, inputs.risk_tolerance),
  [report, stressedReport, inputs.risk_tolerance]);

  const runSimulation = useCallback(() => {
    setMcLoading(true);
    const seed = Math.floor(Math.random() * 10000);
    setMcResult(runMonteCarlo(inputs.asset, report.net_carry_apy, 30, 20, seed));
    setMcLoading(false);
  }, [inputs.asset, report.net_carry_apy]);

  // Auto-run MC on first load
  useEffect(() => {
    runSimulation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyScenario = useCallback((key: ScenarioKey) => {
    setStressScenario(prev => prev === key ? null : key);
  }, []);

  const shareUrl = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    Object.entries(inputs).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set("mc_seed", String(Math.floor(Math.random() * 10000)));
    await navigator.clipboard.writeText(url.toString());
  }, [inputs]);

  const activeReport = stressedReport ?? report;

  return {
    inputs,
    setInputs,
    report,
    stressedReport,
    activeReport,
    stressScenario,
    applyScenario,
    criticalProbability,
    mcResult,
    mcLoading,
    runSimulation,
    shareUrl,
    scenarios: SCENARIOS,
  };
}
