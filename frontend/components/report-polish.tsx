"use client";

import { useEffect, useMemo, useState } from "react";

import type { X402Challenge, X402PaymentOption } from "@/lib/api";

function paymentPrice(option: X402PaymentOption | undefined) {
  if (!option?.amount) return "Unavailable";
  const decimals = option.extra?.decimals;
  const name = option.extra?.name;
  const stablecoin = typeof name === "string" && name.toUpperCase().startsWith("USD");
  const displayDecimals = typeof decimals === "number" ? decimals : stablecoin ? 6 : null;
  if (displayDecimals !== null && /^\d+$/.test(option.amount)) {
    const numeric = Number(option.amount) / 10 ** displayDecimals;
    if (Number.isFinite(numeric)) return `${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: displayDecimals })}${stablecoin ? " USDT" : ""}`;
  }
  return "Unavailable";
}

function networkName(network: string | undefined) {
  return network === "eip155:196" ? "X Layer" : network ?? "Unavailable";
}

function shortAddress(address: string | undefined) {
  return address && address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-5)}` : address ?? "Unavailable";
}

export function PaymentRequiredCard({ challenge, retry, loading }: { challenge: X402Challenge | null; retry: () => void; loading: boolean }) {
  const option = challenge?.accepts?.[0];
  const [copyFeedback, setCopyFeedback] = useState(false);
  const details = [["Cost", paymentPrice(option)], ["Network", networkName(option?.network)], ["Receiver", shortAddress(option?.payTo)], ["Verification", "Automatic"]];
  async function copyReceiver() {
    if (!option?.payTo) return;
    try {
      await navigator.clipboard.writeText(option.payTo);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1800);
    } catch {
      setCopyFeedback(false);
    }
  }
  return (
    <div className="payment-unlock-stack">
      <section className="panel payment-required-card" role="alert" aria-labelledby="payment-required-title">
        <span className="payment-required-icon" aria-hidden="true">◇</span>
        <div className="payment-required-copy">
          <span className="decision-eyebrow">Premium analysis</span>
          <h2 id="payment-required-title">Unlock Premium Strategy Analysis</h2>
          <p>This analysis is protected by the OKX x402 payment protocol. A one time payment unlocks the deterministic strategy computation. DeltaZero never requests wallet signatures, approvals, or private keys.</p>
          {challenge ? <dl className="payment-required-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}{label === "Receiver" ? <button type="button" onClick={() => void copyReceiver()} aria-label="Copy receiver address">{copyFeedback ? "Copied" : "Copy"}</button> : null}</dd></div>)}</dl> : <p className="payment-required-missing">Protected endpoint returned HTTP 402.</p>}
          <button className="button button-primary payment-verify" type="button" onClick={retry} disabled={loading}>{loading ? "Verifying..." : "Verify Payment"}</button>
          <small>Payment is verified automatically by the protected endpoint.</small>
        </div>
      </section>
      <section className="panel payment-trust-panel" aria-labelledby="payment-trust-title">
        <div><span className="decision-eyebrow">Security model</span><h2 id="payment-trust-title">Why DeltaZero is Safe</h2></div>
        <div className="payment-trust-grid">
          {[["◉", "Read Only", "Analysis reads submitted and public data without changing positions."], ["⊘", "No Signatures", "DeltaZero never asks you to sign a wallet message."], ["◇", "No Wallet Control", "No approvals, custody, or transaction permissions are requested."], ["≡", "Deterministic Analysis", "The same inputs produce the same transparent risk output."]].map(([icon, title, copy]) => <article key={title}><i aria-hidden="true">{icon}</i><strong>{title}</strong><p>{copy}</p></article>)}
        </div>
      </section>
    </div>
  );
}

export function recommendationLabel(action: string | undefined) {
  if (action === "PROCEED" || action === "OPEN" || action === "HOLD") return "Proceed";
  if (action === "ADJUST" || action === "WAIT" || action === "REBALANCE") return "Adjust";
  return "Avoid";
}

function verdictRisk(health: string | null | undefined) {
  if (health === "critical") return "Critical";
  if (health === "fragile") return "High";
  if (health === "warning" || health === "watch") return "Medium";
  return "Low";
}

function verdictSafety(score: number) {
  if (score >= 70) return "Healthy";
  if (score >= 60) return "Watch";
  return "Weak";
}

function verdictHorizon(action: string | undefined) {
  if (action === "AVOID" || action === "CLOSE" || action === "REDUCE") return "Immediate";
  if (action === "ADJUST" || action === "REBALANCE" || action === "WAIT") return "Short Term";
  if (action === "HOLD") return "Medium Term";
  return "Long Term";
}

function verdictActionCopy(action: string | undefined) {
  if (action === "PROCEED" || action === "OPEN" || action === "HOLD") return "Current hedge quality meets the preferred safety threshold.";
  if (action === "ADJUST" || action === "WAIT" || action === "REBALANCE") return "Risk is elevated and exposure should be improved before deployment.";
  return "Current portfolio conditions exceed DeltaZero safety thresholds.";
}

function AnimatedValue({ value, suffix = "", digits = 0 }: { value: number; suffix?: string; digits?: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reducedFrame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(reducedFrame);
    }
    const started = performance.now();
    const duration = 420;
    let frame = 0;
    const update = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      setDisplay(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toFixed(digits)}{suffix}</>;
}

export function DeltaZeroVerdict({ health, action, confidence, safetyBuffer }: { health: string | null | undefined; action: string | undefined; confidence: number; safetyBuffer: number | null | undefined }) {
  const risk = verdictRisk(health);
  const score = safetyBuffer ?? 0;
  const normalizedConfidence = Math.max(0, Math.min(100, confidence));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <section className={`panel verdict-hero verdict-risk-${risk.toLowerCase()}`} aria-labelledby="deltazero-verdict-title">
      <div className="verdict-heading"><span>DELTAZERO VERDICT</span><small>Deterministic report summary</small></div>
      <div className="verdict-grid">
        <article className="verdict-risk-card"><span>Risk Level</span><strong id="deltazero-verdict-title">{risk}</strong><small>Current evaluated risk posture</small></article>
        <article><span>Recommended Action</span><strong className={`verdict-action action-${action?.toLowerCase()}`}>{recommendationLabel(action)}</strong><small>{verdictActionCopy(action)}</small></article>
        <article className="verdict-confidence" title="Confidence reflects model certainty and data completeness. It does not predict profitability."><span>Analysis Confidence</span><div><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r={radius} /><circle className="verdict-ring-value" cx="40" cy="40" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - normalizedConfidence / 100)} /></svg><strong><AnimatedValue value={normalizedConfidence} suffix="%" /></strong></div><b>{normalizedConfidence >= 80 ? "High" : normalizedConfidence >= 60 ? "Moderate" : "Low"}</b><small>Confidence reflects model certainty and data completeness. It does not predict profitability.</small></article>
        <article><span>Safety Buffer</span><strong><AnimatedValue value={score} digits={1} /></strong><b>{verdictSafety(score)}</b><small>Existing portfolio resilience score</small></article>
        <article><span>Time Horizon</span><strong>{verdictHorizon(action)}</strong><small>Priority inferred from recommendation severity</small></article>
      </div>
    </section>
  );
}

export function AnalysisConfidence({ value }: { value: number }) {
  const score = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const level = score >= 80 ? "High" : score >= 60 ? "Moderate" : "Low";
  return <div className="analysis-confidence" title="Confidence measures data completeness and model certainty. It does not predict profitability."><div><span>Analysis Confidence</span><strong>{score.toFixed(0)}%</strong><b>{level}</b></div><ConfidenceBar value={score} label="Analysis confidence" /><small>Confidence measures data completeness and model certainty. It does not predict profitability.</small></div>;
}

export function ConfidenceBar({ value, label = "Decision confidence" }: { value: number; label?: string }) {
  const score = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className="confidence-bar" aria-label={`${label}: ${score.toFixed(0)} percent`}>
      <div className="confidence-bar-label"><span>{label}</span><strong>{score.toFixed(0)}%</strong></div>
      <div className="confidence-bar-track"><i style={{ width: `${score}%` }} /></div>
    </div>
  );
}

type ProgressKind = "builder" | "auditor" | "stress-test" | "wallet" | "monte-carlo";

const progressSteps: Record<ProgressKind, string[]> = {
  builder: ["Reading strategy inputs", "Calculating hedge ratio", "Estimating carry", "Checking Safety Buffer", "Preparing verdict"],
  auditor: ["Reading position inputs", "Measuring hedge drift", "Evaluating capital risk", "Checking Safety Buffer", "Preparing audit verdict"],
  "stress-test": ["Applying stress scenario", "Repricing exposure", "Estimating impairment", "Checking collateral resilience", "Preparing stress report"],
  wallet: ["Reading public wallet data", "Normalizing positions", "Measuring exposure", "Calculating impairment", "Preparing portfolio verdict"],
  "monte-carlo": ["Generating stress paths", "Measuring impairment", "Ranking risk factors", "Preparing sensitivity report"],
};

const progressTitles: Record<ProgressKind, string> = {
  builder: "Analyzing strategy",
  auditor: "Auditing position",
  "stress-test": "Simulating portfolio stress",
  wallet: "Auditing wallet",
  "monte-carlo": "Running sensitivity analysis",
};

export function StepProgress({ kind }: { kind: ProgressKind }) {
  const steps = useMemo(
    () => progressSteps[kind],
    [kind],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => Math.min(current + 1, steps.length - 1)), 850);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="step-progress" role="status" aria-live="polite">
      <div className="step-progress-head"><span>{progressTitles[kind]}</span><strong>{active + 1}/{steps.length}</strong></div>
      <div className="step-progress-track"><i style={{ width: `${((active + 1) / steps.length) * 100}%` }} /></div>
      <ol>
        {steps.map((step, index) => <li className={index < active ? "complete" : index === active ? "active" : ""} key={step}><i>{index < active ? "✓" : index + 1}</i><span>{step}</span></li>)}
      </ol>
    </div>
  );
}

export function ReportActions({
  data,
  analysis,
  filename,
  title,
}: {
  data: unknown;
  analysis: string;
  filename: string;
  title: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const payload = JSON.stringify(data, null, 2);

  function downloadJson() {
    try {
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFeedback("JSON report downloaded.");
    } catch {
      setFeedback("JSON download failed.");
    }
  }

  async function copyAnalysis() {
    try {
      await navigator.clipboard.writeText(analysis);
      setFeedback("Analysis copied.");
    } catch {
      setFeedback("Copy failed. Clipboard access may be unavailable.");
    }
  }

  async function shareReport() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: analysis, url: window.location.href });
        setFeedback("Share sheet opened.");
      } else {
        await navigator.clipboard.writeText(`${analysis}\n${window.location.href}`);
        setFeedback("Share text and link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback("Sharing is unavailable in this browser.");
    }
  }

  function printReport() {
    window.print();
    setFeedback("Print dialog opened.");
  }

  return (
    <div className="report-actions report-actions-top">
      <button type="button" onClick={downloadJson}><span aria-hidden="true">↓</span> Export JSON</button>
      <button type="button" onClick={() => void copyAnalysis()}><span aria-hidden="true">□</span> Copy Report</button>
      <button type="button" onClick={() => void shareReport()}><span aria-hidden="true">↗</span> Share</button>
      <button type="button" onClick={printReport}><span aria-hidden="true">▣</span> Print</button>
      <span role="status" aria-live="polite">{feedback}</span>
    </div>
  );
}
