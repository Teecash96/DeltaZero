"use client";

import { useEffect, useMemo, useState } from "react";

import type { X402Challenge, X402PaymentOption } from "@/lib/api";

function paymentAsset(option: X402PaymentOption | undefined) {
  const name = option?.extra?.name;
  return typeof name === "string" && name ? name : option?.asset ?? "Unavailable";
}

function paymentPrice(option: X402PaymentOption | undefined) {
  if (!option?.amount) return "Unavailable";
  const decimals = option.extra?.decimals;
  const name = option.extra?.name;
  if (typeof decimals === "number" && /^\d+$/.test(option.amount)) {
    const numeric = Number(option.amount) / 10 ** decimals;
    if (Number.isFinite(numeric)) return `${numeric.toLocaleString(undefined, { maximumFractionDigits: decimals })}${typeof name === "string" ? ` ${name}` : ""}`;
  }
  return `${option.amount} base units${typeof name === "string" ? ` ${name}` : ""}`;
}

export function PaymentRequiredCard({ challenge, retry, loading }: { challenge: X402Challenge | null; retry: () => void; loading: boolean }) {
  const option = challenge?.accepts?.[0];
  const details = [["Price", paymentPrice(option)], ["Network", option?.network ?? "Unavailable"], ["Asset", paymentAsset(option)], ["Receiver", option?.payTo ?? "Unavailable"]];
  return (
    <section className="panel payment-required-card" role="alert" aria-labelledby="payment-required-title">
      <span className="payment-required-icon" aria-hidden="true">◇</span>
      <div className="payment-required-copy">
        <span className="decision-eyebrow">x402 payment boundary</span>
        <h2 id="payment-required-title">Payment Required</h2>
        <p>This endpoint is protected by x402.</p>
        {challenge ? <dl className="payment-required-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="payment-required-missing">Protected endpoint returned HTTP 402.</p>}
        <button className="button button-primary" type="button" onClick={retry} disabled={loading}>{loading ? "Retrying..." : "Retry after payment"}</button>
        <small>DeltaZero will retry the request. Payment status is verified by the protected endpoint.</small>
      </div>
    </section>
  );
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

export function StepProgress({ kind }: { kind: "strategy" | "wallet" }) {
  const steps = useMemo(
    () => kind === "wallet"
      ? ["Validating the public address", "Querying selected read-only sources", "Normalizing supported positions", "Evaluating exposure and impairment", "Preparing the portfolio report"]
      : ["Validating strategy inputs", "Evaluating carry and hedge alignment", "Comparing risk thresholds", "Calculating Safety Buffer", "Preparing the decision report"],
    [kind],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => Math.min(current + 1, steps.length - 1)), 850);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="step-progress" role="status" aria-live="polite">
      <div className="step-progress-head"><span>{kind === "wallet" ? "Auditing wallet" : "Analyzing strategy"}</span><strong>{active + 1}/{steps.length}</strong></div>
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

  return (
    <div className="report-actions">
      <button type="button" onClick={downloadJson}><span aria-hidden="true">↓</span> Download JSON</button>
      <button type="button" onClick={() => void copyAnalysis()}><span aria-hidden="true">□</span> Copy Analysis</button>
      <button type="button" onClick={() => void shareReport()}><span aria-hidden="true">↗</span> Share Report</button>
      <span role="status" aria-live="polite">{feedback}</span>
    </div>
  );
}
