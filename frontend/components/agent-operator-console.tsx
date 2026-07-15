"use client";

import { useEffect, useRef, useState } from "react";

import { PaymentRequiredError, runRiskEnginePass } from "@/lib/api";
import type { RiskTolerance, TargetStyle } from "@/lib/types";

type AgentState = "idle" | "monitoring" | "attention" | "stopped";
type LogTone = "neutral" | "positive" | "warning" | "critical";
type OperatorLog = { id: number; time: string; label: string; message: string; tone: LogTone };

const riskLevels: RiskTolerance[] = ["low", "medium", "high"];
const targetStyles: Array<{ value: TargetStyle; label: string; detail: string }> = [
  { value: "conservative_income", label: "Conservative Income", detail: "Tighter drift policy and larger safety reserve." },
  { value: "neutral_yield", label: "Neutral Yield", detail: "Balanced carry with near-neutral exposure." },
  { value: "aggressive_carry", label: "Aggressive Carry", detail: "Wider tolerance with higher capital deployment." },
  { value: "capital_preservation", label: "Capital Preservation", detail: "Strictest limits and defensive intervention." },
];

const thresholds: Record<RiskTolerance, number> = { low: 4, medium: 6, high: 8 };

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function challengeSummary(error: PaymentRequiredError) {
  const option = error.challenge?.accepts?.[0];
  if (!option) return "Protected API requested payment, but no readable payment option was returned.";
  return `Protected API requested ${option.amount ?? "an unspecified amount"} base units on ${option.network ?? "the configured network"}. No payment was made.`;
}

export function AgentOperatorConsole() {
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [targetStyle, setTargetStyle] = useState<TargetStyle>("neutral_yield");
  const [state, setState] = useState<AgentState>("idle");
  const [drift, setDrift] = useState(2.1);
  const [logs, setLogs] = useState<OperatorLog[]>([]);
  const [lastRecommendation, setLastRecommendation] = useState("Not evaluated");
  const [lastHeartbeat, setLastHeartbeat] = useState("—");
  const sequence = useRef(0);
  const auditStarted = useRef(false);

  function append(label: string, message: string, tone: LogTone = "neutral") {
    sequence.current += 1;
    setLogs((current) => [...current.slice(-39), { id: sequence.current, time: now(), label, message, tone }]);
  }

  useEffect(() => {
    if (state !== "monitoring") return;
    const timer = window.setInterval(() => {
      setLastHeartbeat(now());
      setDrift((current) => {
        const step = targetStyle === "aggressive_carry" ? 1.05 : targetStyle === "capital_preservation" ? .62 : .8;
        return Number(Math.min(current + step, 18).toFixed(2));
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [state, targetStyle]);

  useEffect(() => {
    if (state !== "monitoring" || drift < thresholds[riskTolerance] || auditStarted.current) return;
    auditStarted.current = true;
    setState("attention");
    append("DRIFT DETECTED", `Hedge drift reached ${drift.toFixed(1)}%, above the ${thresholds[riskTolerance]}% operator policy.`, "warning");
    append("API CALL", "Requesting the complete DeltaZero Risk Engine Pass.");

    void runRiskEnginePass({
      asset: "SOL",
      capital_usd: 7000,
      risk_tolerance: riskTolerance,
      target_style: targetStyle,
      long_yield_apy: 14,
      short_funding_apy: 3,
      fee_drag_apy: 1,
    }).then((report) => {
      const audit = report.hedge_drift_audit;
      setLastRecommendation(audit.recommendation.action);
      append("PASS COMPLETE", `Four coordinated reports generated. Hedge verdict: ${audit.recommendation.action}.`, audit.recommendation.action === "HOLD" ? "positive" : "warning");
      append("SIMULATION READY", "A proposal-only SOL perpetual hedge intent was generated. Venue broadcast remains disabled until a compatible adapter is configured.", "neutral");
    }).catch((error: unknown) => {
      if (error instanceof PaymentRequiredError) {
        setLastRecommendation("Payment required");
        append("PAYMENT REQUIRED", `Premium risk analysis required — unlock the complete four-module assessment for 1 USDT. ${challengeSummary(error)}`, "warning");
        append("AGENT PAUSED", "Open demo access for recording, or complete payment through an Agentic Wallet client. The browser did not sign or transfer funds.", "neutral");
      } else {
        append("HEDGE CHECK FAILED", error instanceof Error ? error.message : "The hedge-drift analysis could not be completed.", "critical");
      }
    });
  }, [drift, riskTolerance, state, targetStyle]);

  function spawn() {
    auditStarted.current = false;
    setDrift(2.1);
    setLastRecommendation("Monitoring");
    setLastHeartbeat(now());
    setLogs([]);
    setState("monitoring");
    sessionStorage.setItem("deltazero-guard-policy", JSON.stringify({ riskTolerance, targetStyle }));
    window.setTimeout(() => append("AGENT ACTIVE", `DeltaZero Guard started in transparent simulation mode with ${riskTolerance} risk tolerance.`), 0);
    window.setTimeout(() => append("POLICY LOADED", `${targetStyles.find((style) => style.value === targetStyle)?.label} · intervention at ${thresholds[riskTolerance]}% hedge drift.`), 120);
    window.setTimeout(() => append("MONITORING", "Scanning the simulated SOL neutral-carry position. No wallet permissions or trading authority granted."), 240);
  }

  function stop() {
    setState("stopped");
    append("AGENT STOPPED", "Monitoring stopped. No funds moved and no transaction was broadcast.");
  }

  const activeStyle = targetStyles.find((style) => style.value === targetStyle)!;

  return (
    <div className="workspace agent-console">
      <header className="page-intro">
        <div><p className="kicker">Agent Operator Console</p><h1>Set the policy. Let the guard monitor.</h1><p>Configure a transparent DeltaZero Guard that detects hedge drift, calls the paid risk API, and prepares an approval-gated response.</p></div>
        <span className="endpoint">SIMULATION + LIVE API</span>
      </header>

      <section className="agent-console-status panel">
        <div><span>Guard status</span><strong className={`agent-state-${state}`}>{state}</strong></div>
        <div><span>Current drift</span><strong>{drift.toFixed(1)}%</strong></div>
        <div><span>Intervention boundary</span><strong>{thresholds[riskTolerance].toFixed(1)}%</strong></div>
        <div><span>Last recommendation</span><strong>{lastRecommendation}</strong></div>
        <div><span>Heartbeat</span><strong>{lastHeartbeat}</strong></div>
      </section>

      <div className="agent-console-grid">
        <section className="panel agent-policy-panel">
          <div className="section-label-row"><div><span className="decision-eyebrow">Guard policy</span><h2 className="panel-title">Configure monitoring</h2></div><span>Session only</span></div>
          <div className="agent-risk-control">
            <label htmlFor="agent-risk">Risk tolerance</label>
            <input id="agent-risk" type="range" min="0" max="2" step="1" value={riskLevels.indexOf(riskTolerance)} onChange={(event) => setRiskTolerance(riskLevels[Number(event.target.value)])} disabled={state === "monitoring"} />
            <div>{riskLevels.map((level) => <span className={level === riskTolerance ? "active" : ""} key={level}>{level}</span>)}</div>
          </div>
          <div className="agent-style-control">
            <span>Target style</span>
            <div>{targetStyles.map((style) => <button type="button" className={style.value === targetStyle ? "active" : ""} key={style.value} onClick={() => setTargetStyle(style.value)} disabled={state === "monitoring"}><strong>{style.label}</strong><small>{style.detail}</small></button>)}</div>
          </div>
          <div className="agent-policy-summary">
            <span>Selected mandate</span><strong>{activeStyle.label}</strong><p>{activeStyle.detail} DeltaZero pauses at payment and execution gates unless a separately authorized client completes them.</p>
          </div>
          <div className="agent-console-actions">
            <button className="button button-primary" type="button" onClick={spawn} disabled={state === "monitoring"}>Spawn DeltaZero Guard <span>→</span></button>
            <button className="button button-secondary" type="button" onClick={stop} disabled={state === "idle" || state === "stopped"}>Stop Agent</button>
          </div>
        </section>

        <section className="panel agent-terminal-panel">
          <div className="agent-terminal-head"><div><i className={state === "monitoring" ? "active" : ""} /><span>DeltaZero Guard / operator stream</span></div><small>TRANSPARENT SIMULATION</small></div>
          <div className="agent-terminal" aria-live="polite" aria-label="Agent operator log">
            {logs.length === 0 ? <div className="agent-terminal-empty"><strong>Agent is offline</strong><p>Choose a mandate and spawn the guard to begin monitoring.</p></div> : logs.map((log) => <article className={`log-${log.tone}`} key={log.id}><time>{log.time}</time><strong>[{log.label}]</strong><p>{log.message}</p></article>)}
          </div>
          <div className="agent-terminal-footer"><span>Execution authority</span><strong>Not granted</strong><span>Wallet access</span><strong>None</strong></div>
        </section>
      </div>

      <section className="panel agent-safety-strip">
        <article><span>01</span><strong>Detect</strong><p>Monitor drift against a visible policy boundary.</p></article>
        <article><span>02</span><strong>Pay or pause</strong><p>Never fabricate settlement or silently bypass x402.</p></article>
        <article><span>03</span><strong>Simulate</strong><p>Generate a proposal and measure its effect before approval.</p></article>
        <article><span>04</span><strong>Approve</strong><p>Require explicit user or policy authority before execution.</p></article>
        <article><span>05</span><strong>Verify</strong><p>Recheck hedge drift after an authorized adapter reports completion.</p></article>
      </section>
    </div>
  );
}
