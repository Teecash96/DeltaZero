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
    ["Safety Buffer", metrics.safety_buffer_score.toFixed(1), "Collateral resilience", true],
    ["Hedge ratio", metrics.hedge_ratio.toFixed(3), "Short ÷ long", false],
    ["Hedge drift", `${metrics.hedge_drift_pct.toFixed(1)}%`, "Distance from neutral", false],
    ["Net delta", `${metrics.net_delta_estimate > 0 ? "+" : ""}${metrics.net_delta_estimate.toFixed(1)}%`, "Directional exposure", false],
    ["Net carry APY", `${metrics.estimated_net_carry_apy.toFixed(1)}%`, "After funding & fees", false],
    ["Carry efficiency", metrics.carry_efficiency_score.toFixed(1), "Return quality score", false],
    ["Capital at risk", usd(metrics.capital_at_risk_proxy), "Exposure proxy", false],
  ];
  return <section className="metrics-section">
    <div className="section-label-row"><h2 className="panel-title">Core metrics</h2><span>Deterministic output</span></div>
    <div className="metrics-grid">
      {values.map(([label, value, helper, featured]) => <div className={`metric ${featured ? "metric-featured" : ""}`} key={String(label)}>
        <div className="metric-heading"><label>{label}</label>{featured && <span>Primary risk signal</span>}</div>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>)}
    </div>
  </section>;
}

function Summary({ result }: { result: ResultValue }) { return <section className="panel summary-card"><div><span className="summary-meta">Analysis complete · {result.asset}</span><h2>{result.strategy_name}</h2><span className="summary-meta">{result.service} strategy summary</span></div><span className="summary-check">✓ Complete</span></section>; }
function RiskNotes({ notes }: { notes: string[] }) { return <section className="panel"><h2 className="panel-title">Risk notes</h2><ul className="risk-list">{notes.map((note) => <li key={note}>{note}</li>)}</ul></section>; }

function DecisionPanel({ result }: { result: ResultValue }) {
  return <section className="panel decision-card">
    <div className="decision-header"><div><p className="decision-eyebrow">Decision output</p><h2>{result.recommendation.summary}</h2></div><span className="decision-mark">Δ</span></div>
    <div className="decision-statuses">
      <div className="decision-status">
        <span className="decision-label">Strategy Health</span>
        <strong className={`health-value ${result.strategy_health}`}>{result.strategy_health}</strong>
        <p>Current risk condition based on hedge, carry, and collateral metrics.</p>
      </div>
      <div className="decision-status action-status">
        <span className="decision-label">Recommended Action</span>
        <strong className="action-value">{result.recommendation.action}</strong>
        <p>The next decision suggested by the current strategy condition.</p>
      </div>
    </div>
  </section>;
}

function Result({ mode, result }: { mode: Mode; result: ResultValue }) {
  const withActions = result as AuditResponse | StressTestResponse;
  const build = result as BuildResponse;
  const stress = result as StressTestResponse;
  return <div className="result-stack" aria-live="polite">
    <Summary result={result} />
    <DecisionPanel result={result} />
    {mode === "builder" && <section className="panel"><h2 className="panel-title">Recommended structure</h2><div className="structure-grid">{Object.entries(build.recommended_structure).map(([key, value]) => <div className="structure-item" key={key}><label>{formatKey(key)}</label><strong>{key.includes("usd") ? usd(value) : value.toFixed(3)}</strong></div>)}</div></section>}
    {mode === "stress-test" && <section className="panel"><h2 className="panel-title">Scenario result</h2><div className="structure-grid">{Object.entries(stress.scenario_result).filter(([key]) => !["stressed_metrics"].includes(key)).map(([key, value]) => <div className="structure-item" key={key}><label>{formatKey(key)}</label><strong>{typeof value === "number" ? (key.includes("usd") ? usd(value) : value) : String(value).replaceAll("_", " ")}</strong></div>)}</div></section>}
    <MetricsView metrics={mode === "stress-test" ? stress.scenario_result.stressed_metrics : result.metrics} />
    <div className="result-columns">
      <RiskNotes notes={result.risk_notes} />
      {mode !== "builder" && <section className="panel"><h2 className="panel-title">Action sequence</h2><p className="panel-copy">Ordered actions returned for this position.</p><div className="actions-row">{withActions.actions.map((action, index) => <span key={action}><b>{index + 1}</b>{action}</span>)}</div></section>}
      {mode === "builder" && <section className="panel context-card"><h2 className="panel-title">How to read this result</h2><p>Health measures the proposed structure&apos;s risk condition. Action determines whether the strategy should be opened now.</p></section>}
    </div>
    <details className="panel json-box"><summary><span><b>Raw JSON response</b><small>Developer payload</small></span><i aria-hidden="true">⌄</i></summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </div>;
}

export function StrategyWorkspace({ mode }: { mode: Mode }) {
  const [value, setValue] = useState<FormValue>(() => structuredClone(samples[mode]));
  const [result, setResult] = useState<ResultValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(null); try { const response = mode === "builder" ? await buildStrategy(value as BuildRequest) : mode === "auditor" ? await auditStrategy(value as AuditRequest) : await stressTestStrategy(value as StressTestRequest); setResult(response); } catch (caught) { setResult(null); setError(caught instanceof Error ? caught.message : "Unable to reach the strategy service."); } finally { setLoading(false); } }
  return <div className="workspace"><header className="page-intro"><div><p className="kicker">{copy[mode].kicker}</p><h1>{copy[mode].title}</h1><p>{copy[mode].description}</p></div><span className="endpoint">{copy[mode].endpoint}</span></header><div className="workspace-grid"><StrategyForm mode={mode} value={value} setValue={setValue} submit={submit} loading={loading} /><div className="result-region">{error ? <div className="error-box" role="alert"><span className="state-icon">!</span><div><strong>Analysis could not be completed</strong><p>{error}</p><small>Check that the API is running and try again.</small></div></div> : loading ? <div className="panel loading-state"><div><div className="spinner" /><strong>Analyzing strategy</strong><p>Calculating hedge, carry, and collateral metrics…</p></div></div> : result ? <Result mode={mode} result={result} /> : <div className="panel empty-state"><div><div className="empty-icon">Δ</div><strong>Ready for analysis</strong><p>Review the preloaded inputs, then submit to generate a deterministic strategy decision.</p><small>No wallet or live market connection required.</small></div></div>}</div></div></div>;
}
