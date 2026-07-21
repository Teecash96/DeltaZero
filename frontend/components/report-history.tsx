"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearReportHistory,
  importStrategyRegistry,
  isStrategyRegistryEnabled,
  readReportHistory,
  setStrategyRegistryEnabled,
  updateStrategyOutcome,
  type ReportHistoryEntry,
  type StrategyOutcomeStatus,
} from "@/lib/report-history";

const pct = (value?: number) => value === undefined ? "—" : `${value.toFixed(1)}%`;

const OUTCOMES: Array<{ value: StrategyOutcomeStatus; label: string }> = [
  { value: "within_tolerance", label: "Stayed within tolerance" },
  { value: "avoided_loss", label: "Recommendation avoided loss" },
  { value: "exceeded_risk", label: "Risk exceeded expectation" },
  { value: "not_executed", label: "Recommendation not executed" },
  { value: "incomplete", label: "Observation incomplete" },
];

function summary(entry: ReportHistoryEntry) {
  return `DeltaZero ${entry.type === "risk_engine" ? "Risk Engine Pass" : "Monte Carlo Sensitivity"}\nAsset: ${entry.asset}\nRecommendation: ${entry.recommendation}\nP95 impairment: ${pct(entry.p95Impairment)}\nGenerated: ${new Date(entry.generatedAt).toLocaleString()}\n\nDecision support only; not a profit forecast.`;
}

function finiteOptional(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function OutcomeEditor({ entry }: { entry: ReportHistoryEntry }) {
  const [status, setStatus] = useState<StrategyOutcomeStatus>(entry.outcome?.status ?? "within_tolerance");
  const [realizedReturn, setRealizedReturn] = useState(entry.outcome?.realizedReturnPct?.toString() ?? "");
  const [drawdown, setDrawdown] = useState(entry.outcome?.maxDrawdownPct?.toString() ?? "");
  const [finalBuffer, setFinalBuffer] = useState(entry.outcome?.finalSafetyBuffer?.toString() ?? "");
  const [notes, setNotes] = useState(entry.outcome?.notes ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    updateStrategyOutcome(entry.id, {
      status,
      observedAt: new Date().toISOString(),
      realizedReturnPct: finiteOptional(realizedReturn),
      maxDrawdownPct: finiteOptional(drawdown),
      finalSafetyBuffer: finiteOptional(finalBuffer),
      notes: notes.trim() || undefined,
      source: "user_observed",
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <details className="registry-outcome-editor">
      <summary>{entry.outcome ? "Update observed outcome" : "Log observed outcome"}<span>＋</span></summary>
      <div className="registry-outcome-fields">
        <label><span>Outcome</span><select value={status} onChange={(event) => setStatus(event.target.value as StrategyOutcomeStatus)}>{OUTCOMES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label><span>Realized return (%)</span><input inputMode="decimal" value={realizedReturn} onChange={(event) => setRealizedReturn(event.target.value)} placeholder="Optional" /></label>
        <label><span>Maximum drawdown (%)</span><input inputMode="decimal" value={drawdown} onChange={(event) => setDrawdown(event.target.value)} placeholder="Optional" /></label>
        <label><span>Final Safety Buffer</span><input inputMode="decimal" value={finalBuffer} onChange={(event) => setFinalBuffer(event.target.value)} placeholder="Optional" /></label>
        <label className="registry-notes"><span>Observation notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="What happened after the recommendation?" /></label>
      </div>
      <button className="button button-primary" type="button" onClick={save}>{saved ? "Outcome saved" : "Save outcome"}</button>
    </details>
  );
}

export function ReportHistory() {
  const [entries, setEntries] = useState<ReportHistoryEntry[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => {
      setEntries(readReportHistory());
      setEnabled(isStrategyRegistryEnabled());
    };
    refresh();
    window.addEventListener("deltazero-history-updated", refresh);
    return () => window.removeEventListener("deltazero-history-updated", refresh);
  }, []);

  const insight = useMemo(() => {
    const observed = entries.filter((entry) => entry.outcome);
    const exceeded = observed.filter((entry) => entry.outcome?.status === "exceeded_risk").length;
    const drawdowns = observed.map((entry) => entry.outcome?.maxDrawdownPct).filter((value): value is number => value !== undefined);
    const averageDrawdown = drawdowns.length ? drawdowns.reduce((sum, value) => sum + value, 0) / drawdowns.length : undefined;
    return { observed: observed.length, exceeded, averageDrawdown };
  }, [entries]);

  function download(entry: ReportHistoryEntry) {
    const blob = new Blob([JSON.stringify(entry.payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `deltazero-${entry.type}-${entry.asset.toLowerCase()}-${entry.generatedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportRegistry() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `deltazero-strategy-registry-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importRegistry(file?: File) {
    if (!file) return;
    try {
      const count = importStrategyRegistry(JSON.parse(await file.text()));
      setMessage(`Imported ${count} registry ${count === 1 ? "entry" : "entries"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registry import failed.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (!enabled) {
    return (
      <div className="workspace history-workspace">
        <header className="page-intro"><div><p className="kicker">Opt-in agent memory</p><h1>Strategy Registry</h1><p>Connect recommendations with observed outcomes so agents can review where a policy held, where risk exceeded expectation, and what deserves investigation.</p></div><span className="endpoint">Local and portable</span></header>
        <section className="panel registry-consent">
          <span>Disabled by default</span>
          <h2>Enable private strategy memory</h2>
          <p>When enabled, completed Risk Engine and Monte Carlo reports are saved in this browser. You can add observed outcomes and export the registry as JSON. Nothing is uploaded to DeltaZero.</p>
          <ul><li>Explicit opt-in</li><li>Browser-local storage</li><li>Portable JSON export</li><li>No automatic threshold changes</li></ul>
          <button className="button button-primary" type="button" onClick={() => setStrategyRegistryEnabled(true)}>Enable Strategy Registry <span>→</span></button>
        </section>
      </div>
    );
  }

  return (
    <div className="workspace history-workspace">
      <header className="page-intro"><div><p className="kicker">Opt-in agent memory</p><h1>Strategy Registry</h1><p>Review prior recommendations, attach observed outcomes, and export a portable evidence trail for agent policy refinement.</p></div><span className="endpoint">Stored in this browser</span></header>
      <section className="panel history-notice"><strong>Observation—not silent retraining</strong><p>Outcome fields are user-supplied observations. DeltaZero summarizes them deterministically and never changes risk thresholds automatically. Validate data quality before using registry evidence to revise an agent policy.</p></section>

      <section className="registry-insight-grid" aria-label="Strategy Registry summary">
        <article><span>Saved decisions</span><strong>{entries.length}</strong><small>Maximum 25 in this browser</small></article>
        <article><span>Outcomes observed</span><strong>{insight.observed}</strong><small>{entries.length ? `${Math.round(insight.observed / entries.length * 100)}% coverage` : "No decisions recorded"}</small></article>
        <article><span>Risk exceeded</span><strong>{insight.exceeded}</strong><small>User-observed exceptions</small></article>
        <article><span>Average max drawdown</span><strong>{insight.averageDrawdown === undefined ? "—" : `${insight.averageDrawdown.toFixed(1)}%`}</strong><small>Observed entries with drawdown data</small></article>
      </section>

      <section className="panel registry-feedback-loop">
        <div><span>Decision</span><strong>Record the original recommendation and risk context.</strong></div><i>→</i><div><span>Outcome</span><strong>Attach what was observed after the decision.</strong></div><i>→</i><div><span>Refinement signal</span><strong>Identify recurring exceptions before changing policy.</strong></div>
      </section>

      <div className="registry-toolbar">
        <button className="button button-secondary" type="button" onClick={exportRegistry} disabled={!entries.length}>Export registry</button>
        <button className="button button-secondary" type="button" onClick={() => fileInput.current?.click()}>Import registry</button>
        <input ref={fileInput} className="registry-file-input" type="file" accept="application/json,.json" onChange={(event) => void importRegistry(event.target.files?.[0])} />
        <button className="button button-secondary" type="button" onClick={() => setStrategyRegistryEnabled(false)}>Disable memory</button>
        {message ? <span role="status">{message}</span> : null}
      </div>

      {entries.length ? <><div className="history-list">{entries.map((entry) => { const text = summary(entry); return <article className="panel history-card" key={entry.id}><div><span>{entry.type === "risk_engine" ? "Risk Engine Pass" : "Monte Carlo Sensitivity"}</span><h2>{entry.asset} · {entry.recommendation}</h2><p>{new Date(entry.generatedAt).toLocaleString()}</p>{entry.outcome ? <b className={`registry-outcome registry-outcome-${entry.outcome.status}`}>{OUTCOMES.find((item) => item.value === entry.outcome?.status)?.label}</b> : null}</div><div className="history-metrics"><span>P95 impairment <strong>{pct(entry.p95Impairment)}</strong></span>{entry.safetyBuffer !== undefined ? <span>Safety Buffer <strong>{entry.safetyBuffer.toFixed(1)}</strong></span> : null}</div><OutcomeEditor entry={entry} /><div className="history-actions"><a className="button button-secondary" href={`mailto:?subject=${encodeURIComponent(`DeltaZero ${entry.asset} risk alert`)}&body=${encodeURIComponent(text)}`}>Email snapshot</a><a className="button button-secondary" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent("https://delta-zero-alpha.vercel.app")}&text=${encodeURIComponent(text)}`}>Send to Telegram</a><button className="button button-secondary" onClick={() => download(entry)}>Export report</button></div></article>; })}</div><button className="button button-secondary history-clear" onClick={() => { clearReportHistory(); setEntries([]); }}>Clear registry entries</button></> : <section className="panel empty-state"><div><div className="empty-icon">↺</div><strong>No registered strategies yet</strong><p>Complete a Risk Engine Pass or Monte Carlo analysis. Because memory is enabled, DeltaZero will save the decision here for outcome tracking.</p></div></section>}
    </div>
  );
}
