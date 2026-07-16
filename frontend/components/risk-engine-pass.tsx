"use client";

import { useState } from "react";

import { PaymentRequiredCard } from "@/components/report-polish";
import { PaymentReceiptCard } from "@/components/payment-receipt-card";
import { PaymentRequiredError, payRiskEngineWithWallet, runRiskEnginePass, type X402Challenge } from "@/lib/api";
import { appendReportHistory } from "@/lib/report-history";
import type { Asset, RiskEnginePassRequest, RiskEnginePassResponse, RiskTolerance, TargetStyle } from "@/lib/types";

const initial: RiskEnginePassRequest = {
  asset: "SOL",
  capital_usd: 5000,
  risk_tolerance: "medium",
  target_style: "neutral_yield",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
  stress_magnitude_pct: 4,
  simulation_count: 1000,
  time_horizon_days: 30,
  seed: 42,
};

const pct = (value: number) => `${value.toFixed(2)}%`;
const usd = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function RiskEnginePass() {
  const [value, setValue] = useState(initial);
  const [result, setResult] = useState<RiskEnginePassResponse | null>(null);
  const [payment, setPayment] = useState<X402Challenge | null | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    setPayment(undefined);
    try {
      const response = await runRiskEnginePass(value);
      setResult(response);
      appendReportHistory({ type: "risk_engine", asset: response.strategy_build.asset, generatedAt: response.generated_at, recommendation: response.monte_carlo_sensitivity.summary.recommendation, safetyBuffer: response.hedge_drift_audit.metrics.safety_buffer_score, p95Impairment: response.monte_carlo_sensitivity.summary.p95_impairment_loss_pct, payload: response });
    } catch (caught) {
      if (caught instanceof PaymentRequiredError) setPayment(caught.challenge);
      else setError(caught instanceof Error ? caught.message : "Risk Engine Pass could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  async function payInBrowser() {
    setLoading(true);
    setError(null);
    setCheckoutStatus("Connect OKX Wallet and review the 1 USDT0 authorization.");
    try {
      const paidResult = await payRiskEngineWithWallet(value, payment);
      setResult(paidResult);
      appendReportHistory({ type: "risk_engine", asset: paidResult.strategy_build.asset, generatedAt: paidResult.generated_at, recommendation: paidResult.monte_carlo_sensitivity.summary.recommendation, safetyBuffer: paidResult.hedge_drift_audit.metrics.safety_buffer_score, p95Impairment: paidResult.monte_carlo_sensitivity.summary.p95_impairment_loss_pct, payload: paidResult });
      setPayment(undefined);
      setCheckoutStatus("Payment confirmed on X Layer. All four reports are unlocked.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Wallet payment could not be completed.";
      setError(message.includes("User rejected") || message.includes("4001") ? "Payment was cancelled in the wallet." : message);
      setCheckoutStatus(null);
    } finally {
      setLoading(false);
    }
  }

  const numberField = (label: string, key: keyof RiskEnginePassRequest) => (
    <div className="field"><label>{label}</label><input type="number" value={String(value[key] ?? "")} onChange={(event) => setValue({ ...value, [key]: Number(event.target.value) })} /></div>
  );

  return (
    <section className="risk-pass-stack" aria-labelledby="risk-pass-title">
      <div className="panel risk-pass-offer">
        <div><span className="decision-eyebrow">One payment · four coordinated reports</span><h2 id="risk-pass-title">1 USDT Risk Engine Pass</h2><p>Pay once for this analysis and receive Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Monte Carlo Sensitivity from the same inputs.</p></div>
        <strong>1 USDT <small>per new analysis</small></strong>
      </div>
      <form className="panel risk-pass-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <div className="field"><label>Asset</label><select value={value.asset} onChange={(event) => setValue({ ...value, asset: event.target.value as Asset })}><option value="SOL">SOL</option><option value="ETH">ETH</option></select></div>
          <div className="field"><label>Risk tolerance</label><select value={value.risk_tolerance} onChange={(event) => setValue({ ...value, risk_tolerance: event.target.value as RiskTolerance })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div className="field"><label>Target style</label><select value={value.target_style} onChange={(event) => setValue({ ...value, target_style: event.target.value as TargetStyle })}><option value="neutral_yield">Neutral yield</option><option value="conservative_income">Conservative income</option><option value="aggressive_carry">Aggressive carry</option><option value="capital_preservation">Capital preservation</option></select></div>
          {numberField("Capital (USD)", "capital_usd")}
          {numberField("Long yield APY", "long_yield_apy")}
          {numberField("Short funding APY", "short_funding_apy")}
          {numberField("Fee drag APY", "fee_drag_apy")}
          {numberField("Funding stress magnitude", "stress_magnitude_pct")}
          {numberField("Monte Carlo paths", "simulation_count")}
        </div>
        <button className="button button-primary form-submit" disabled={loading}>{loading ? "Running complete assessment…" : "Unlock complete Risk Engine →"}</button>
        <small className="risk-pass-note">One paid request generates all four reports. Starting another analysis requires a new pass.</small>
      </form>

      {payment !== undefined ? <PaymentRequiredCard challenge={payment} retry={() => void submit()} payInBrowser={() => void payInBrowser()} loading={loading} /> : null}
      {checkoutStatus ? <div className="panel checkout-status" role="status"><span className="decision-eyebrow">OKX checkout</span><strong>{checkoutStatus}</strong></div> : null}
      {error ? <div className="error-box" role="alert"><strong>Assessment could not be completed</strong><p>{error}</p></div> : null}
      {result ? <PaymentReceiptCard /> : null}
      {result ? <div className="risk-pass-results">
        <header className="panel"><span className="decision-eyebrow">Risk Engine Pass complete</span><h2>Four reports. One strategy. One payment.</h2><p>Generated {new Date(result.generated_at).toLocaleString()} from a shared set of assumptions.</p></header>
        <div className="risk-pass-result-grid">
          <article className="panel"><span>01 · Strategy Build</span><h3>{result.strategy_build.recommendation.action}</h3><strong>{pct(result.strategy_build.metrics.estimated_net_carry_apy)} net carry</strong><p>{usd(result.strategy_build.recommended_structure.long_notional_usd)} long · {usd(result.strategy_build.recommended_structure.short_notional_usd)} short</p></article>
          <article className="panel"><span>02 · Hedge-Drift Auditing</span><h3>{result.hedge_drift_audit.recommendation.action}</h3><strong>{pct(result.hedge_drift_audit.metrics.hedge_drift_pct)} hedge drift</strong><p>Safety Buffer {result.hedge_drift_audit.metrics.safety_buffer_score.toFixed(1)}</p></article>
          <article className="panel"><span>03 · Funding Stress Testing</span><h3>{result.funding_stress_test.recommendation.action}</h3><strong>{pct(result.funding_stress_test.estimated_impairment_loss_pct)} impairment</strong><p>{usd(result.funding_stress_test.post_impairment_equity_usd)} post-stress equity</p></article>
          <article className="panel"><span>04 · Monte Carlo Sensitivity</span><h3>{result.monte_carlo_sensitivity.summary.recommendation}</h3><strong>{pct(result.monte_carlo_sensitivity.summary.p95_impairment_loss_pct)} P95 impairment</strong><p>{pct(result.monte_carlo_sensitivity.summary.probability_hedge_drift_breach_pct)} drift-breach probability</p></article>
        </div>
      </div> : null}
    </section>
  );
}
