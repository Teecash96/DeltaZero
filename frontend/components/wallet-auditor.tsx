"use client";

import { useState, type FormEvent } from "react";

import { RiskGauge } from "@/components/risk-gauge";
import { analyzeWallet } from "@/lib/api";
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
}: {
  value: WalletAnalyzeRequest;
  setValue: (value: WalletAnalyzeRequest) => void;
  submit: (event: FormEvent) => void;
  loading: boolean;
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
      <p className="form-note">Read-only analysis · no transaction permissions</p>
    </form>
  );
}

function AssessmentHeader({ result, protocols }: { result: WalletPortfolioResponse; protocols: WalletProtocol[] }) {
  const action = result.recommendation?.action;
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
          <strong className={`action-value action-${action?.toLowerCase()}`}>{action}</strong>
        </div>
        <div><span>Strategy Health</span><strong className={`wallet-status-value health-${result.strategy_health}`}>{result.strategy_health}</strong></div>
        <div><span>Data Quality</span><strong>{result.data_quality}</strong></div>
        <div><span>Supported Positions</span><strong>{result.supported_positions_found}</strong></div>
        <div><span>Protocols Checked</span><strong>{protocols.length}</strong></div>
        <div className="wallet-clarity-cell">
          <RiskGauge
            value={result.decision_confidence ?? 0}
            max={100}
            tone="positive"
            label="Decision clarity"
            caption="Recommendation support"
            suffix="%"
            size="sm"
          />
        </div>
      </div>
      <p className="wallet-clarity-copy">Decision Clarity measures how strongly the available metrics support the recommended action. It does not predict profitability.</p>
      <details className="wallet-clarity-details">
        <summary>Why this score?</summary>
        <p>The score reflects how consistently the evaluated carry, hedge, Safety Buffer, capital-risk, impairment, and data-quality conditions support {action}.</p>
        <ul>{result.primary_drivers.filter((driver) => driver.state !== "unavailable").slice(0, 4).map((driver) => <li key={driver.metric}>{driver.explanation}</li>)}</ul>
      </details>
    </section>
  );
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
      <div className="wallet-section-heading"><div><span>Exposure map</span><h2>Exposure Analysis</h2></div></div>
      <div className="wallet-exposure-grid">
        {metrics.map(([label, value, copy]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>)}
      </div>
    </section>
  );
}

function RiskBreakdown({ result }: { result: WalletPortfolioResponse }) {
  const risk = result.risk_metrics;
  const summary = result.portfolio_summary;
  const metrics = [
    ["Safety Buffer", number(risk.safety_buffer_score, 1), "Collateral resilience after hedge and impairment penalties."],
    ["Estimated Impairment", `${usd(risk.estimated_impairment_loss_usd)} · ${percent(risk.estimated_impairment_loss_pct)}`, "Scenario loss relative to pre-stress equity."],
    ["Post-Impairment Equity", usd(risk.post_impairment_equity_usd), "Estimated equity remaining after the selected stress profile."],
    ["Hedge Ratio", number(risk.hedge_ratio, 3), "Short exposure relative to supported long exposure."],
    ["Hedge Drift", percent(risk.hedge_drift_pct), "Distance from the configured hedge relationship."],
    ["Funding Exposure", percent(summary.estimated_funding_exposure_apy), "Estimated annualized funding bias when reliable."],
    ["Collateral Health", number(risk.collateral_health_score, 1), "Collateral coverage from supported protocol data."],
    ["Liquidation Proximity", percent(risk.liquidation_proximity_pct), "Higher values indicate greater proximity to liquidation."],
    ["Capital at Risk", usd(risk.capital_at_risk_proxy), "Deterministic proxy combining delta, debt, and impairment."],
  ];
  return (
    <section className="wallet-report-section">
      <div className="wallet-section-heading"><div><span>Risk diagnostics</span><h2>Risk Breakdown</h2></div></div>
      <div className="wallet-risk-grid">
        {metrics.map(([label, value, copy]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{copy}</p></article>)}
      </div>
    </section>
  );
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

function ExportActions({ result }: { result: WalletPortfolioResponse }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const payload = JSON.stringify(result, null, 2);

  function downloadJson() {
    try {
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `deltazero-wallet-${result.wallet_address.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFeedback("JSON report downloaded.");
    } catch {
      setFeedback("JSON download failed.");
    }
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(payload);
      setFeedback("API response copied.");
    } catch {
      setFeedback("Copy failed. Clipboard access may be unavailable.");
    }
  }

  return (
    <div className="wallet-export-row">
      <button type="button" onClick={downloadJson}>Download JSON</button>
      <button type="button" onClick={() => void copyResponse()}>Copy API Response</button>
      <span role="status" aria-live="polite">{feedback}</span>
    </div>
  );
}

function InstitutionalReport({ result, protocols }: { result: WalletPortfolioResponse; protocols: WalletProtocol[] }) {
  return (
    <>
      {result.assessment_status === "partial_data" ? (
        <section className="panel wallet-status-banner wallet-partial-banner">
          <span className="decision-label">PARTIAL PORTFOLIO COVERAGE</span>
          <p>This assessment includes only the supported positions successfully retrieved. Do not treat it as a complete wallet inventory.</p>
        </section>
      ) : null}
      <div className="report-breadcrumb" aria-label="Report location"><span>Wallet Auditor</span><i aria-hidden="true">/</i><strong>Portfolio Intelligence Report</strong></div>
      <AssessmentHeader result={result} protocols={protocols} />
      <ExecutiveSummary result={result} />
      <PrimaryDrivers drivers={result.primary_drivers} />
      <ExposureAnalysis result={result} />
      <RiskBreakdown result={result} />
      <PortfolioAllocation result={result} />
      <RecommendedPlan result={result} />
      <PositionTable positions={result.positions} />
      <StressSummary result={result} />
      <ProtocolWarnings result={result} />
      <ExportActions result={result} />
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
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      setResult(await analyzeWallet(value));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Unable to analyze the wallet.");
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
        <div><p className="kicker">Wallet Auditor</p><h1>Read-only wallet portfolio analysis</h1><div className="wallet-pro-badge">PRO PREVIEW</div><p>Audit supported public wallet positions and receive a read-only DeltaZero risk assessment.</p></div>
        <div className="wallet-page-side"><span className="endpoint">POST /wallet/analyze</span><p className="wallet-readonly-note">DeltaZero only reads public wallet and protocol data. It never requests signatures, private keys, or transaction permissions.</p></div>
      </header>
      <div className="workspace-grid wallet-workspace-grid">
        <WalletRequestForm value={value} setValue={setValue} submit={submit} loading={loading} />
        <div className="result-region">
          {error ? (
            <div className="error-box" role="alert"><span className="state-icon">!</span><div><strong>Analysis could not be completed</strong><p>{error}</p><small>Check the wallet address and selected protocol coverage, then try again.</small></div></div>
          ) : loading ? (
            <div className="panel loading-state"><div><div className="spinner" /><strong>Auditing wallet</strong><p>Querying public protocol views and consolidating risk signals…</p></div></div>
          ) : result ? (
            <div className="result-stack">
              {result.assessment_status === "no_supported_positions" ? (
                <section className="panel wallet-empty-card wallet-portfolio-status-card">
                  <span className="decision-label">PORTFOLIO STATUS</span><h2>NO SUPPORTED POSITIONS</h2><p>DeltaZero checked the selected networks and protocols but found no supported open positions for this wallet.</p>
                  <div className="wallet-empty-meta">
                    {[["Wallet address", result.wallet_address], ["Protocols checked", value.protocols.join(", ")], ["Networks checked", value.networks.join(", ")], ["Supported positions", String(result.supported_positions_found)], ["Assessment time", result.data_timestamp ?? "Unavailable"]].map(([label, text]) => <div key={label}><label>{label}</label><strong>{text}</strong></div>)}
                  </div>
                  <div className="wallet-empty-action">Try another wallet or select different networks and protocols.</div>
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
            <div className="panel empty-state"><div><div className="empty-icon">◌</div><strong>Ready for wallet analysis</strong><p>Enter a public wallet address, choose the networks and protocols to inspect, then submit to generate a read-only risk report.</p><small>No signatures, private keys, or transaction permissions are requested.</small></div></div>
          )}
        </div>
      </div>
    </div>
  );
}
