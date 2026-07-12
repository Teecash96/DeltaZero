"use client";

import { useState, type FormEvent } from "react";

import { analyzeWallet } from "@/lib/api";
import { RiskGauge } from "@/components/risk-gauge";
import type {
  NormalizedPosition,
  WalletAnalyzeRequest,
  WalletPortfolioResponse,
  WalletNetwork,
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
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

function percent(value: number | null | undefined, maximumFractionDigits = 1) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(maximumFractionDigits)}%`;
}

function metricStateClass(value: boolean) {
  return value ? "signal-positive" : "signal-warning";
}

function toggleValue<T extends string>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function walletHealthCopy(health: WalletPortfolioResponse["strategy_health"]) {
  if (!health) return "No strategy health is available for this wallet assessment.";
  switch (health) {
    case "healthy":
      return "Current risk posture is within acceptable limits.";
    case "warning":
      return "Monitor the position and avoid increasing exposure.";
    case "fragile":
      return "The assessment is partial or impairment is material. Verify the wallet before adding risk.";
    case "critical":
    default:
      return "Risk requires adjustment before execution.";
  }
}

function WalletAssessment({
  result,
}: {
  result: WalletPortfolioResponse;
}) {
  const action = result.recommendation?.action ?? "REBALANCE";
  const actionCopy =
    action === "HOLD"
      ? "The portfolio currently meets the read-only risk criteria."
      : action === "REBALANCE"
        ? "The portfolio needs a hedge or delta adjustment."
        : action === "REDUCE"
          ? "The wallet carries elevated risk and should be scaled down."
          : "The wallet has multiple severe conditions and should be de-risked.";

  const incomplete = result.data_quality !== "complete";
  const safetyBufferScore = result.risk_metrics.safety_buffer_score;
  const impairmentLossPct = result.risk_metrics.estimated_impairment_loss_pct;
  const signals = [
    { label: "Supported positions", positive: result.supported_positions_found > 0 },
    { label: "Partial data", positive: result.data_quality === "partial" },
    { label: "Collateral healthy", positive: (safetyBufferScore ?? 0) >= 60 },
    { label: "Impairment contained", positive: (impairmentLossPct ?? 100) < 10 },
  ];

  return (
    <section className="panel decision-card wallet-decision-card">
      <div className="assessment-main">
        <div className="assessment-heading">
          <span className="assessment-icon" aria-hidden="true">
            Δ
          </span>
          <p className="decision-eyebrow">AI Portfolio Assessment</p>
        </div>
        <div className="decision-summary-row">
          <div>
            <span className="decision-label">Recommended Action</span>
            <strong className={`action-value action-${action.toLowerCase()}`}>{action}</strong>
          </div>
          <div className="decision-confidence">
            <RiskGauge
              value={result.decision_confidence ?? 0}
              max={100}
              tone="positive"
              label="Decision clarity"
              caption="Confidence reflects how clearly the current metrics support the recommended action, not profitability."
              suffix="%"
              size="sm"
            />
            <p>Confidence reflects how clearly the current metrics support the recommended action, not profitability.</p>
          </div>
        </div>
        <h2>{actionCopy}</h2>
        {result.recommendation ? <p className="recommendation-reason">{result.recommendation.summary}</p> : null}
        <div className="assessment-signals" aria-label="Portfolio signals">
          {signals.map((signal) => (
            <span key={signal.label} className={`signal-chip ${metricStateClass(signal.positive)}`}>
              <b aria-hidden="true">{signal.positive ? "✓" : "!"}</b>
              <span>{signal.label}</span>
            </span>
          ))}
        </div>
        {incomplete && (
          <p className="wallet-status-note">
            Partial-data warnings are visible below. This report remains read-only and should not be treated as a full
            wallet inventory if any protocol view failed.
          </p>
        )}
      </div>
      <div className="health-context">
        <div>
          <span className="decision-label">Strategy Health</span>
          <strong className={`health-value ${result.strategy_health ? `health-${result.strategy_health}` : ""}`}>
            {result.strategy_health ?? "—"}
          </strong>
        </div>
        <p>{walletHealthCopy(result.strategy_health)}</p>
      </div>
      <div className="decision-rationale">
        <span>Why this decision</span>
        <ul>
          {result.risk_notes.slice(0, 3).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function walletStatusMessage(result: WalletPortfolioResponse) {
  if (result.assessment_status === "no_supported_positions") {
    return {
      title: "No supported positions found",
      body: "DeltaZero checked the selected networks and protocols but found no supported open positions for this wallet.",
    };
  }
  if (result.assessment_status === "insufficient_data") {
    return {
      title: "Assessment incomplete",
      body: "DeltaZero could not complete the wallet assessment because one or more selected data sources were unavailable.",
    };
  }
  if (result.assessment_status === "partial_data") {
    return {
      title: "Partial portfolio coverage",
      body: "This assessment includes only the supported positions successfully retrieved. Do not treat it as a complete wallet inventory.",
    };
  }
  if (result.unsupported_positions_found > 0) {
    return {
      title: "Unsupported positions found",
      body: "DeltaZero detected additional positions that are outside the currently supported protocol set.",
    };
  }
  return null;
}

function WalletMetricCard({
  label,
  value,
  helper,
  state,
  primary,
}: {
  label: string;
  value: string;
  helper: string;
  state: boolean;
  primary: boolean;
}) {
  return (
    <article className={`metric-card ${primary ? "metric-primary" : "metric-secondary"} ${state ? "signal-positive" : "signal-warning"}`}>
      <div className="metric-topline">
        <label>{label}</label>
        <span>{state ? "Positive" : "Warning"}</span>
      </div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function WalletMetrics({ result }: { result: WalletPortfolioResponse }) {
  const { portfolio_summary: summary, risk_metrics: risk } = result;
  const currentValue = usd(summary.current_position_value_usd);
  const impairment = usd(risk.estimated_impairment_loss_usd);
  const postImpairment = usd(risk.post_impairment_equity_usd);
  const safetyBuffer = risk.safety_buffer_score;
  const estimatedImpairmentPct = risk.estimated_impairment_loss_pct;
  const hedgeRatio = risk.hedge_ratio;
  const hedgeDrift = risk.hedge_drift_pct;
  const collateralHealth = risk.collateral_health_score;
  const liquidationProximity = risk.liquidation_proximity_pct;
  const capitalAtRisk = risk.capital_at_risk_proxy;

  const primary = [
    {
      label: "Safety Buffer",
      value: safetyBuffer === null ? "—" : safetyBuffer.toFixed(1),
      helper:
        safetyBuffer === null
          ? "No supported positions found"
          : `Collateral resilience · ${safetyBuffer >= 70 ? "Healthy" : safetyBuffer >= 60 ? "Acceptable" : "Weak"}`,
      state: (safetyBuffer ?? 0) >= 60,
    },
    {
      label: "Estimated Impairment Loss",
      value: impairment,
      helper: estimatedImpairmentPct === null ? "No supported positions found" : `${percent(estimatedImpairmentPct)} of pre-stress equity`,
      state: (estimatedImpairmentPct ?? 100) < 10,
    },
    {
      label: "Post-Impairment Equity",
      value: postImpairment,
      helper: postImpairment === "—" ? "No supported positions found" : (risk.post_impairment_equity_usd ?? 0) > 0 ? "Equity remains above zero" : "Equity is critically weak",
      state: (risk.post_impairment_equity_usd ?? 0) > 0,
    },
    {
      label: "Hedge Ratio",
      value: hedgeRatio === null ? "—" : hedgeRatio.toFixed(3),
      helper: hedgeRatio === null ? "No supported hedge data" : `Drift ${percent(hedgeDrift)}`,
      state: (hedgeDrift ?? 100) <= 8,
    },
  ];

  const secondary = [
    {
      label: "Current position value",
      value: currentValue,
      helper: "Aggregated from supported public positions",
      state: summary.current_position_value_usd > 0,
    },
    {
      label: "Unrealized gain or loss",
      value: usd(summary.unrealized_pnl_usd),
      helper: summary.unrealized_pnl_usd === null ? "Not reliably available" : "Read-only mark-to-market",
      state: (summary.unrealized_pnl_usd ?? 0) >= 0,
    },
    {
      label: "Gross long exposure",
      value: usd(summary.gross_long_exposure_usd),
      helper: "Supply, spot, vault, and long exposure",
      state: summary.gross_long_exposure_usd >= summary.gross_short_exposure_usd,
    },
    {
      label: "Gross short exposure",
      value: usd(summary.gross_short_exposure_usd),
      helper: "Perpetual shorts and borrow exposure",
      state: summary.gross_short_exposure_usd > 0,
    },
    {
      label: "Net delta",
      value: usd(summary.net_delta_usd),
      helper: `${percent(summary.net_delta_pct)} of current position value`,
      state: Math.abs(summary.net_delta_pct) <= 10,
    },
    {
      label: "Collateral health",
      value: collateralHealth === null ? "—" : collateralHealth.toFixed(1),
      helper: risk.minimum_health_factor === null ? "No debt or collateral data" : `Min HF ${risk.minimum_health_factor.toFixed(2)}`,
      state: (collateralHealth ?? 0) >= 60,
    },
    {
      label: "Liquidation proximity",
      value: percent(liquidationProximity),
      helper: liquidationProximity === null ? "Health factor unavailable" : "Closer to liquidation is worse",
      state: (liquidationProximity ?? 100) <= 35,
    },
    {
      label: "Funding exposure",
      value: summary.estimated_funding_exposure_apy === null ? "—" : `${summary.estimated_funding_exposure_apy.toFixed(1)}%`,
      helper: summary.estimated_funding_exposure_apy === null ? "Not enough data" : "Estimated carry/funding bias",
      state: (summary.estimated_funding_exposure_apy ?? 0) >= 0,
    },
    {
      label: "Capital at risk",
      value: capitalAtRisk === null ? "—" : usd(capitalAtRisk),
      helper: capitalAtRisk === null ? "No supported positions found" : "Read-only proxy from supported positions",
      state: (capitalAtRisk ?? 0) < 2000,
    },
  ];

  return (
    <section className="metrics-section">
      <div className="section-label-row">
        <h2 className="panel-title">Portfolio metrics</h2>
        <span>Read-only aggregation</span>
      </div>
      <div className="primary-metrics-grid wallet-primary-metrics">
        {primary.map((card) => (
          <WalletMetricCard key={card.label} {...card} primary />
        ))}
      </div>
      <div className="secondary-metrics-grid wallet-secondary-metrics">
        {secondary.map((card) => (
          <WalletMetricCard key={card.label} {...card} primary={false} />
        ))}
      </div>
    </section>
  );
}

function PositionList({ positions }: { positions: NormalizedPosition[] }) {
  if (positions.length === 0) {
    return (
      <section className="panel wallet-empty-card">
        <h2 className="panel-title">Detected positions</h2>
        <p className="panel-copy">No supported positions were found for the selected networks and protocols.</p>
      </section>
    );
  }

  return (
    <section className="panel wallet-position-panel">
      <h2 className="panel-title">Detected positions</h2>
      <div className="wallet-position-list">
        {positions.map((position) => (
          <article key={`${position.protocol}-${position.network}-${position.asset}-${position.position_type}-${position.data_timestamp ?? ""}`} className="wallet-position-card">
            <div className="wallet-position-head">
              <strong>{position.asset}</strong>
              <span>{position.protocol} · {position.network}</span>
            </div>
            <div className="wallet-position-grid">
              <div><label>Type</label><strong>{position.position_type.replaceAll("_", " ")}</strong></div>
              <div><label>Current value</label><strong>{usd(position.current_value_usd)}</strong></div>
              <div><label>Unrealized PnL</label><strong>{usd(position.unrealized_pnl_usd)}</strong></div>
              <div><label>Collateral</label><strong>{usd(position.collateral_usd)}</strong></div>
              <div><label>Debt</label><strong>{usd(position.debt_usd)}</strong></div>
              <div><label>Health factor</label><strong>{position.health_factor === null ? "—" : position.health_factor.toFixed(2)}</strong></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProtocolWarnings({
  protocolErrors,
  warnings,
}: {
  protocolErrors: WalletPortfolioResponse["protocol_errors"];
  warnings: string[];
}) {
  return (
    <section className="panel wallet-warning-panel">
      <h2 className="panel-title">Protocol warnings</h2>
      {protocolErrors.length === 0 && warnings.length === 0 ? (
        <p className="panel-copy">No protocol warnings were returned by the wallet auditor.</p>
      ) : (
        <ul className="risk-list">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          {protocolErrors.map((error) => (
            <li key={`${error.protocol}-${error.network}-${error.message}`}>
              {error.protocol} on {error.network}: {error.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
  const toggleNetwork = (network: WalletNetwork) => {
    setValue({ ...value, networks: toggleValue(value.networks, network) });
  };

  const toggleProtocol = (protocol: WalletProtocol) => {
    setValue({ ...value, protocols: toggleValue(value.protocols, protocol) });
  };

  return (
    <form className="panel wallet-form" onSubmit={submit}>
      {fieldGroups.map((group) => (
        <section className="form-section" key={group.title}>
          <h2>
            <span aria-hidden="true">{group.icon}</span>
            {group.title}
          </h2>
          <p className="panel-copy">{group.description}</p>
          {group.title === "Wallet inputs" && (
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
                  {PROFILE_OPTIONS.map((profile) => (
                    <option key={profile.value} value={profile.value}>
                      {profile.label}
                    </option>
                  ))}
                </select>
                <small>{PROFILE_OPTIONS.find((profile) => profile.value === value.stress_profile)?.note}</small>
              </div>
            </div>
          )}
          {group.title === "Networks" && (
            <div className="wallet-choice-grid">
              {NETWORK_OPTIONS.map((option) => (
                <label key={option.value} className={`wallet-choice ${value.networks.includes(option.value) ? "wallet-choice-active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={value.networks.includes(option.value)}
                    onChange={() => toggleNetwork(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.note}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {group.title === "Protocols" && (
            <div className="wallet-choice-grid">
              {PROTOCOL_OPTIONS.map((option) => (
                <label key={option.value} className={`wallet-choice ${value.protocols.includes(option.value) ? "wallet-choice-active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={value.protocols.includes(option.value)}
                    onChange={() => toggleProtocol(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.note}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
      ))}
      <button className="button button-primary form-submit" disabled={loading}>
        {loading ? (
          "Auditing wallet..."
        ) : (
          <>
            Audit Wallet or Positions
            <span>→</span>
          </>
        )}
      </button>
      <p className="form-note">Read-only analysis · no transaction permissions</p>
    </form>
  );
}

export function WalletPortfolioWorkspace() {
  const [value, setValue] = useState<WalletAnalyzeRequest>(() => structuredClone(DEFAULT_REQUEST));
  const [result, setResult] = useState<WalletPortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const statusMessage = result ? walletStatusMessage(result) : null;

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const response = await analyzeWallet(value);
      setResult(response);
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

  const successfulProtocols = result
    ? value.protocols.filter((protocol) => !result.protocol_errors.some((error) => error.protocol === protocol))
    : [];
  const failedProtocols = result ? result.protocol_errors.map((error) => `${error.protocol} · ${error.network}`) : [];

  return (
    <div className="workspace">
      <header className="page-intro wallet-page-intro">
        <div>
          <p className="kicker">Wallet Auditor</p>
          <h1>Read-only wallet portfolio analysis</h1>
          <div className="wallet-pro-badge">PRO PREVIEW</div>
          <p>
            Audit supported public wallet positions and receive a read-only DeltaZero risk assessment.
          </p>
        </div>
        <div className="wallet-page-side">
          <span className="endpoint">POST /wallet/analyze</span>
          <p className="wallet-readonly-note">
            DeltaZero only reads public wallet and protocol data. It never requests signatures, private keys, or
            transaction permissions.
          </p>
        </div>
      </header>
      <div className="workspace-grid wallet-workspace-grid">
        <WalletRequestForm value={value} setValue={setValue} submit={submit} loading={loading} />
        <div className="result-region">
          {error ? (
            <div className="error-box" role="alert">
              <span className="state-icon">!</span>
              <div>
                <strong>Analysis could not be completed</strong>
                <p>{error}</p>
                <small>Check the wallet address and selected protocol coverage, then try again.</small>
              </div>
            </div>
          ) : loading ? (
            <div className="panel loading-state">
              <div>
                <div className="spinner" />
                <strong>Auditing wallet</strong>
                <p>Querying public protocol views and consolidating risk signals…</p>
              </div>
            </div>
          ) : result ? (
            <div className="result-stack">
              {result.assessment_status === "no_supported_positions" ? (
                <section className="panel wallet-empty-card wallet-portfolio-status-card">
                  <span className="decision-label">PORTFOLIO STATUS</span>
                  <h2>NO SUPPORTED POSITIONS</h2>
                  <p>
                    DeltaZero checked the selected networks and protocols but found no supported open positions for this
                    wallet.
                  </p>
                  <div className="wallet-empty-meta">
                    {[
                      ["Wallet address", result.wallet_address],
                      ["Protocols checked", value.protocols.join(", ")],
                      ["Networks checked", value.networks.join(", ")],
                      ["Supported positions", String(result.supported_positions_found)],
                      ["Assessment time", result.data_timestamp ?? "—"],
                    ].map(([label, text]) => (
                      <div key={label}>
                        <label>{label}</label>
                        <strong>{text}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="wallet-empty-action">Try another wallet or select different networks and protocols.</div>
                </section>
              ) : result.assessment_status === "insufficient_data" ? (
                <section className="panel wallet-empty-card wallet-incomplete-card">
                  <span className="decision-label">ASSESSMENT INCOMPLETE</span>
                  <h2>
                    DeltaZero could not verify whether this wallet holds supported positions because one or more data
                    sources failed.
                  </h2>
                  <p>
                    DeltaZero could not complete the wallet assessment because one or more selected data sources were
                    unavailable.
                  </p>
                  <div className="wallet-empty-meta">
                    <div>
                      <label>Successful protocol checks</label>
                      <strong>{successfulProtocols.length > 0 ? successfulProtocols.join(", ") : "None"}</strong>
                    </div>
                    <div>
                      <label>Failed protocol checks</label>
                      <strong>{failedProtocols.length > 0 ? failedProtocols.join(", ") : "None"}</strong>
                    </div>
                    <div>
                      <label>Warnings</label>
                      <strong>{result.warnings.length > 0 ? result.warnings.join(" · ") : "None"}</strong>
                    </div>
                  </div>
                  <button className="button button-primary form-submit" type="button" onClick={() => void runAnalysis()}>
                    Retry Analysis
                    <span>→</span>
                  </button>
                </section>
              ) : (
                <>
                  {statusMessage ? (
                    <section className="panel wallet-status-banner">
                      <div>
                        <span className="decision-label">{statusMessage.title}</span>
                        <p>{statusMessage.body}</p>
                      </div>
                    </section>
                  ) : null}
                  {result.assessment_status === "partial_data" ? (
                    <section className="panel wallet-status-banner wallet-partial-banner">
                      <div>
                        <span className="decision-label">PARTIAL PORTFOLIO COVERAGE</span>
                        <p>
                          This assessment includes only the supported positions successfully retrieved. Do not treat it
                          as a complete wallet inventory.
                        </p>
                      </div>
                    </section>
                  ) : null}
                  <div className="report-breadcrumb" aria-label="Report location">
                    <span>Wallet Auditor</span>
                    <i aria-hidden="true">/</i>
                    <strong>PRO Preview</strong>
                  </div>
                  <section className="panel summary-card">
                    <div className="summary-heading">
                      <div>
                        <span className="summary-meta">Analysis complete · {result.service}</span>
                        <h2>AI Portfolio Assessment</h2>
                      </div>
                      <span className="summary-check">Read only</span>
                    </div>
                    <div className="summary-grid wallet-summary-grid">
                      {[
                        ["Wallet", result.wallet_address],
                        ["Data quality", result.data_quality],
                        ["Assessment status", result.assessment_status],
                        ["Supported positions", String(result.supported_positions_found)],
                        ["Unsupported positions", String(result.unsupported_positions_found)],
                        ["Protocol warnings", String(result.protocol_errors.length)],
                        ["Assessment time", result.data_timestamp ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <label>{label}</label>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <WalletAssessment result={result} />
                  <section className={`panel safety-hero ${((result.risk_metrics.safety_buffer_score ?? 0) >= 80 ? "safety-strong" : (result.risk_metrics.safety_buffer_score ?? 0) >= 70 ? "safety-healthy" : (result.risk_metrics.safety_buffer_score ?? 0) >= 60 ? "safety-acceptable" : "safety-weak")}`}>
                    <div>
                      <span className="safety-kicker">Primary risk signal</span>
                      <h2>Safety Buffer</h2>
                      <p>Collateral resilience score</p>
                    </div>
      <div className="safety-score">
        <RiskGauge
          value={result.risk_metrics.safety_buffer_score ?? 0}
          max={100}
          tone={(result.risk_metrics.safety_buffer_score ?? 0) >= 80 ? "positive" : (result.risk_metrics.safety_buffer_score ?? 0) >= 60 ? "warning" : "danger"}
          label={(result.risk_metrics.safety_buffer_score ?? 0) >= 80 ? "Strong" : (result.risk_metrics.safety_buffer_score ?? 0) >= 70 ? "Healthy" : (result.risk_metrics.safety_buffer_score ?? 0) >= 60 ? "Acceptable" : "Weak"}
          caption="Collateral resilience"
          size="md"
        />
      </div>
                  </section>
                  <WalletMetrics result={result} />
                  <section className="panel wallet-actions-panel">
                    <h2 className="panel-title">Corrective actions</h2>
                    <div className="actions-row">
                      {result.corrective_actions.map((action, index) => (
                        <span key={action}>
                          <b>{index + 1}</b>
                          {action}
                        </span>
                      ))}
                    </div>
                  </section>
                  <PositionList positions={result.positions} />
                  <ProtocolWarnings protocolErrors={result.protocol_errors} warnings={result.warnings} />
                  <details className="panel json-box">
                    <summary>
                      <span>
                        <b>Raw JSON</b>
                        <small>Developer payload</small>
                      </span>
                      <i aria-hidden="true">⌄</i>
                    </summary>
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  </details>
                </>
              )}
            </div>
          ) : (
            <div className="panel empty-state">
              <div>
                <div className="empty-icon">◌</div>
                <strong>Ready for wallet analysis</strong>
                <p>
                  Enter a public wallet address, choose the networks and protocols to inspect, then submit to generate a
                  read-only risk report.
                </p>
                <small>No signatures, private keys, or transaction permissions are requested.</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
