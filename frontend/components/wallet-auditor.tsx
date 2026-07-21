"use client";

import { useEffect, useState, type FormEvent } from "react";

import { AnalysisConfidence, DeltaZeroVerdict, PaymentRequiredCard, recommendationLabel, ReportActions, StepProgress } from "@/components/report-polish";
import { RiskZonePanel } from "@/components/risk-zone-panel";
import { AnalysisProvenance } from "@/components/analysis-provenance";
import { analyzeWallet, PaymentRequiredError, type X402Challenge } from "@/lib/api";
import { MONTE_CARLO_HANDOFF_KEY, type MonteCarloHandoff, writeWalletHandoff } from "@/lib/handoff";
import type {
  NormalizedPosition,
  WalletAnalyzeRequest,
  WalletNetwork,
  WalletPortfolioResponse,
  WalletPrimaryDriver,
  WalletProtocol,
  WalletStressProfile,
} from "@/lib/types";

const DEFAULT_REQUEST: WalletAnalyzeRequest = {
  wallet_address: "",
  networks: ["ethereum", "arbitrum", "hyperliquid"],
  protocols: ["hyperliquid", "aave", "morpho"],
  stress_profile: "standard",
};

const DEMO_WALLET_REQUEST: WalletAnalyzeRequest = {
  wallet_address: "0x7fdafde5cfb5465924316eced2d3715494c517d1",
  networks: ["hyperliquid"],
  protocols: ["hyperliquid"],
  stress_profile: "standard",
};

const NETWORK_OPTIONS: Array<{ value: WalletNetwork; label: string; note: string }> = [
  { value: "ethereum", label: "Ethereum", note: "Aave and Morpho coverage" },
  { value: "arbitrum", label: "Arbitrum", note: "Aave and Morpho coverage" },
  { value: "hyperliquid", label: "Hyperliquid", note: "Perpetual hedge data" },
];

const PROTOCOL_OPTIONS: Array<{ value: WalletProtocol; label: string; note: string }> = [
  { value: "hyperliquid", label: "Hyperliquid", note: "Perpetual positions and margin" },
  { value: "aave", label: "Aave", note: "Supply, borrow, and health factor" },
  { value: "morpho", label: "Morpho", note: "Market and vault positions" },
];

const PROFILE_OPTIONS: Array<{ value: WalletStressProfile; label: string; note: string }> = [
  { value: "standard", label: "Standard", note: "Balanced wallet scrutiny" },
  { value: "elevated", label: "Elevated", note: "Stricter collateral and drift thresholds" },
  { value: "strict", label: "Strict", note: "Conservative treatment for fragile wallets" },
];

const fieldGroups = [
  { title: "Wallet inputs", icon: "◌", description: "Enter a public address and select the scrutiny profile." },
  { title: "Networks", icon: "↯", description: "Choose the chains or venues to inspect." },
  { title: "Protocols", icon: "⌂", description: "Choose the supported protocol adapters to query." },
];

function usd(value: number | null | undefined, maximumFractionDigits = 0) {
  if (value === null || value === undefined) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

function number(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined ? "Unavailable" : value.toFixed(digits);
}

function percent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "Unavailable" : `${value.toFixed(digits)}%`;
}

function toggleValue<T extends string>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function driverValue(driver: WalletPrimaryDriver) {
  if (driver.value === null) return "Unavailable";
  if (typeof driver.value === "number") {
    const formatted = driver.unit === "USD" ? usd(driver.value) : number(driver.value, 1);
    return driver.unit && driver.unit !== "USD" ? `${formatted} ${driver.unit}` : formatted;
  }
  return driver.value;
}

function WalletRequestForm({
  value,
  setValue,
  submit,
  loading,
  loadDemo,
}: {
  value: WalletAnalyzeRequest;
  setValue: (value: WalletAnalyzeRequest) => void;
  submit: (event: FormEvent) => void;
  loading: boolean;
  loadDemo: () => void;
}) {
  return (
    <form className="panel wallet-form" onSubmit={submit}>
      {fieldGroups.map((group) => (
        <section className="form-section" key={group.title}>
          <h2><span aria-hidden="true">{group.icon}</span>{group.title}</h2>
          <p className="panel-copy">{group.description}</p>
          {group.title === "Wallet inputs" ? (
            <div className="form-grid wallet-input-grid">
              <div className="field field-with-help">
                <label htmlFor="wallet_address">Wallet address</label>
                <input
                  id="wallet_address"
                  type="text"
                  autoComplete="off"
                  placeholder="0x..."
                  value={value.wallet_address}
                  onChange={(event) => setValue({ ...value, wallet_address: event.target.value })}
                  required
                />
                <small>Public address only. DeltaZero never asks for signatures or private keys.</small>
              </div>
              <div className="field">
                <label htmlFor="stress_profile">Stress profile</label>
                <select
                  id="stress_profile"
                  value={value.stress_profile}
                  onChange={(event) => setValue({ ...value, stress_profile: event.target.value as WalletStressProfile })}
                >
                  {PROFILE_OPTIONS.map((profile) => <option key={profile.value} value={profile.value}>{profile.label}</option>)}
                </select>
                <small>{PROFILE_OPTIONS.find((profile) => profile.value === value.stress_profile)?.note}</small>
              </div>
            </div>
          ) : null}
          {group.title === "Networks" ? (
            <div className="wallet-choice-grid">
              {NETWORK_OPTIONS.map((option) => (
                <label key={option.value} className={`wallet-choice ${value.networks.includes(option.value) ? "wallet-choice-active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={value.networks.includes(option.value)}
                    onChange={() => setValue({ ...value, networks: toggleValue(value.networks, option.value) })}
                  />
                  <span><strong>{option.label}</strong><small>{option.note}</small></span>
                </label>
              ))}
            </div>
          ) : null}
          {group.title === "Protocols" ? (
            <div className="wallet-choice-grid">
              {PROTOCOL_OPTIONS.map((option) => (
                <label key={option.value} className={`wallet-choice ${value.protocols.includes(option.value) ? "wallet-choice-active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={value.protocols.includes(option.value)}
                    onChange={() => setValue({ ...value, protocols: toggleValue(value.protocols, option.value) })}
                  />
                  <span><strong>{option.label}</strong><small>{option.note}</small></span>
                </label>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      <button className="button button-primary form-submit" disabled={loading}>
        {loading ? "Auditing wallet..." : <>Audit Wallet or Positions <span>→</span></>}
      </button>
      <button className="button wallet-demo-button" type="button" onClick={loadDemo} disabled={loading}>Demo Wallet <span>↗</span></button>
      <p className="wallet-demo-note">Loads a predefined public Hyperliquid address. Submit normally to retrieve live supported positions—no sample results are injected.</p>
      <p className="form-note">Read-only analysis · no transaction permissions</p>
    </form>
  );
}

function AssessmentHeader({ result, protocols }: { result: WalletPortfolioResponse; protocols: WalletProtocol[] }) {
  const action = result.recommendation?.action;
  const displayAction = recommendationLabel(action);
  const primaryCause = result.primary_drivers.find((driver) => driver.state === "critical" || driver.state === "warning") ?? result.primary_drivers[0];
  const expectedImprovement = result.recommended_plan[0]?.target ?? result.recommended_plan[0]?.action ?? "Re-analyze after the recommended plan";
  const timeHorizon = action === "HOLD" ? "Next monitoring cycle" : action === "REBALANCE" ? "Before increasing exposure" : "Immediate risk review";
  return (
    <section className="panel wallet-report-header">
      <div className="wallet-report-title-row">
        <div>
          <span className="decision-eyebrow">Portfolio Assessment</span>
          <h2>Institutional risk intelligence</h2>
        </div>
        <span className="summary-check">Read only</span>
      </div>
      <div className="wallet-assessment-grid">
        <div className="wallet-assessment-action">
          <span>Recommended Action</span>
          <strong className={`action-value action-${action?.toLowerCase()}`}>{displayAction}</strong>
        </div>
        <div><span>Strategy Health</span><strong className={`wallet-status-value health-${result.strategy_health}`}>{result.strategy_health}</strong></div>
        <div><span>Data Quality</span><strong>{result.data_quality}</strong></div>
        <div><span>Supported Positions</span><strong>{result.supported_positions_found}</strong></div>
        <div><span>Protocols Checked</span><strong>{protocols.length}</strong></div>
        <div className="wallet-clarity-cell">
          <AnalysisConfidence value={result.decision_confidence ?? 0} />
        </div>
      </div>
      <div className="decision-detail-grid wallet-decision-details">
        <div><span>Risk Level</span><strong className={`health-${result.strategy_health}`}>{result.strategy_health}</strong></div>
        <div><span>Primary Cause</span><strong>{primaryCause?.explanation ?? result.recommendation?.summary}</strong></div>
        <div><span>Expected Improvement</span><strong>{expectedImprovement}</strong></div>
        <div><span>Time Horizon</span><strong>{timeHorizon}</strong></div>
      </div>
      <p className="wallet-clarity-copy">Confidence measures data completeness and model certainty. It does not predict profitability.</p>
      <details className="wallet-clarity-details">
        <summary>Why this recommendation?</summary>
        <p><strong>{displayAction}</strong> is the appropriate next step because {result.recommendation?.summary.charAt(0).toLowerCase()}{result.recommendation?.summary.slice(1)}</p>
        <ul>{result.primary_drivers.filter((driver) => driver.state !== "unavailable").slice(0, 4).map((driver) => <li key={driver.metric}>{driver.explanation}</li>)}</ul>
      </details>
    </section>
  );
}

function PortfolioSummaryStrip({ result, protocols }: { result: WalletPortfolioResponse; protocols: WalletProtocol[] }) {
  const summary = result.portfolio_summary;
  const items = [
    ["Portfolio Value", usd(summary.current_position_value_usd), "Supported position value"],
    ["Net Exposure", usd(summary.net_delta_usd), "Residual directional exposure"],
    ["Current Hedge Ratio", number(result.risk_metrics.hedge_ratio, 3), "Short exposure relative to long"],
    ["Protocols Covered", String(result.executive_summary?.protocol_count ?? protocols.length), "Successfully represented sources"],
    ["Risk Rating", result.strategy_health ?? "Unavailable", "Current deterministic assessment"],
  ];
  return <section className="wallet-summary-strip" aria-label="Portfolio summary">{items.map(([label, value, copy]) => <article key={label}><span>{label}</span><strong className={label === "Risk Rating" && result.strategy_health ? `health-${result.strategy_health}` : ""}>{value}</strong><small>{copy}</small></article>)}</section>;
}

function ExecutiveSummary({ result }: { result: WalletPortfolioResponse }) {
  if (!result.executive_summary) return null;
  return (
    <section className="panel wallet-executive-summary">
      <span className="wallet-section-kicker">Executive Summary</span>
      <h2>{result.executive_summary.headline}</h2>
      <p>{result.executive_summary.body}</p>
      <div className="wallet-summary-facts">
        <span>{result.executive_summary.position_count} positions</span>
        <span>{result.executive_summary.protocol_count} protocols</span>
        <span>{result.executive_summary.risk_level} risk</span>
      </div>
    </section>
  );
}

function PrimaryDrivers({ drivers }: { drivers: WalletPrimaryDriver[] }) {
  return (
    <section className="wallet-report-section">
      <div className="wallet-section-heading"><div><span>Decision evidence</span><h2>Primary Drivers</h2></div><small>{drivers.length} evaluated signals</small></div>
      <div className="wallet-driver-grid">
        {drivers.map((driver) => (
          <article className={`wallet-driver wallet-driver-${driver.state}`} key={driver.metric}>
            <div><span>{driver.label}</span><i>{driver.state}</i></div>
            <strong>{driverValue(driver)}</strong>
            <p>{driver.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExposureAnalysis({ result }: { result: WalletPortfolioResponse }) {
  const exposure = result.exposure_analysis;
  if (!exposure) return null;
  const metrics = [
    ["Gross Exposure", usd(exposure.gross_exposure_usd), "Absolute long plus short exposure."],
    ["Long Exposure", usd(exposure.gross_long_exposure_usd), "Supported long-side directional exposure."],
    ["Short Exposure", usd(exposure.gross_short_exposure_usd), "Supported short and borrow exposure."],
    ["Net Delta", `${usd(exposure.net_delta_usd)} · ${percent(exposure.net_delta_pct)}`, "Directional difference relative to gross exposure."],
    ["Portfolio Equity", usd(exposure.portfolio_equity_usd), "Assets plus reliable derivative equity, less debt."],
    ["Leverage", exposure.leverage_ratio === null ? "Unavailable" : `${number(exposure.leverage_ratio)}×`, "Gross exposure divided by reliable portfolio equity."],
    ["Position Count", String(exposure.position_count), "Supported normalized positions included."],
  ];
  return (
    <section className="wallet-report-section">
      <div className="wallet-section-heading"><div><span>Portfolio overview</span><h2>Portfolio Overview</h2></div></div>
      <div className="wallet-exposure-grid">
        {metrics.map(([label, value, copy]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>)}
      </div>
    </section>
  );
}

function ExposureBreakdown({ result }: { result: WalletPortfolioResponse }) {
  const summary = result.portfolio_summary;
  const items = [
    ["Long exposure", usd(summary.gross_long_exposure_usd), "Supported assets and long derivative exposure."],
    ["Short exposure", usd(summary.gross_short_exposure_usd), "Supported short derivative and borrow exposure."],
    ["Net delta", `${usd(summary.net_delta_usd)} · ${percent(summary.net_delta_pct)}`, "Residual directional exposure after supported hedges."],
    ["Collateral", usd(summary.collateral_value_usd), "Collateral value reported by supported sources."],
    ["Debt", usd(summary.debt_value_usd), "Borrowed value reported by supported lending sources."],
    ["Unrealized PnL", usd(summary.unrealized_pnl_usd), "Aggregate unrealized result where providers expose it reliably."],
  ];
  return <section className="wallet-report-section"><div className="wallet-section-heading"><div><span>Directional composition</span><h2>Exposure Breakdown</h2></div></div><div className="wallet-exposure-grid">{items.map(([label, value, copy]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>)}</div></section>;
}

function ProtocolAllocation({ result }: { result: WalletPortfolioResponse }) {
  const totals = new Map<string, number>();
  for (const position of result.positions) {
    const exposure = Math.abs(position.notional_usd ?? position.current_value_usd ?? 0);
    totals.set(position.protocol, (totals.get(position.protocol) ?? 0) + exposure);
  }
  const gross = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const rows = [...totals.entries()].sort((left, right) => right[1] - left[1]);
  if (gross <= 0 || rows.length === 0) return null;
  return <section className="panel wallet-allocation-panel"><div className="wallet-section-heading"><div><span>Supported source concentration</span><h2>Protocol Allocation</h2></div></div><div className="wallet-allocation-list">{rows.map(([protocol, exposure]) => { const allocation = exposure / gross * 100; return <div className="wallet-allocation-row" key={protocol}><div><strong>{formatProtocol(protocol)}</strong><span>{percent(allocation)} · {usd(exposure)}</span></div><div className="wallet-allocation-track" aria-label={`${protocol} ${allocation.toFixed(1)} percent`}><i style={{ width: `${allocation}%` }} /></div></div>; })}</div></section>;
}

function formatProtocol(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function WalletRiskOutlook({ result }: { result: WalletPortfolioResponse }) {
  const stress = result.stress_summary;
  const action = result.recommendation?.action;
  return <section className="panel risk-outlook-panel"><div className="wallet-section-heading"><div><span>Risk timeline</span><h2>Current, Recommended, and Worst Case</h2></div><small>Measured values only</small></div><div className="risk-outlook-grid"><article><i>1</i><span>Current Risk</span><strong className={`health-${result.strategy_health}`}>{result.strategy_health}</strong><p>{result.primary_drivers[0]?.explanation ?? "Current supported portfolio metrics were evaluated."}</p></article><article><i>2</i><span>After Recommendation</span><strong>{action === "HOLD" ? "Monitor" : "Re-analysis required"}</strong><p>{result.recommended_plan[0]?.target ?? "Apply the recommended plan and run a new assessment to measure improvement."}</p></article><article><i>3</i><span>Worst Case</span><strong>{stress ? percent(stress.estimated_impairment_loss_pct) : "Unavailable"}</strong><p>{stress?.summary ?? "No reliable stress result is available."}</p></article></div></section>;
}

function RiskBreakdown({ result }: { result: WalletPortfolioResponse }) {
  const risk = result.risk_metrics;
  const summary = result.portfolio_summary;
  const metrics = [
    ["Safety Buffer", number(risk.safety_buffer_score, 1), "Collateral resilience after hedge and impairment penalties."],
    ["Post-Impairment Equity", usd(risk.post_impairment_equity_usd), "Estimated equity remaining after the selected stress profile."],
    ["Hedge Ratio", number(risk.hedge_ratio, 3), "Short exposure relative to supported long exposure."],
    ["Hedge Drift", percent(risk.hedge_drift_pct), "Distance from the configured hedge relationship."],
    ["Funding Exposure", percent(summary.estimated_funding_exposure_apy), "Estimated annualized funding bias when reliable."],
    ["Liquidation Proximity", percent(risk.liquidation_proximity_pct), "Higher values indicate greater proximity to liquidation."],
    ["Capital at Risk", usd(risk.capital_at_risk_proxy), "Deterministic proxy combining delta, debt, and impairment."],
  ];
  return (
    <section className="wallet-report-section">
      <div className="wallet-section-heading"><div><span>Risk diagnostics</span><h2>Risk Breakdown</h2></div></div>
      <div className="wallet-risk-grid">
        <article className={`wallet-impairment-card impairment-${result.stress_summary?.impairment_level.toLowerCase()}`}>
          <span>Estimated Impairment</span>
          <strong>{usd(risk.estimated_impairment_loss_usd)} · {percent(risk.estimated_impairment_loss_pct)}</strong>
          <b>{result.stress_summary?.impairment_level ?? "Unavailable"} <i>{result.stress_summary?.impairment_label ?? ""}</i></b>
          <p>Scenario loss relative to pre-stress equity.</p>
        </article>
        <article>
          <span>Collateral Health</span>
          <strong>{risk.minimum_health_factor === null ? "Unavailable" : number(risk.minimum_health_factor, 2)}</strong>
          {risk.minimum_health_factor !== null ? <b>{risk.minimum_health_factor >= 1.5 ? "Healthy" : risk.minimum_health_factor >= 1.2 ? "Warning" : "Critical"}</b> : null}
          <p>{risk.minimum_health_factor === null ? "Health factor or collateral ratio was not available." : "Minimum reported protocol health factor."}</p>
        </article>
        {metrics.map(([label, value, copy]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>)}
      </div>
    </section>
  );
}

function LargestRiskContributors({ result }: { result: WalletPortfolioResponse }) {
  return (
    <section className="panel wallet-contributors-panel">
      <div className="wallet-section-heading"><div><span>Position-level attribution</span><h2>Largest Risk Contributors</h2></div></div>
      {result.largest_risk_contributors.length ? (
        <div className="wallet-table-scroll"><table className="wallet-contributors-table">
          <thead><tr><th>Asset</th><th>Protocol</th><th>Exposure USD</th><th>Risk Contribution</th><th>Primary Risk</th></tr></thead>
          <tbody>{result.largest_risk_contributors.map((item) => <tr key={`${item.protocol}-${item.asset}`}><td><strong>{item.asset}</strong></td><td>{item.protocol}</td><td>{usd(item.exposure_usd)}</td><td>{percent(item.risk_contribution_pct)}</td><td>{item.primary_risk}</td></tr>)}</tbody>
        </table></div>
      ) : <p>Unavailable</p>}
    </section>
  );
}

function PortfolioObservations({ result }: { result: WalletPortfolioResponse }) {
  return <section className="panel wallet-observations-panel"><div className="wallet-section-heading"><div><span>Deterministic findings</span><h2>Portfolio Observations</h2></div></div><ul>{result.portfolio_observations.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

function RiskTimeline({ result }: { result: WalletPortfolioResponse }) {
  return <section className="panel wallet-timeline-panel"><div className="wallet-section-heading"><div><span>Threshold events</span><h2>Risk Timeline</h2></div></div><div>{result.risk_timeline.map((item) => <article key={item.metric}><i className={`timeline-dot timeline-${item.state}`} /><strong>{item.metric}</strong><b>{item.state}</b><p>{item.explanation}</p></article>)}</div></section>;
}

function PortfolioAllocation({ result }: { result: WalletPortfolioResponse }) {
  if (result.portfolio_allocation.length === 0) return null;
  return (
    <section className="panel wallet-allocation-panel">
      <div className="wallet-section-heading"><div><span>Absolute supported exposure</span><h2>Portfolio Allocation</h2></div></div>
      <div className="wallet-allocation-list">
        {result.portfolio_allocation.map((item) => (
          <div className="wallet-allocation-row" key={item.asset}>
            <div><strong>{item.asset}</strong><span>{percent(item.allocation_pct)} · {usd(item.exposure_usd)}</span></div>
            <div className="wallet-allocation-track" aria-label={`${item.asset} ${item.allocation_pct.toFixed(1)} percent`}><i style={{ width: `${Math.min(100, item.allocation_pct)}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecommendedPlan({ result }: { result: WalletPortfolioResponse }) {
  return (
    <section className="panel wallet-plan-panel">
      <div className="wallet-section-heading"><div><span>Ordered response</span><h2>Recommended Plan</h2></div></div>
      <ol>
        {result.recommended_plan.map((step) => (
          <li key={step.priority}>
            <b>{step.priority}</b>
            <div><strong>{step.action}</strong><p>{step.reason}</p>{step.target ? <span>{step.target}</span> : null}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PositionTable({ positions }: { positions: NormalizedPosition[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? positions : positions.slice(0, 10);
  return (
    <section className="panel wallet-positions-panel">
      <div className="wallet-section-heading"><div><span>Normalized public data</span><h2>Detected Positions</h2></div><small>Showing {visible.length} of {positions.length}</small></div>
      <div className="wallet-table-scroll">
        <table className="wallet-position-table">
          <thead><tr><th>Asset</th><th>Type</th><th>Side</th><th>Protocol</th><th>Subaccount</th><th>Quantity</th><th>Notional</th><th>PnL</th><th>Liquidation Price</th><th>Health Factor</th><th>Data Quality</th></tr></thead>
          <tbody>
            {visible.map((position, index) => (
              <tr key={`${position.protocol}-${position.subaccount_address}-${position.asset}-${position.position_type}-${index}`}>
                <td><strong>{position.asset}</strong></td>
                <td>{position.position_type.replaceAll("_", " ")}</td>
                <td>{position.side ?? "Unavailable"}</td>
                <td>{position.protocol}</td>
                <td>{position.subaccount_name ?? position.subaccount_address ?? "Direct account"}</td>
                <td>{number(position.quantity, 4)}</td>
                <td>{usd(position.notional_usd)}</td>
                <td>{usd(position.unrealized_pnl_usd)}</td>
                <td>{usd(position.liquidation_price, 2)}</td>
                <td>{number(position.health_factor, 2)}</td>
                <td><span className={`wallet-quality wallet-quality-${position.data_quality}`}>{position.data_quality}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {positions.length > 10 ? <button className="wallet-table-toggle" type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show fewer" : "Show all positions"}</button> : null}
    </section>
  );
}

function StressSummary({ result }: { result: WalletPortfolioResponse }) {
  const stress = result.stress_summary;
  if (!stress) return null;
  return (
    <section className="panel wallet-stress-panel">
      <div className="wallet-section-heading"><div><span>Deterministic scenario</span><h2>Stress Summary</h2></div></div>
      <div className="wallet-stress-grid">
        <div><span>Stress Profile</span><strong>{stress.stress_profile}</strong></div>
        <div><span>Estimated Impairment</span><strong>{usd(stress.estimated_impairment_loss_usd)} · {percent(stress.estimated_impairment_loss_pct)}</strong></div>
        <div><span>Post-Impairment Equity</span><strong>{usd(stress.post_impairment_equity_usd)}</strong></div>
        <div><span>Dominant Risk</span><strong>{stress.dominant_risk}</strong></div>
      </div>
      <p>{stress.summary}</p>
    </section>
  );
}

function ProtocolWarnings({ result }: { result: WalletPortfolioResponse }) {
  if (result.protocol_errors.length === 0 && result.warnings.length === 0) return null;
  return (
    <section className="panel wallet-warning-panel">
      <h2 className="panel-title">Protocol Warnings</h2>
      <ul className="risk-list">
        {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        {result.protocol_errors.map((error) => <li key={`${error.protocol}-${error.network}-${error.message}`}>{error.protocol} on {error.network}: {error.message}</li>)}
      </ul>
    </section>
  );
}

function InstitutionalReport({ result, protocols }: { result: WalletPortfolioResponse; protocols: WalletProtocol[] }) {
  function buildHedgeRecommendation() {
    const exposure = result.exposure_analysis;
    if (!exposure || !result.recommendation) return;
    const largest = result.largest_risk_contributors[0]?.asset ?? result.portfolio_allocation[0]?.asset ?? null;
    writeWalletHandoff({
      source: "wallet_auditor",
      wallet_address: result.wallet_address,
      asset: largest,
      largest_risk_asset: largest,
      gross_long_exposure_usd: exposure.gross_long_exposure_usd,
      gross_short_exposure_usd: exposure.gross_short_exposure_usd,
      net_delta_usd: exposure.net_delta_usd,
      net_delta_pct: exposure.net_delta_pct,
      current_hedge_ratio: result.risk_metrics.hedge_ratio,
      portfolio_equity_usd: exposure.portfolio_equity_usd,
      recommended_action: result.recommendation.action,
      data_quality: result.assessment_status === "partial_data" ? "partial" : "complete",
      data_timestamp: result.data_timestamp,
    });
    window.location.href = `/builder?source=wallet_auditor${largest ? `&asset=${encodeURIComponent(largest)}` : ""}`;
  }
  function runExposureMonteCarlo() {
    const exposure = result.exposure_analysis;
    const asset = result.largest_risk_contributors[0]?.asset ?? result.portfolio_allocation[0]?.asset;
    if (!exposure || (asset !== "SOL" && asset !== "ETH")) return;
    const handoff: MonteCarloHandoff = { source: "wallet_auditor", asset, capital_usd: exposure.portfolio_equity_usd, long_notional_usd: exposure.gross_long_exposure_usd, short_notional_usd: exposure.gross_short_exposure_usd, collateral_usd: result.portfolio_summary.collateral_value_usd, short_funding_apy: result.portfolio_summary.estimated_funding_exposure_apy ?? undefined, risk_tolerance: "medium", target_style: "neutral_yield" };
    sessionStorage.setItem(MONTE_CARLO_HANDOFF_KEY, JSON.stringify(handoff));
    window.location.href = "/monte-carlo?source=wallet_auditor";
  }
  const monteCarloAsset = result.largest_risk_contributors[0]?.asset ?? result.portfolio_allocation[0]?.asset;
  const canRunMonteCarlo = Boolean(result.exposure_analysis && (monteCarloAsset === "SOL" || monteCarloAsset === "ETH") && result.exposure_analysis.gross_long_exposure_usd + result.exposure_analysis.gross_short_exposure_usd > 0);
  return (
    <>
      {result.assessment_status === "partial_data" ? (
        <section className="panel wallet-status-banner wallet-partial-banner">
          <span className="decision-label">PARTIAL PORTFOLIO COVERAGE</span>
          <p>This assessment includes only the supported positions successfully retrieved. Do not treat it as a complete wallet inventory.</p>
        </section>
      ) : null}
      <div className="report-breadcrumb" aria-label="Report location"><span>Hedge Intelligence</span><i aria-hidden="true">/</i><strong>Hedge Integrity Report</strong></div>
      <DeltaZeroVerdict health={result.strategy_health} action={result.recommendation?.action} confidence={result.decision_confidence ?? 0} safetyBuffer={result.risk_metrics.safety_buffer_score} />
      <RiskZonePanel metrics={{
        recommendation: result.recommendation?.action,
        risk_level: result.strategy_health,
        safety_buffer_score: result.risk_metrics.safety_buffer_score,
        hedge_drift_pct: result.risk_metrics.hedge_drift_pct,
        expected_impairment_loss_pct: result.risk_metrics.estimated_impairment_loss_pct,
      }} />
      <AnalysisProvenance
        source={protocols.length ? protocols.join(", ") : "Supported public protocol sources"}
        sourceTimestamp={result.data_timestamp}
        generatedAt={result.data_timestamp}
        quality={result.data_quality}
        note="Coverage includes only supported positions returned by the selected read-only integrations."
      />
      <ExecutiveSummary result={result} />
      <PortfolioSummaryStrip result={result} protocols={protocols} />
      <AssessmentHeader result={result} protocols={protocols} />
      <WalletRiskOutlook result={result} />
      <RiskTimeline result={result} />
      <PositionTable positions={result.positions} />
      <ExposureAnalysis result={result} />
      <ExposureBreakdown result={result} />
      <LargestRiskContributors result={result} />
      <ProtocolAllocation result={result} />
      <PortfolioAllocation result={result} />
      <RecommendedPlan result={result} />
      <button className="button button-primary wallet-hedge-cta" type="button" onClick={buildHedgeRecommendation}>Build Hedge Recommendation <span>→</span></button>
      {canRunMonteCarlo ? <button className="button button-primary wallet-hedge-cta" type="button" onClick={runExposureMonteCarlo}>Run Monte Carlo on Exposure <span>→</span></button> : null}
      <PrimaryDrivers drivers={result.primary_drivers} />
      <RiskBreakdown result={result} />
      <PortfolioObservations result={result} />
      <StressSummary result={result} />
      <ProtocolWarnings result={result} />
      <ReportActions
        data={result}
        analysis={`DeltaZero Hedge Intelligence\nRecommendation: ${result.recommendation?.action}\nRisk level: ${result.strategy_health}\nDecision clarity: ${result.decision_confidence?.toFixed(0)}%\n${result.executive_summary?.body ?? result.recommendation?.summary}`}
        filename={`deltazero-wallet-${result.wallet_address.slice(0, 10)}.json`}
        title="DeltaZero Wallet Portfolio Assessment"
      />
      <details className="panel json-box">
        <summary><span><b>Raw JSON</b><small>Developer payload</small></span><i aria-hidden="true">⌄</i></summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </>
  );
}

export function WalletPortfolioWorkspace() {
  const [value, setValue] = useState<WalletAnalyzeRequest>(() => structuredClone(DEFAULT_REQUEST));
  const [result, setResult] = useState<WalletPortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentChallenge, setPaymentChallenge] = useState<X402Challenge | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const requestedProtocol = new URLSearchParams(window.location.search).get("protocol");
    if (requestedProtocol !== "hyperliquid" && requestedProtocol !== "aave" && requestedProtocol !== "morpho") return;

    const timer = window.setTimeout(() => {
      setValue((current) => ({
        ...current,
        networks: requestedProtocol === "hyperliquid" ? ["hyperliquid"] : ["ethereum", "arbitrum"],
        protocols: [requestedProtocol],
      }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setPaymentChallenge(undefined);
    try {
      setResult(await analyzeWallet(value));
    } catch (caught) {
      setResult(null);
      if (caught instanceof PaymentRequiredError) setPaymentChallenge(caught.challenge);
      else setError(caught instanceof Error ? caught.message : "Unable to analyze the wallet.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runAnalysis();
  }

  const successfulProtocols = result ? value.protocols.filter((protocol) => !result.protocol_errors.some((error) => error.protocol === protocol)) : [];
  const failedProtocols = result ? result.protocol_errors.map((item) => `${item.protocol} · ${item.network}`) : [];

  return (
    <div className="workspace">
      <header className="page-intro wallet-page-intro">
        <div><p className="kicker">Hedge Intelligence</p><h1>Read-Only Hedge Intelligence</h1><div className="wallet-pro-badge">FREE PUBLIC PROTOCOL DATA</div><p>Analyze supported public positions for hedge drift, exposure integrity, and corrective action.</p></div>
        <div className="wallet-page-side"><span className="endpoint">POST /wallet/analyze</span><p className="wallet-readonly-note">DeltaZero only reads public wallet and protocol data. It never requests signatures, private keys, or transaction permissions.</p></div>
      </header>
      <div className="workspace-grid wallet-workspace-grid">
        <WalletRequestForm value={value} setValue={setValue} submit={submit} loading={loading} loadDemo={() => { setValue(structuredClone(DEMO_WALLET_REQUEST)); setResult(null); setError(null); }} />
        <div className="result-region">
          {paymentChallenge !== undefined ? (
            <PaymentRequiredCard challenge={paymentChallenge} />
          ) : error ? (
            <div className="error-box" role="alert"><span className="state-icon">!</span><div><strong>Analysis could not be completed</strong><p>{error}</p><small>Check the wallet address and selected protocol coverage, then try again.</small></div></div>
          ) : loading ? (
            <div className="panel loading-state"><StepProgress kind="wallet" /></div>
          ) : result ? (
            <div className="result-stack">
              {result.assessment_status === "no_supported_positions" ? (
                <section className="panel wallet-empty-card wallet-portfolio-status-card">
                  <span className="decision-label">PORTFOLIO STATUS</span><h2>No Supported Positions Found</h2><p>This wallet currently has no supported lending or perpetual positions across the selected protocols.</p>
                  <div className="wallet-empty-meta">
                    {[["Wallet address", result.wallet_address], ["Protocols checked", value.protocols.join(", ")], ["Networks checked", value.networks.join(", ")], ["Supported positions", String(result.supported_positions_found)], ["Assessment time", result.data_timestamp ?? "Unavailable"]].map(([label, text]) => <div key={label}><label>{label}</label><strong>{text}</strong></div>)}
                  </div>
                  <div className="wallet-empty-action"><strong>Try:</strong><ul><li>another wallet</li><li>additional protocols</li><li>refreshing the audit</li></ul></div>
                </section>
              ) : result.assessment_status === "insufficient_data" ? (
                <section className="panel wallet-empty-card wallet-incomplete-card">
                  <span className="decision-label">ASSESSMENT INCOMPLETE</span><h2>DeltaZero could not verify whether this wallet holds supported positions because one or more data sources failed.</h2><p>No risk recommendation is available for incomplete discovery.</p>
                  <div className="wallet-empty-meta"><div><label>Successful protocol checks</label><strong>{successfulProtocols.join(", ") || "None"}</strong></div><div><label>Failed protocol checks</label><strong>{failedProtocols.join(", ") || "None"}</strong></div><div><label>Warnings</label><strong>{result.warnings.join(" · ") || "None"}</strong></div></div>
                  <button className="button button-primary form-submit" type="button" onClick={() => void runAnalysis()}>Retry Analysis <span>→</span></button>
                </section>
              ) : (
                <InstitutionalReport result={result} protocols={value.protocols} />
              )}
            </div>
          ) : (
            <div className="panel empty-state"><div><div className="empty-icon">◌</div><strong>Turn public positions into an explainable risk report</strong><p>Enter a wallet or load the predefined public demo address. DeltaZero will query only the selected sources, identify supported positions, and explain exposure, impairment, and the next action.</p><small>No sample positions are injected. No signatures, private keys, or transaction permissions are requested.</small></div></div>
          )}
        </div>
      </div>
    </div>
  );
}
