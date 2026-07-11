"use client";

import { useState, type FormEvent } from "react";
import type { AuditRequest, AuditResponse, BuildRequest, BuildResponse, Metrics, ScenarioType, StressTestRequest, StressTestResponse } from "@/lib/types";
import { auditStrategy, buildStrategy, stressTestStrategy } from "@/lib/api";
import { AUDIT_SAMPLE, BUILD_SAMPLE, STRESS_TEST_SAMPLE } from "@/lib/samples";

type Mode = "builder" | "auditor" | "stress-test";
type FormValue = BuildRequest | AuditRequest | StressTestRequest;
type ResultValue = BuildResponse | AuditResponse | StressTestResponse;

const copy = {
  builder: { kicker: "Design from first principles", title: "Strategy Builder", description: "Set your capital, carry assumptions, and risk posture. DeltaZero returns a balanced structure and an explicit entry decision.", endpoint: "POST /strategy/build", submit: "Build strategy" },
  auditor: { kicker: "Inspect the position", title: "Position Auditor", description: "Assess an existing long and short structure for hedge alignment, carry quality, and collateral resilience.", endpoint: "POST /strategy/audit", submit: "Audit position" },
  "stress-test": { kicker: "Pressure before the market", title: "Stress Test", description: "Apply a deterministic market shock and see how the position, health, and recommended action respond.", endpoint: "POST /strategy/stress-test", submit: "Run stress test" },
};

const samples = { builder: BUILD_SAMPLE, auditor: AUDIT_SAMPLE, "stress-test": STRESS_TEST_SAMPLE };

const fieldLabels: Record<string, string> = {
  asset: "Asset", capital_usd: "Capital (USD)", risk_tolerance: "Risk tolerance", target_style: "Target style", long_notional_usd: "Long notional (USD)", short_notional_usd: "Short notional (USD)", collateral_usd: "Collateral (USD)", long_yield_apy: "Long yield APY (%)", short_funding_apy: "Short funding APY (%)", fee_drag_apy: "Fee drag APY (%)",
};

function formatKey(key: string) { return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function usd(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

function StrategyForm({ mode, value, setValue, submit, loading }: { mode: Mode; value: FormValue; setValue: (value: FormValue) => void; submit: (event: FormEvent) => void; loading: boolean }) {
  const update = (key: string, raw: string) => setValue({ ...value, [key]: ["asset", "risk_tolerance", "target_style"].includes(key) ? raw : Number(raw) } as FormValue);
  const keys = Object.keys(value).filter((key) => key !== "scenario");
  return <form className="panel" onSubmit={submit}>
    <h2 className="panel-title">Strategy inputs</h2>
    <div className="form-grid">
      {keys.map((key) => <div className={`field ${["capital_usd"].includes(key) ? "full" : ""}`} key={key}>
        <label htmlFor={`${mode}-${key}`}>{fieldLabels[key]}</label>
        {key === "asset" ? <select id={`${mode}-${key}`} value={String(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)}><option value="SOL">SOL</option><option value="ETH">ETH</option></select>
        : key === "risk_tolerance" ? <select id={`${mode}-${key}`} value={String(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        : key === "target_style" ? <select id={`${mode}-${key}`} value={String(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)}><option value="neutral_yield">Neutral yield</option></select>
        : <input id={`${mode}-${key}`} type="number" step="any" min={key === "fee_drag_apy" ? 0 : undefined} value={Number(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)} required />}
      </div>)}
      {mode === "stress-test" && <>
        <div className="field"><label htmlFor="scenario-type">Scenario</label><select id="scenario-type" value={(value as StressTestRequest).scenario.type} onChange={(e) => setValue({ ...value, scenario: { ...(value as StressTestRequest).scenario, type: e.target.value as ScenarioType } } as StressTestRequest)}><option value="funding_worsens">Funding worsens</option><option value="yield_drops">Yield drops</option><option value="price_drop">Price drops</option><option value="price_rise">Price rises</option></select></div>
        <div className="field"><label htmlFor="scenario-magnitude">Magnitude (%)</label><input id="scenario-magnitude" type="number" min="0" step="any" required value={(value as StressTestRequest).scenario.magnitude_pct} onChange={(e) => setValue({ ...value, scenario: { ...(value as StressTestRequest).scenario, magnitude_pct: Number(e.target.value) } } as StressTestRequest)} /></div>
      </>}
    </div>
    <button className="button button-primary form-submit" disabled={loading}>{loading ? "Analyzing…" : copy[mode].submit}<span>→</span></button>
    <p className="form-note">Demo values are preloaded · Edit any input</p>
  </form>;
}

function MetricsView({ metrics }: { metrics: Metrics }) {
  const values = [
    ["Safety Buffer", metrics.safety_buffer_score.toFixed(1), true], ["Hedge ratio", metrics.hedge_ratio.toFixed(3), false], ["Hedge drift", `${metrics.hedge_drift_pct.toFixed(1)}%`, false], ["Net delta estimate", `${metrics.net_delta_estimate > 0 ? "+" : ""}${metrics.net_delta_estimate.toFixed(1)}%`, false], ["Net carry APY", `${metrics.estimated_net_carry_apy.toFixed(1)}%`, false], ["Carry efficiency", metrics.carry_efficiency_score.toFixed(1), false], ["Capital at risk", usd(metrics.capital_at_risk_proxy), false],
  ];
  return <section><h2 className="panel-title">Core metrics</h2><div className="metrics-grid">{values.map(([label, value, featured]) => <div className={`metric ${featured ? "metric-featured" : ""}`} key={String(label)}><label>{label}</label><strong>{value}</strong></div>)}</div></section>;
}

function Summary({ result }: { result: ResultValue }) { return <section className="panel summary-card"><div><span className="summary-meta">{result.service} · {result.asset}</span><h2>{result.strategy_name}</h2><span className="summary-meta">Strategy summary</span></div><span className={`health-badge ${result.strategy_health}`}>{result.strategy_health}</span></section>; }
function RiskNotes({ notes }: { notes: string[] }) { return <section className="panel"><h2 className="panel-title">Risk notes</h2><ul className="risk-list">{notes.map((note) => <li key={note}>{note}</li>)}</ul></section>; }

function Result({ mode, result }: { mode: Mode; result: ResultValue }) {
  const withActions = result as AuditResponse | StressTestResponse;
  const build = result as BuildResponse;
  const stress = result as StressTestResponse;
  return <div className="result-stack" aria-live="polite">
    <Summary result={result} />
    {mode === "builder" && <section className="panel"><h2 className="panel-title">Recommended structure</h2><div className="structure-grid">{Object.entries(build.recommended_structure).map(([key, value]) => <div className="structure-item" key={key}><label>{formatKey(key)}</label><strong>{key.includes("usd") ? usd(value) : value.toFixed(3)}</strong></div>)}</div></section>}
    {mode === "stress-test" && <section className="panel"><h2 className="panel-title">Scenario result</h2><div className="structure-grid">{Object.entries(stress.scenario_result).filter(([key]) => !["stressed_metrics"].includes(key)).map(([key, value]) => <div className="structure-item" key={key}><label>{formatKey(key)}</label><strong>{typeof value === "number" ? (key.includes("usd") ? usd(value) : value) : String(value).replaceAll("_", " ")}</strong></div>)}</div></section>}
    <MetricsView metrics={mode === "stress-test" ? stress.scenario_result.stressed_metrics : result.metrics} />
    <div className="result-columns"><section className="panel recommendation"><h2 className="panel-title">Recommendation</h2><div className="recommendation-top"><span className="action-badge">{result.recommendation.action}</span></div><p>{result.recommendation.summary}</p></section><RiskNotes notes={result.risk_notes} /></div>
    {mode !== "builder" && <section className="panel"><h2 className="panel-title">Actions</h2><div className="actions-row">{withActions.actions.map((action) => <span key={action}>{action}</span>)}</div></section>}
    <details className="panel json-box"><summary>Raw JSON response</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </div>;
}

export function StrategyWorkspace({ mode }: { mode: Mode }) {
  const [value, setValue] = useState<FormValue>(() => structuredClone(samples[mode]));
  const [result, setResult] = useState<ResultValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(null); try { const response = mode === "builder" ? await buildStrategy(value as BuildRequest) : mode === "auditor" ? await auditStrategy(value as AuditRequest) : await stressTestStrategy(value as StressTestRequest); setResult(response); } catch (caught) { setResult(null); setError(caught instanceof Error ? caught.message : "Unable to reach the strategy service."); } finally { setLoading(false); } }
  return <div className="workspace"><header className="page-intro"><div><p className="kicker">{copy[mode].kicker}</p><h1>{copy[mode].title}</h1><p>{copy[mode].description}</p></div><span className="endpoint">{copy[mode].endpoint}</span></header><div className="workspace-grid"><StrategyForm mode={mode} value={value} setValue={setValue} submit={submit} loading={loading} /><div>{error ? <div className="error-box" role="alert"><strong>Analysis failed</strong><br />{error}</div> : loading ? <div className="panel loading-state"><div><div className="spinner" /><p>Calculating strategy metrics…</p></div></div> : result ? <Result mode={mode} result={result} /> : <div className="panel empty-state"><div><div className="empty-icon">Δ</div><p>Submit the demo inputs to generate<br />a deterministic strategy analysis.</p></div></div>}</div></div></div>;
}
