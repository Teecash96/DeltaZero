"use client";

import { useEffect, useState } from "react";

import { clearReportHistory, readReportHistory, type ReportHistoryEntry } from "@/lib/report-history";

const pct = (value?: number) => value === undefined ? "—" : `${value.toFixed(1)}%`;

function summary(entry: ReportHistoryEntry) {
  return `DeltaZero ${entry.type === "risk_engine" ? "Risk Engine Pass" : "Monte Carlo Sensitivity"}\nAsset: ${entry.asset}\nRecommendation: ${entry.recommendation}\nP95 impairment: ${pct(entry.p95Impairment)}\nGenerated: ${new Date(entry.generatedAt).toLocaleString()}\n\nDecision support only; not a profit forecast.`;
}

export function ReportHistory() {
  const [entries, setEntries] = useState<ReportHistoryEntry[]>([]);
  useEffect(() => {
    const refresh = () => setEntries(readReportHistory());
    refresh();
    window.addEventListener("deltazero-history-updated", refresh);
    return () => window.removeEventListener("deltazero-history-updated", refresh);
  }, []);

  function download(entry: ReportHistoryEntry) {
    const blob = new Blob([JSON.stringify(entry.payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `deltazero-${entry.type}-${entry.asset.toLowerCase()}-${entry.generatedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="workspace history-workspace"><header className="page-intro"><div><p className="kicker">Local monitoring record</p><h1>Risk Report History</h1><p>Review completed analyses and send a risk snapshot to email or Telegram without leaving a report tab open.</p></div><span className="endpoint">Stored in this browser</span></header><section className="panel history-notice"><strong>What this does—and does not do</strong><p>DeltaZero stores up to 25 completed reports locally. Email and Telegram actions share the latest computed snapshot. Continuous background monitoring still requires a server-side scheduler and notification subscription.</p></section>{entries.length ? <><div className="history-list">{entries.map((entry) => { const text = summary(entry); return <article className="panel history-card" key={entry.id}><div><span>{entry.type === "risk_engine" ? "Risk Engine Pass" : "Monte Carlo Sensitivity"}</span><h2>{entry.asset} · {entry.recommendation}</h2><p>{new Date(entry.generatedAt).toLocaleString()}</p></div><div className="history-metrics"><span>P95 impairment <strong>{pct(entry.p95Impairment)}</strong></span>{entry.safetyBuffer !== undefined ? <span>Safety Buffer <strong>{entry.safetyBuffer.toFixed(1)}</strong></span> : null}</div><div className="history-actions"><a className="button button-secondary" href={`mailto:?subject=${encodeURIComponent(`DeltaZero ${entry.asset} risk alert`)}&body=${encodeURIComponent(text)}`}>Email snapshot</a><a className="button button-secondary" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent("https://delta-zero-alpha.vercel.app")}&text=${encodeURIComponent(text)}`}>Send to Telegram</a><button className="button button-secondary" onClick={() => download(entry)}>Export JSON</button></div></article>; })}</div><button className="button button-secondary history-clear" onClick={() => { clearReportHistory(); setEntries([]); }}>Clear report history</button></> : <section className="panel empty-state"><div><div className="empty-icon">↺</div><strong>No saved reports yet</strong><p>Complete a Risk Engine Pass or Monte Carlo analysis. DeltaZero will save the result here in this browser.</p></div></section>}</div>;
}
