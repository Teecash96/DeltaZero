"use client";

import { useState, type FormEvent } from "react";
import type { AuditRequest, AuditResponse, BuildRequest, BuildResponse, Metrics, ScenarioType, StressTestRequest, StressTestResponse } from "@/lib/types";
import { auditStrategy, buildStrategy, stressTestStrategy } from "@/lib/api";
import { AUDIT_SAMPLE, BUILD_SAMPLE, STRESS_TEST_SAMPLE } from "@/lib/samples";

type Mode = "builder" | "auditor" | "stress-test";
type FormValue = BuildRequest | AuditRequest | StressTestRequest;
type ResultValue = BuildResponse | AuditResponse | StressTestResponse;

const copy = {
  builder: { kicker: "Design from first principles", title: "Strategy Builder", description: "Set your capital, carry assumptions, and risk posture. DeltaZero returns a balanced structure and an explicit entry decision.", endpoint: "POST /strategy/build", submit: "Analyze Strategy" },
  auditor: { kicker: "Inspect the position", title: "Position Auditor", description: "Assess an existing long and short structure for hedge alignment, carry quality, and collateral resilience.", endpoint: "POST /strategy/audit", submit: "Audit position" },
  "stress-test": { kicker: "Pressure before the market", title: "Stress Test", description: "Apply a deterministic market shock and see how the position, health, and recommended action respond.", endpoint: "POST /strategy/stress-test", submit: "Run stress test" },
};

const samples = { builder: BUILD_SAMPLE, auditor: AUDIT_SAMPLE, "stress-test": STRESS_TEST_SAMPLE };

const fieldLabels: Record<string, string> = {
  asset: "Asset", capital_usd: "Capital (USD)", risk_tolerance: "Risk tolerance", target_style: "Target style", long_notional_usd: "Long notional (USD)", short_notional_usd: "Short notional (USD)", collateral_usd: "Collateral (USD)", long_yield_apy: "Long yield APY (%)", short_funding_apy: "Short funding APY (%)", fee_drag_apy: "Fee drag APY (%)",
};

const fieldHelpers: Record<string, string> = {
  long_yield_apy: "Estimated annual yield from the long strategy.",
  short_funding_apy: "Estimated annual funding cost of the short hedge.",
  fee_drag_apy: "Estimated annual protocol and execution cost.",
  risk_tolerance: "Controls hedge and collateral targets.",
  target_style: "Defines the strategy construction objective.",
};

function formatKey(key: string) { return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function usd(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

function StrategyForm({ mode, value, setValue, submit, loading }: { mode: Mode; value: FormValue; setValue: (value: FormValue) => void; submit: (event: FormEvent) => void; loading: boolean }) {
  const update = (key: string, raw: string) => setValue({ ...value, [key]: ["asset", "risk_tolerance", "target_style"].includes(key) ? raw : Number(raw) } as FormValue);
  const available = new Set(Object.keys(value));
  const groups = [
    { title: "Strategy inputs", icon: "◇", keys: ["asset", "capital_usd", "long_notional_usd", "short_notional_usd", "collateral_usd"] },
    { title: "Market assumptions", icon: "↗", keys: ["long_yield_apy", "short_funding_apy", "fee_drag_apy"] },
    { title: "Risk settings", icon: "◎", keys: ["risk_tolerance", "target_style"] },
  ].map((group) => ({ ...group, keys: group.keys.filter((key) => available.has(key)) }));

  const renderField = (key: string) => <div className={`field ${fieldHelpers[key] ? "field-with-help" : ""}`} key={key}>
    <label htmlFor={`${mode}-${key}`}>{fieldLabels[key]}</label>
    {key === "asset" ? <select id={`${mode}-${key}`} value={String(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)}><option value="SOL">SOL</option><option value="ETH">ETH</option></select>
    : key === "risk_tolerance" ? <select id={`${mode}-${key}`} value={String(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
    : key === "target_style" ? <select id={`${mode}-${key}`} value={String(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)}><option value="neutral_yield">Neutral yield</option></select>
    : <input id={`${mode}-${key}`} type="number" step="any" min={key === "fee_drag_apy" ? 0 : undefined} value={Number(value[key as keyof FormValue])} onChange={(e) => update(key, e.target.value)} required />}
    {fieldHelpers[key] && <small>{fieldHelpers[key]}</small>}
  </div>;

  return <form className="panel" onSubmit={submit}>
    {groups.map((group) => <section className="form-section" key={group.title}>
      <h2><span aria-hidden="true">{group.icon}</span>{group.title}</h2>
      <div className="form-grid">{group.keys.map(renderField)}</div>
    </section>)}
    {mode === "stress-test" && <section className="form-section">
      <h2><span aria-hidden="true">⚡</span>Stress scenario</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="scenario-type">Scenario</label><select id="scenario-type" value={(value as StressTestRequest).scenario.type} onChange={(e) => setValue({ ...value, scenario: { ...(value as StressTestRequest).scenario, type: e.target.value as ScenarioType } } as StressTestRequest)}><option value="funding_worsens">Funding worsens</option><option value="yield_drops">Yield drops</option><option value="price_drop">Price drops</option><option value="price_rise">Price rises</option></select></div>
        <div className="field"><label htmlFor="scenario-magnitude">Magnitude (%)</label><input id="scenario-magnitude" type="number" min="0" step="any" required value={(value as StressTestRequest).scenario.magnitude_pct} onChange={(e) => setValue({ ...value, scenario: { ...(value as StressTestRequest).scenario, magnitude_pct: Number(e.target.value) } } as StressTestRequest)} /></div>
      </div>
    </section>}
    <button className="button button-primary form-submit" disabled={loading}>{loading ? "Analyzing strategy..." : <>{copy[mode].submit}<span>→</span></>}</button>
    <p className="form-note">Demo values are preloaded · Edit any input</p>
  </form>;
}

function MetricsView({ metrics }: { metrics: Metrics }) {
  const values = [
    ["Estimated net carry APY", `${metrics.estimated_net_carry_apy.toFixed(1)}%`, "After funding & fees", true],
    ["Hedge ratio", metrics.hedge_ratio.toFixed(3), "Short ÷ long", true],
    ["Hedge drift", `${metrics.hedge_drift_pct.toFixed(1)}%`, "Distance from neutral", false],
    ["Net delta estimate", `${metrics.net_delta_estimate > 0 ? "+" : ""}${metrics.net_delta_estimate.toFixed(1)}%`, "Directional exposure", false],
    ["Carry efficiency", metrics.carry_efficiency_score.toFixed(1), "Return quality score", false],
    ["Capital at risk", usd(metrics.capital_at_risk_proxy), "Exposure proxy", false],
  ];
  return <section className="metrics-section">
    <div className="section-label-row"><h2 className="panel-title">Core metrics</h2><span>Deterministic output</span></div>
    <div className="metrics-grid">
      {values.map(([label, value, helper, primary]) => <div className={`metric ${primary ? "metric-primary" : "metric-secondary"}`} key={String(label)}>
        <div className="metric-heading"><label>{label}</label></div>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>)}
    </div>
  </section>;
}

function SafetyBufferCard({ score }: { score: number }) {
  const status = score >= 70 ? "strong" : score >= 55 ? "watch" : "weak";
  return <section className={`panel safety-hero safety-${status}`}>
    <div><span className="safety-kicker">Primary risk signal</span><h2>Safety Buffer</h2><p>Collateral resilience score</p></div>
    <div className="safety-score"><strong>{score.toFixed(1)}</strong><span>{status}</span></div>
  </section>;
}

function Summary({ result }: { result: ResultValue }) {
  const items = [
    ["Asset", result.asset],
    ["Strategy name", result.strategy_name],
    ["Strategy health", result.strategy_health],
    ["Recommended action", result.recommendation.action],
    ["Estimated net carry APY", `${result.metrics.estimated_net_carry_apy.toFixed(1)}%`],
    ["Safety Buffer score", result.metrics.safety_buffer_score.toFixed(1)],
  ];
  return <section className="panel summary-card">
    <div className="summary-heading"><div><span className="summary-meta">Analysis complete · {result.service}</span><h2>AI Strategy Report</h2></div><span className="summary-check">✓ Complete</span></div>
    <div className="summary-grid">{items.map(([label, value]) => <div key={label}><label>{label}</label><strong className={label === "Strategy health" ? `summary-state health-${result.strategy_health}` : label === "Recommended action" ? `summary-state action-${result.recommendation.action.toLowerCase()}` : ""}>{value}</strong></div>)}</div>
  </section>;
}

function DecisionPanel({ result }: { result: ResultValue }) {
  const constrainedActions = ["WAIT", "REDUCE", "REBALANCE", "CLOSE"];
  const useSafetyMessage = constrainedActions.includes(result.recommendation.action);
  const healthMessage = result.recommendation.action === "REBALANCE"
    ? "Adjust the hedge before maintaining or increasing exposure."
    : result.recommendation.action === "REDUCE"
      ? "Reduce risk before continuing."
      : result.strategy_health === "critical" || result.recommendation.action === "CLOSE"
        ? "Risk requires adjustment before execution."
        : result.strategy_health === "healthy"
          ? "Current risk posture is within acceptable limits."
          : "Monitor the position and avoid increasing exposure.";
  return <section className="panel decision-card">
    <div className="assessment-main">
      <div className="assessment-heading"><span className="assessment-icon" aria-hidden="true">Δ</span><p className="decision-eyebrow">AI Assessment</p></div>
      <span className="decision-label">Recommended Action</span>
      <strong className={`action-value action-${result.recommendation.action.toLowerCase()}`}>{result.recommendation.action}</strong>
      <h2>{useSafetyMessage ? "The proposed strategy does not currently satisfy DeltaZero's minimum safety requirements." : result.recommendation.summary}</h2>
      {useSafetyMessage && <p className="recommendation-reason"><b>Recommendation reason</b>{result.recommendation.summary}</p>}
    </div>
    <div className="health-context">
      <div><span className="decision-label">Strategy Health</span><strong className={`health-value health-${result.strategy_health}`}>{result.strategy_health}</strong></div>
      <p>{healthMessage}</p>
    </div>
    <div className="decision-rationale">
      <span>Why this decision</span>
      <ul>{result.risk_notes.slice(0, 3).map((note) => <li key={note}>{note}</li>)}</ul>
    </div>
  </section>;
}

const structureIcons: Record<string, string> = {
  long_notional_usd: "↑",
  short_notional_usd: "↓",
  collateral_usd: "◇",
  target_hedge_ratio: "⚖",
};

const reportNames: Record<Mode, string> = {
  builder: "AI Strategy Report",
  auditor: "Position Risk Report",
  "stress-test": "Scenario Risk Report",
};

const reportSections: Record<Mode, string> = {
  builder: "Builder",
  auditor: "Auditor",
  "stress-test": "Stress Test",
};

function Result({ mode, result }: { mode: Mode; result: ResultValue }) {
  const withActions = result as AuditResponse | StressTestResponse;
  const build = result as BuildResponse;
  const stress = result as StressTestResponse;
  const displayedMetrics = mode === "stress-test" ? stress.scenario_result.stressed_metrics : result.metrics;
  return <div className="result-stack" aria-live="polite">
    <div className="report-breadcrumb" aria-label="Report location"><span>{reportSections[mode]}</span><i aria-hidden="true">/</i><strong>{reportNames[mode]}</strong></div>
    <Summary result={result} />
    <DecisionPanel result={result} />
    <SafetyBufferCard score={displayedMetrics.safety_buffer_score} />
    {mode === "builder" && <section className="panel"><h2 className="panel-title">Recommended structure</h2><div className="structure-grid">{Object.entries(build.recommended_structure).map(([key, value]) => <div className="structure-item" key={key}><div className="structure-label"><span aria-hidden="true">{structureIcons[key]}</span><label>{formatKey(key)}</label></div><strong>{key.includes("usd") ? usd(value) : value.toFixed(3)}</strong></div>)}</div></section>}
    {mode === "stress-test" && <section className="panel scenario-card"><div className="section-label-row"><h2 className="panel-title">Scenario impact</h2><span>Post-stress result</span></div><div className="structure-grid">{Object.entries(stress.scenario_result).filter(([key]) => !["stressed_metrics"].includes(key)).map(([key, value]) => <div className="structure-item" key={key}><label>{formatKey(key)}</label><strong>{typeof value === "number" ? (key.includes("usd") ? usd(value) : value) : String(value).replaceAll("_", " ")}</strong></div>)}</div></section>}
    <MetricsView metrics={displayedMetrics} />
    <div className="result-columns">
      {mode !== "builder" && <section className="panel corrective-actions"><h2 className="panel-title">Corrective actions</h2><p className="panel-copy">Ordered actions returned for this position.</p><div className="actions-row">{withActions.actions.map((action, index) => <span key={action}><b>{index + 1}</b>{action}</span>)}</div></section>}
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
