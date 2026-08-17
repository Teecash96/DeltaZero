"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isStrategyRegistryEnabled, readReportHistory, type ReportHistoryEntry } from "@/lib/report-history";
import styles from "./marketplace.module.css";

export function WorkspaceStatus({ mode }: { mode: "portfolio" | "activity" }) {
  const [entries, setEntries] = useState<ReportHistoryEntry[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const refresh = () => { setEntries(readReportHistory()); setEnabled(isStrategyRegistryEnabled()); };
    refresh();
    window.addEventListener("deltazero-history-updated", refresh);
    return () => window.removeEventListener("deltazero-history-updated", refresh);
  }, []);

  const isPortfolio = mode === "portfolio";
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>{isPortfolio ? "Operator workspace" : "Operator activity"}</p><h1>{isPortfolio ? "My Agents" : "Activity"}</h1><p>{isPortfolio ? "A truthful view of hired agents and their latest Risk Guard state. No positions are invented when no job is connected." : "Review locally recorded analysis runs, payment events, and alerts without confusing them with marketplace settlement."}</p></div><span className={styles.headerBadge}>{enabled ? "Local memory on" : "No local records"}</span></header>
    {!enabled ? <section className={styles.empty}><h2>No connected workspace yet</h2><p>Enable Strategy Registry after a real analysis to record reports in this browser. DeltaZero does not fabricate hired agents, jobs, balances, or payment history.</p><Link className={styles.primaryCta} href="/registry">Open Strategy Registry →</Link></section> : entries.length === 0 ? <section className={styles.empty}><h2>No activity recorded</h2><p>Run a live verified workflow and opt in to local memory. The workspace will show the result only after the browser records it.</p><Link className={styles.primaryCta} href="/risk-engine">Launch Risk Engine →</Link></section> : <section className={styles.workspaceList} aria-label={isPortfolio ? "My agents" : "Activity records"}>{entries.map((entry) => <article className={styles.workspaceItem} key={entry.id}><div><p className={styles.eyebrow}>{entry.type === "risk_engine" ? "Risk Engine" : "Monte Carlo"} · {entry.asset}</p><h2>{entry.recommendation}</h2><p>Recorded {new Date(entry.generatedAt).toLocaleString()}</p></div><span className={styles.statusPill}>{entry.outcome?.status ?? "Awaiting outcome"}</span></article>)}</section>}
  </div>;
}
