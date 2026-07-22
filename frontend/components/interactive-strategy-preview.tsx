"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { compareStrategyPreview } from "@/lib/api";
import type { BuildResponse, RiskTolerance, StrategyPreviewRequest, StrategyPreviewResponse } from "@/lib/types";

const DEFAULTS: StrategyPreviewRequest = {
  asset: "SOL",
  capital_usd: 5000,
  risk_tolerance: "medium",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
};

const steps = ["Validating assumptions", "Building both structures", "Comparing risk policy", "Preparing decision"];

function metric(result: BuildResponse, name: "carry" | "drift" | "buffer" | "collateral") {
  if (name === "carry") return `${result.metrics.estimated_net_carry_apy.toFixed(1)}%`;
  if (name === "drift") return `${result.metrics.hedge_drift_pct.toFixed(1)}%`;
  if (name === "buffer") return `${result.metrics.safety_buffer_score.toFixed(0)} / 100`;
  return `$${result.recommended_structure.collateral_usd.toLocaleString()}`;
}

function ResultColumn({ title, result }: { title: string; result: BuildResponse }) {
  return <article className="preview-result-card">
    <div><span>{title}</span><b className={`preview-action preview-action-${result.recommendation.action.toLowerCase()}`}>{result.recommendation.action}</b></div>
    <dl>
      <div><dt>Net carry</dt><dd>{metric(result, "carry")}</dd></div>
      <div><dt>Hedge drift</dt><dd>{metric(result, "drift")}</dd></div>
      <div><dt>Safety Buffer</dt><dd>{metric(result, "buffer")}</dd></div>
      <div><dt>Collateral reserve</dt><dd>{metric(result, "collateral")}</dd></div>
    </dl>
    <p>{result.recommendation.summary}</p>
  </article>;
}

export function InteractiveStrategyPreview() {
  const [value, setValue] = useState(DEFAULTS);
  const [result, setResult] = useState<StrategyPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      if (query.get("preview") !== "1") return;
      const capital = Number(query.get("capital"));
      const risk = query.get("risk");
      setValue((current) => ({
        ...current,
        asset: query.get("asset") === "ETH" ? "ETH" : "SOL",
        capital_usd: Number.isFinite(capital) && capital > 0 ? capital : current.capital_usd,
        risk_tolerance: risk === "low" || risk === "high" ? risk : "medium",
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setActiveStep((current) => Math.min(current + 1, steps.length - 1)), 550);
    return () => window.clearInterval(timer);
  }, [loading]);

  const valid = useMemo(() => value.capital_usd > 0 && value.long_yield_apy >= -100 && value.fee_drag_apy >= 0, [value]);

  async function run() {
    setLoading(true); setError(null); setActiveStep(0);
    try { setResult(await compareStrategyPreview(value)); }
    catch (caught) { setResult(null); setError(caught instanceof Error ? caught.message : "The preview service is temporarily unavailable."); }
    finally { setLoading(false); }
  }

  async function share() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ preview: "1", asset: value.asset, capital: String(value.capital_usd), risk: value.risk_tolerance }).toString();
    await navigator.clipboard.writeText(url.toString());
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <section id="interactive-preview" className="section-wrap interactive-preview-section anchor-section" aria-labelledby="interactive-preview-title">
    <div className="section-heading"><div><p className="kicker">x402 protected · 1 USDT · live engine</p><h2 id="interactive-preview-title">Build and compare a strategy in 60 seconds.</h2></div><p>Submit assumptions to the same deterministic builder used by DeltaZero's API, then compare Conservative Income with Aggressive Carry. Payment settled on X Layer via x402.</p></div>
    <div className="interactive-preview-shell glass-card">
      <div className="preview-input-panel">
        <div className="preview-input-grid">
          <label><span>Asset</span><select value={value.asset} onChange={(event) => setValue({ ...value, asset: event.target.value as "SOL" | "ETH" })}><option>SOL</option><option>ETH</option></select></label>
          <label><span>Capital</span><input inputMode="decimal" type="number" min="1" value={value.capital_usd} onChange={(event) => setValue({ ...value, capital_usd: Number(event.target.value) })} /></label>
          <label><span>Risk tolerance</span><select value={value.risk_tolerance} onChange={(event) => setValue({ ...value, risk_tolerance: event.target.value as RiskTolerance })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label><span>Long yield APY</span><input inputMode="decimal" type="number" value={value.long_yield_apy} onChange={(event) => setValue({ ...value, long_yield_apy: Number(event.target.value) })} /></label>
          <label><span>Short funding APY</span><input inputMode="decimal" type="number" value={value.short_funding_apy} onChange={(event) => setValue({ ...value, short_funding_apy: Number(event.target.value) })} /></label>
          <label><span>Fee drag APY</span><input inputMode="decimal" type="number" min="0" value={value.fee_drag_apy} onChange={(event) => setValue({ ...value, fee_drag_apy: Number(event.target.value) })} /></label>
        </div>
        <button className="button button-primary preview-run" type="button" disabled={!valid || loading} onClick={() => void run()}>{loading ? "Comparing strategies…" : "Compare strategies"}<span>→</span></button>
        <small>Manual assumptions · DeltaZero v1 methodology · Results are decision support, not profit forecasts.</small>
      </div>
      <div className="preview-output-panel" aria-live="polite">
        {loading ? <div className="preview-progress" role="status"><div><strong>{steps[activeStep]}</strong><span>{activeStep + 1}/{steps.length}</span></div><i><b style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} /></i><ol>{steps.map((step, index) => <li className={index <= activeStep ? "active" : ""} key={step}>{index < activeStep ? "✓" : index + 1} {step}</li>)}</ol></div>
        : error ? <div className="preview-error" role="alert"><span>Service interruption</span><h3>The strategy preview could not respond.</h3><p>{error}</p><div><button className="button button-primary" onClick={() => void run()}>Retry analysis</button><a className="button button-secondary" href="https://deltazero-production.up.railway.app/health" target="_blank" rel="noreferrer">Check API health</a></div></div>
        : result ? <><div className="preview-results-head"><div><span>Live deterministic comparison</span><strong>{value.asset} · ${value.capital_usd.toLocaleString()}</strong></div><button type="button" onClick={() => void share()}>{copied ? "Link copied" : "Share comparison"}</button></div><div className="preview-comparison-grid"><ResultColumn title="Conservative Income" result={result.conservative} /><ResultColumn title="Aggressive Carry" result={result.aggressive} /></div><p className="preview-limitation">{result.limitation}</p></>
        : <div className="preview-empty"><span>ΔZ</span><h3>One input set. Two policy outcomes.</h3><p>Run the comparison to experience risk zones, hedge policy, carry, collateral, and operator recommendations—without connecting a wallet.</p></div>}
      </div>
    </div>
    <div className="preview-followup"><span>Need the complete four-module report?</span><Link className="button button-secondary" href="/risk-engine">Launch Risk Engine <b>→</b></Link></div>
  </section>;
}
