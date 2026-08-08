"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PaymentRequiredError, probeMcpRiskEngine, runRiskEnginePass, type McpProbeResult } from "@/lib/api";
import type { RiskTolerance, TargetStyle } from "@/lib/types";

/* ─── Types ─────────────────────────────────────────────────────────── */

type AgentPhase = "idle" | "running" | "done" | "stopped";
type StepStatus = "pending" | "active" | "success" | "error" | "skipped";

type PipelineStep = {
  id: string;
  label: string;
  detail: string;
  status: StepStatus;
  meta?: string;
};

type LogTone = "neutral" | "positive" | "warning" | "critical";
type TerminalLine = { id: number; time: string; text: string; tone: LogTone };
type PaymentDisplayState = "simulation" | "challenge";

/* ─── Constants ─────────────────────────────────────────────────────── */

const riskLevels: RiskTolerance[] = ["low", "medium", "high"];
const targetStyles: Array<{ value: TargetStyle; label: string; detail: string }> = [
  { value: "conservative_income", label: "Conservative Income", detail: "Tighter drift policy and larger safety reserve." },
  { value: "neutral_yield", label: "Neutral Yield", detail: "Balanced carry with near-neutral exposure." },
  { value: "aggressive_carry", label: "Aggressive Carry", detail: "Wider tolerance with higher capital deployment." },
  { value: "capital_preservation", label: "Capital Preservation", detail: "Strictest limits and defensive intervention." },
];
const thresholds: Record<RiskTolerance, number> = { low: 4, medium: 6, high: 8 };

const INITIAL_STEPS: PipelineStep[] = [
  { id: "scan", label: "Scanning simulated wallet", detail: "Reading SOL neutral-carry position…", status: "pending" },
  { id: "drift", label: "Evaluating hedge drift", detail: "Computing net delta against policy boundary…", status: "pending" },
  { id: "api", label: "Calling Risk Engine API", detail: "REST /risk-engine/analyze · demo response", status: "pending" },
  { id: "payment", label: "x402 payment boundary", detail: "402 challenge · no browser settlement", status: "pending" },
  { id: "verdict", label: "Simulated recommendation", detail: "Awaiting engine verdict…", status: "pending" },
];

/* ─── Helpers ───────────────────────────────────────────────────────── */

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

let lineSeq = 0;
function line(text: string, tone: LogTone = "neutral"): TerminalLine {
  return { id: ++lineSeq, time: now(), text, tone };
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function AgentOperatorConsole() {
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [targetStyle, setTargetStyle] = useState<TargetStyle>("neutral_yield");
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [drift, setDrift] = useState(0.4);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentDisplayState>("simulation");
  const [mcpProbe, setMcpProbe] = useState<McpProbeResult | null>(null);
  const [mcpProbeLoading, setMcpProbeLoading] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const driftTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const breachFired = useRef(false);

  const pushLine = useCallback((text: string, tone: LogTone = "neutral") => {
    setTerminal((prev) => [...prev.slice(-60), line(text, tone)]);
  }, []);

  const setStep = useCallback((id: string, patch: Partial<PipelineStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /* Auto-scroll terminal */
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminal]);

  /* Drift simulation loop */
  useEffect(() => {
    if (phase !== "running") return;
    driftTimer.current = setInterval(() => {
      setDrift((d) => {
        const step = targetStyle === "aggressive_carry" ? 1.1 : targetStyle === "capital_preservation" ? 0.6 : 0.82;
        return Number(Math.min(d + step, 18).toFixed(2));
      });
    }, 1400);
    return () => { if (driftTimer.current) clearInterval(driftTimer.current); };
  }, [phase, targetStyle]);

  /* Breach detection → run the pipeline */
  useEffect(() => {
    if (phase !== "running" || drift < thresholds[riskTolerance] || breachFired.current) return;
    breachFired.current = true;
    if (driftTimer.current) clearInterval(driftTimer.current);

    // Step 1: Scan complete
    setStep("scan", { status: "success", detail: `Wallet 0x7a3F…c91e · SOL-PERP + Aave USDC` });
    pushLine("Wallet scan complete. Positions: SOL-PERP Δ+0.82, Aave USDC collateral.", "positive");

    // Step 2: Drift breach
    setTimeout(() => {
      setStep("drift", { status: "error", detail: `Net Delta: ${drift.toFixed(2)}% — BREACH (limit ${thresholds[riskTolerance]}%)` });
      pushLine(`⚠ HEDGE DRIFT BREACH — Net Delta ${drift.toFixed(2)}% exceeds ${thresholds[riskTolerance]}% policy boundary.`, "warning");
    }, 600);

    // Step 3: API call
    setTimeout(() => {
      setStep("api", { status: "active", detail: "REST /risk-engine/analyze · simulation …" });
      pushLine("Running the deterministic Risk Engine simulation (REST fallback)…", "neutral");

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
        const action = audit.recommendation.action;
        setStep("api", { status: "success", detail: "4 reports · 200 OK · 1.2s" });
        pushLine(`Risk Engine responded: strategy_build + hedge_drift_audit + funding_stress + monte_carlo.`, "positive");

        // This browser loop is intentionally a simulation. A successful REST
        // response is not evidence of a payment or an on-chain settlement.
        setTimeout(() => {
          setStep("payment", { status: "skipped", detail: "Simulation only · no settlement", meta: "NO PAYMENT" });
          pushLine("Simulation response received. No payment or receipt was created in this browser loop.", "neutral");

          // Step 5: Verdict
          setTimeout(() => {
            const isHold = action === "HOLD";
            setStep("verdict", {
              status: isHold ? "success" : "error",
              detail: `${action} — Safety Buffer ${report.strategy_build?.metrics?.safety_buffer_score?.toFixed(1) ?? "N/A"}`,
            });
            setRecommendation(action);
            pushLine(`■ VERDICT: ${action}. Agent loop complete. No funds moved.`, isHold ? "positive" : "warning");
            setPhase("done");
          }, 700);
        }, 500);
      }).catch((error: unknown) => {
        if (error instanceof PaymentRequiredError) {
          const opt = error.challenge?.accepts?.[0];
          const amt = opt?.amount ? `${Number(opt.amount) / 1e6} USDT` : "1 USDT";
          const net = opt?.network ?? "eip155:196";
          setPaymentState("challenge");
          setStep("api", { status: "success", detail: "402 → x402 challenge received" });
          setStep("payment", { status: "error", detail: `${amt} · ${net} · compatible client required`, meta: "402" });
          setStep("verdict", { status: "skipped", detail: "Awaiting paid replay from an agent client" });
          pushLine(`x402 challenge received: ${amt} on ${net}. No browser payment was attempted.`, "warning");
          pushLine("Use POST /mcp with delta_zero_risk_engine from a compatible agent payment client.", "neutral");
          setPhase("done");
        } else {
          setStep("api", { status: "error", detail: error instanceof Error ? error.message : "Request failed" });
          pushLine(`API ERROR: ${error instanceof Error ? error.message : "Unknown failure"}`, "critical");
          setPhase("done");
        }
      });
    }, 1200);
  }, [drift, phase, riskTolerance, targetStyle, pushLine, setStep]);

  /* Spawn / Stop */
  function spawn() {
    breachFired.current = false;
    lineSeq = 0;
    setDrift(0.4);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setTerminal([]);
    setRecommendation(null);
    setPaymentState("simulation");
    setPhase("running");
    setStep("scan", { status: "active" });
    pushLine("DeltaZero Guard spawned. Simulation mode — no wallet permissions granted.", "neutral");
    pushLine(`Policy: ${targetStyles.find((s) => s.value === targetStyle)?.label} · breach at ${thresholds[riskTolerance]}% drift.`, "neutral");
    pushLine("Scanning simulated wallet 0x7a3F…c91e …", "neutral");

    setTimeout(() => {
      setStep("drift", { status: "active", detail: "Monitoring net delta…" });
    }, 800);
  }

  function stop() {
    if (driftTimer.current) clearInterval(driftTimer.current);
    setPhase("stopped");
    pushLine("Agent stopped. No funds moved. No transaction broadcast.", "neutral");
  }

  async function probeMcp() {
    setMcpProbeLoading(true);
    const result = await probeMcpRiskEngine();
    setMcpProbe(result);
    setMcpProbeLoading(false);
    if (result.status === "challenge") {
      pushLine("Live MCP probe: HTTP 402 challenge received. No payment attempted.", "positive");
    } else if (result.status === "ok") {
      pushLine("Live MCP probe: HTTP 200 response received from the canonical tool.", "positive");
    } else {
      pushLine(`Live MCP probe failed: ${result.detail ?? "unknown error"}`, "critical");
    }
  }

  const driftPct = Math.min((drift / (thresholds[riskTolerance] * 1.6)) * 100, 100);
  const breached = drift >= thresholds[riskTolerance];

  return (
    <div className="workspace agent-console">
      <header className="page-intro">
        <div>
          <p className="kicker">Agent-in-a-Box</p>
          <h1>Watch the agent loop run.</h1>
          <p>A safe simulation of the agent loop. The live MCP probe verifies the canonical endpoint, while this browser never signs or settles a payment.</p>
        </div>
        <span className="endpoint">SIMULATION + LIVE MCP</span>
      </header>

      {/* ─── Pipeline + Terminal Grid ─────────────────────────────── */}
      <div className="agent-pipeline-grid">
        {/* Left: Step Pipeline */}
        <section className="panel agent-pipeline-panel">
          <div className="pipeline-header">
            <div className="pipeline-title-row">
              <span className={`pipeline-dot ${phase === "running" ? "pulse" : phase === "done" ? "done" : ""}`} />
              <h2>Agent Loop</h2>
            </div>
            <span className="pipeline-phase">{phase === "idle" ? "STANDBY" : phase === "running" ? "EXECUTING" : phase === "done" ? "COMPLETE" : "HALTED"}</span>
          </div>

          <ol className="pipeline-steps">
            {steps.map((step, i) => (
              <li key={step.id} className={`pipeline-step step-${step.status}`}>
                <div className="step-indicator">
                  <span className="step-number">{i + 1}</span>
                  <span className="step-icon">
                    {step.status === "active" && <span className="spinner" />}
                    {step.status === "success" && "✓"}
                    {step.status === "error" && "!"}
                    {step.status === "pending" && "·"}
                    {step.status === "skipped" && "—"}
                  </span>
                </div>
                <div className="step-content">
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                  {step.meta && <span className="step-meta">{step.meta}</span>}
                </div>
                {i < steps.length - 1 && <span className={`step-connector ${step.status === "success" ? "lit" : ""}`} />}
              </li>
            ))}
          </ol>

          {/* Drift Gauge */}
          <div className="drift-gauge">
            <div className="drift-gauge-header">
              <span>Net Delta</span>
              <strong className={breached ? "breached" : ""}>{drift.toFixed(2)}%</strong>
            </div>
            <div className="drift-bar">
              <div className="drift-fill" style={{ width: `${driftPct}%` }} data-breached={breached} />
              <div className="drift-threshold" style={{ left: `${(thresholds[riskTolerance] / (thresholds[riskTolerance] * 1.6)) * 100}%` }}>
                <span>{thresholds[riskTolerance]}%</span>
              </div>
            </div>
          </div>

          {/* Recommendation Badge */}
          {recommendation && (
            <div className={`verdict-badge verdict-${recommendation.toLowerCase()}`}>
              <span>Recommendation</span>
              <strong>{recommendation}</strong>
            </div>
          )}
        </section>

        {/* Right: Terminal Feed */}
        <section className="panel agent-terminal-panel">
          <div className="agent-terminal-head">
            <div>
              <i className={phase === "running" ? "active" : ""} />
              <span>operator stream</span>
            </div>
            <small>MCP · x402 · RISK ENGINE</small>
          </div>
          <div className="agent-terminal" ref={terminalRef} aria-live="polite" aria-label="Agent operator log">
            {terminal.length === 0 ? (
              <div className="agent-terminal-empty">
                <div className="terminal-idle-art">
                  <span>┌─────────────────────────┐</span>
                  <span>│&nbsp;&nbsp;SIMULATION IDLE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│</span>
                  <span>│&nbsp;&nbsp;spawn to begin loop&nbsp;&nbsp;&nbsp;│</span>
                  <span>└─────────────────────────┘</span>
                </div>
              </div>
            ) : (
              terminal.map((l) => (
                <div key={l.id} className={`term-line tone-${l.tone}`}>
                  <time>{l.time}</time>
                  <span>{l.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="agent-terminal-footer">
            <span>Execution authority</span><strong>Not granted</strong>
            <span>Wallet access</span><strong>None</strong>
            <span>Payment</span><strong>{paymentState === "challenge" ? "402 challenge" : "Simulation only"}</strong>
          </div>
        </section>
      </div>

      <section className="panel agent-mcp-probe" aria-labelledby="agent-mcp-probe-title">
        <div>
          <span className="decision-eyebrow">Live transport check</span>
          <h2 id="agent-mcp-probe-title" className="panel-title">Verify the canonical MCP boundary.</h2>
          <p>Probe the production `/mcp` endpoint with the `delta_zero_risk_engine` JSON-RPC tool. This verifies reachability and the x402 challenge without attempting a browser payment.</p>
          <code>POST /mcp · tools/call · delta_zero_risk_engine</code>
        </div>
        <div className="agent-mcp-probe-actions">
          <button className="button button-secondary" type="button" onClick={() => void probeMcp()} disabled={mcpProbeLoading}>
            {mcpProbeLoading ? "Probing MCP…" : "Probe live MCP"} <span>↗</span>
          </button>
          {mcpProbe && (
            <div className={`agent-mcp-probe-result probe-${mcpProbe.status}`} role="status">
              <strong>{mcpProbe.status === "challenge" ? "HTTP 402 challenge received" : mcpProbe.status === "ok" ? "HTTP 200 response received" : "MCP probe failed"}</strong>
              <span>{mcpProbe.detail}</span>
            </div>
          )}
        </div>
      </section>

      {/* ─── Policy Config ────────────────────────────────────────── */}
      <section className="panel agent-policy-panel">
        <div className="policy-inner">
          <div className="policy-config">
            <div className="section-label-row">
              <div><span className="decision-eyebrow">Guard policy</span><h2 className="panel-title">Configure the loop</h2></div>
            </div>
            <div className="agent-risk-control">
              <label htmlFor="agent-risk">Risk tolerance</label>
              <input id="agent-risk" type="range" min="0" max="2" step="1" value={riskLevels.indexOf(riskTolerance)} onChange={(e) => setRiskTolerance(riskLevels[Number(e.target.value)])} disabled={phase === "running"} />
              <div>{riskLevels.map((level) => <span className={level === riskTolerance ? "active" : ""} key={level}>{level}</span>)}</div>
            </div>
            <div className="agent-style-control">
              <span>Target style</span>
              <div>{targetStyles.map((style) => (
                <button type="button" className={style.value === targetStyle ? "active" : ""} key={style.value} onClick={() => setTargetStyle(style.value)} disabled={phase === "running"}>
                  <strong>{style.label}</strong><small>{style.detail}</small>
                </button>
              ))}</div>
            </div>
          </div>
          <div className="policy-actions">
            <button className="button button-primary button-spawn" type="button" onClick={spawn} disabled={phase === "running"}>
              <span className="btn-icon">▶</span> {phase === "idle" ? "Spawn Agent" : phase === "done" || phase === "stopped" ? "Run Again" : "Running…"}
            </button>
            <button className="button button-secondary" type="button" onClick={stop} disabled={phase === "idle" || phase === "stopped" || phase === "done"}>
              ■ Stop
            </button>
          </div>
        </div>
      </section>

      {/* ─── Proof Strip ──────────────────────────────────────────── */}
      <section className="agent-proof-strip">
        <article><span>MCP</span><strong>POST /mcp</strong><p>delta_zero_risk_engine · 10 tools</p></article>
        <article><span>x402</span><strong>HTTP 402</strong><p>Browser probe only · no settlement</p></article>
        <article><span>ENGINE</span><strong>4 Reports</strong><p>Strategy · Audit · Stress · Monte Carlo</p></article>
        <article><span>AGENT</span><strong>Guarded simulation</strong><p>Detect → Challenge → Recommend</p></article>
      </section>
    </div>
  );
}
