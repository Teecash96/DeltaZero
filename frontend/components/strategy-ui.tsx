"use client";

import { useEffect, useState, type FormEvent } from "react";

import { auditStrategy, buildStrategy, getHyperliquidMarket, PaymentRequiredError, stressTestStrategy, type X402Challenge } from "@/lib/api";
import { MONTE_CARLO_HANDOFF_KEY, MONTE_CARLO_RESULT_KEY, readSession, STRESS_HANDOFF_KEY, WALLET_HANDOFF_KEY, type MonteCarloHandoff, type MonteCarloResultHandoff, type StressHandoff } from "@/lib/handoff";
import { AUDIT_SAMPLE, BUILD_SAMPLE, STRESS_TEST_SAMPLE } from "@/lib/samples";
import { RiskGauge } from "@/components/risk-gauge";
import { AnalysisConfidence, DeltaZeroVerdict, PaymentRequiredCard, recommendationLabel, ReportActions, StepProgress } from "@/components/report-polish";
import type {
  AuditRequest,
  AuditResponse,
  BuildRequest,
  BuildResponse,
  Metrics,
  RiskTolerance,
  ScenarioType,
  StressTestRequest,
  StressTestResponse,
  TargetStyle,
  HyperliquidMarketResponse,
  WalletExposureImport,
} from "@/lib/types";

type Mode = "builder" | "auditor" | "stress-test";
type FormValue = BuildRequest | AuditRequest | StressTestRequest;
type ResultValue = BuildResponse | AuditResponse | StressTestResponse;

type DecisionSupportState = "positive" | "warning";

const copy = {
  builder: {
    kicker: "Design from first principles",
    title: "Deterministic Strategy Builder",
    description:
      "Set your capital, carry assumptions, and risk posture. DeltaZero returns a balanced structure and an explicit entry decision.",
    endpoint: "POST /strategy/build",
    submit: "Analyze Strategy",
  },
  auditor: {
    kicker: "Inspect the position",
    title: "Position Auditor",
    description:
      "Assess an existing long and short structure for hedge alignment, carry quality, and collateral resilience.",
    endpoint: "POST /strategy/audit",
    submit: "Audit position",
  },
  "stress-test": {
    kicker: "Pressure before the market",
    title: "Portfolio Stress Simulator",
    description:
      "Apply a deterministic market shock and see how the position, health, and recommended action respond.",
    endpoint: "POST /strategy/stress-test",
    submit: "Run stress test",
  },
} satisfies Record<
  Mode,
  {
    kicker: string;
    title: string;
    description: string;
    endpoint: string;
    submit: string;
  }
>;

const samples = {
  builder: BUILD_SAMPLE,
  auditor: AUDIT_SAMPLE,
  "stress-test": STRESS_TEST_SAMPLE,
} satisfies Record<Mode, FormValue>;

const fieldLabels: Record<string, string> = {
  asset: "Asset",
  capital_usd: "Capital (USD)",
  risk_tolerance: "Risk tolerance",
  target_style: "Target style",
  long_notional_usd: "Long notional (USD)",
  short_notional_usd: "Short notional (USD)",
  collateral_usd: "Collateral (USD)",
  long_yield_apy: "Long yield APY (%)",
  short_funding_apy: "Short funding APY (%)",
  fee_drag_apy: "Fee drag APY (%)",
};

const fieldHelpers: Record<string, string> = {
  long_yield_apy: "Estimated annual yield from the long strategy.",
  short_funding_apy: "Estimated annual funding cost of the short hedge.",
  fee_drag_apy: "Estimated annual protocol and execution cost.",
  risk_tolerance: "Controls hedge and collateral targets.",
  target_style: "Defines the strategy construction objective.",
};

const styleOptions: Array<{ value: TargetStyle; label: string; helper: string }> = [
  {
    value: "neutral_yield",
    label: "Neutral yield",
    helper: "Balanced carry, near-neutral hedge, and adequate collateral.",
  },
  {
    value: "conservative_income",
    label: "Conservative income",
    helper: "More collateral resilience and lower capital risk.",
  },
  {
    value: "aggressive_carry",
    label: "Aggressive carry",
    helper: "Higher deployment and slightly wider hedge tolerance.",
  },
  {
    value: "capital_preservation",
    label: "Capital preservation",
    helper: "Largest collateral reserve and strict capital protection.",
  },
];

const hedgeRanges: Record<RiskTolerance, [number, number]> = {
  low: [0.92, 0.98],
  medium: [0.94, 0.98],
  high: [0.95, 0.99],
};

const builderHedgeTolerance: Record<TargetStyle, number> = {
  neutral_yield: 6,
  conservative_income: 4,
  aggressive_carry: 7,
  capital_preservation: 3,
};

const riskToleranceCapitalWarning: Record<RiskTolerance, number> = {
  low: 12,
  medium: 18,
  high: 22,
};

const riskToleranceHedgeWarning: Record<RiskTolerance, number> = {
  low: 4,
  medium: 6,
  high: 8,
};

function formatKey(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function usd(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

function metricStateClass(state: DecisionSupportState) {
  return state === "positive" ? "signal-positive" : "signal-warning";
}

function safetyBufferLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 70) return "Healthy";
  if (score >= 60) return "Acceptable";
  return "Weak";
}

function carryEfficiencyLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Moderate";
  return "Weak";
}

function hedgeDriftLabel(driftPct: number) {
  if (driftPct <= 4) return "Within tolerance";
  if (driftPct <= 8) return "Monitor drift";
  return "Rebalance needed";
}

function capitalRiskPct(request: FormValue, value: ResultValue) {
  const base =
    "capital_usd" in request
      ? request.capital_usd
      : request.long_notional_usd + request.collateral_usd;
  return base > 0 ? (value.metrics.capital_at_risk_proxy / base) * 100 : 0;
}

function safetyState(score: number): DecisionSupportState {
  return score >= 60 ? "positive" : "warning";
}

function carryState(carryApy: number): DecisionSupportState {
  return carryApy > 0 ? "positive" : "warning";
}

function capitalState(request: FormValue, value: ResultValue): DecisionSupportState {
  return capitalRiskPct(request, value) <= riskToleranceCapitalWarning[request.risk_tolerance]
    ? "positive"
    : "warning";
}

function carryEfficiencyState(score: number): DecisionSupportState {
  return score >= 50 ? "positive" : "warning";
}

function targetRangeForRequest(request: FormValue) {
  return hedgeRanges[request.risk_tolerance];
}

function hedgeThresholdForRequest(request: FormValue, mode: Mode) {
  if (mode === "builder" && "target_style" in request) {
    return builderHedgeTolerance[request.target_style];
  }

  return riskToleranceHedgeWarning[request.risk_tolerance];
}

function StrategyForm({
  mode,
  value,
  setValue,
  submit,
  loading,
  liveMarket,
  marketLoading,
  marketError,
  refreshMarket,
}: {
  mode: Mode;
  value: FormValue;
  setValue: (value: FormValue) => void;
  submit: (event: FormEvent) => void;
  loading: boolean;
  liveMarket: HyperliquidMarketResponse | null;
  marketLoading: boolean;
  marketError: string | null;
  refreshMarket: () => void;
}) {
  const update = (key: string, raw: string) =>
    setValue(
      {
        ...value,
        [key]: ["asset", "risk_tolerance", "target_style"].includes(key)
          ? raw
          : Number(raw),
      } as FormValue,
    );

  const available = new Set(Object.keys(value));
  const groups = [
    {
      title: "Strategy inputs",
      icon: "◇",
      keys: ["asset", "capital_usd", "long_notional_usd", "short_notional_usd", "collateral_usd"],
    },
    {
      title: "Market assumptions",
      icon: "↗",
      keys: ["long_yield_apy", "short_funding_apy", "fee_drag_apy"],
    },
    {
      title: "Risk settings",
      icon: "◎",
      keys: ["risk_tolerance", "target_style"],
    },
  ].map((group) => ({
    ...group,
    keys: group.keys.filter((key) => available.has(key)),
  }));

  const renderField = (key: string) => (
    <div className={`field ${fieldHelpers[key] ? "field-with-help" : ""}`} key={key}>
      <label htmlFor={`${mode}-${key}`}>{fieldLabels[key]}</label>
      {key === "asset" ? (
        <select
          id={`${mode}-${key}`}
          value={String(value[key as keyof FormValue])}
          onChange={(event) => update(key, event.target.value)}
        >
          <option value="SOL">SOL</option>
          <option value="ETH">ETH</option>
        </select>
      ) : key === "risk_tolerance" ? (
        <select
          id={`${mode}-${key}`}
          value={String(value[key as keyof FormValue])}
          onChange={(event) => update(key, event.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      ) : key === "target_style" ? (
        <select
          id={`${mode}-${key}`}
          value={String(value[key as keyof FormValue])}
          onChange={(event) => update(key, event.target.value)}
        >
          {styleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`${mode}-${key}`}
          type="number"
          step="any"
          min={key === "fee_drag_apy" ? 0 : undefined}
          value={Number(value[key as keyof FormValue])}
          onChange={(event) => update(key, event.target.value)}
          required
          disabled={mode === "builder" && key === "short_funding_apy" && (value as BuildRequest).market_data_mode === "hyperliquid" && !(value as BuildRequest).override_live_funding}
        />
      )}
      {key === "target_style" ? (
        <small>
          {
            styleOptions.find(
              (option) => option.value === (value as BuildRequest).target_style,
            )?.helper
          }
        </small>
      ) : (
        fieldHelpers[key] && <small>{fieldHelpers[key]}</small>
      )}
    </div>
  );

  return (
    <form className="panel" onSubmit={submit}>
      {mode === "builder" ? (
        <section className="form-section live-market-controls">
          <h2><span aria-hidden="true">◉</span>Input mode</h2>
          <div className="mode-toggle">
            <button type="button" className={(value as BuildRequest).market_data_mode !== "hyperliquid" ? "active" : ""} onClick={() => setValue({ ...value, market_data_mode: "manual" } as BuildRequest)}>Manual Assumptions</button>
            <button type="button" className={(value as BuildRequest).market_data_mode === "hyperliquid" ? "active" : ""} onClick={() => setValue({ ...value, market_data_mode: "hyperliquid" } as BuildRequest)}>Live Hyperliquid Data</button>
          </div>
          {(value as BuildRequest).market_data_mode === "hyperliquid" ? <div className="live-market-panel">
            <div className="field"><label htmlFor="funding-lookback">Funding lookback</label><select id="funding-lookback" value={(value as BuildRequest).funding_lookback_hours ?? 24} onChange={(event) => setValue({ ...value, funding_lookback_hours: Number(event.target.value) } as BuildRequest)}><option value="24">24 hours</option><option value="72">72 hours</option><option value="168">168 hours</option></select></div>
            <label className="override-check"><input type="checkbox" checked={(value as BuildRequest).override_live_funding ?? false} onChange={(event) => setValue({ ...value, override_live_funding: event.target.checked } as BuildRequest)} /> Override live value</label>
            <button type="button" className="market-refresh" onClick={refreshMarket} disabled={marketLoading}>{marketLoading ? "Refreshing…" : "Refresh market data"}</button>
            {marketError ? <p className="market-error">{marketError}</p> : liveMarket ? <div className="market-snapshot"><span>Live data source: Hyperliquid</span><strong>{liveMarket.current_funding_apy.toFixed(2)}% current funding</strong><small>{liveMarket.funding_direction.replaceAll("_", " ")} · {liveMarket.data_quality} · Updated {new Date(liveMarket.data_timestamp).toLocaleTimeString()}</small></div> : null}
          </div> : null}
        </section>
      ) : null}
      {groups.map((group) => (
        <section className="form-section" key={group.title}>
          <h2>
            <span aria-hidden="true">{group.icon}</span>
            {group.title}
          </h2>
          <div className="form-grid">{group.keys.map(renderField)}</div>
        </section>
      ))}
      {mode === "stress-test" && (
        <section className="form-section">
          <h2>
            <span aria-hidden="true">⚡</span>
            Stress scenario
          </h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="scenario-type">Scenario</label>
              <select
                id="scenario-type"
                value={(value as StressTestRequest).scenario.type}
                onChange={(event) =>
                  setValue({
                    ...value,
                    scenario: {
                      ...(value as StressTestRequest).scenario,
                      type: event.target.value as ScenarioType,
                    },
                  } as StressTestRequest)
                }
              >
                <option value="funding_worsens">Funding worsens</option>
                <option value="yield_drops">Yield drops</option>
                <option value="price_drop">Price drops</option>
                <option value="price_rise">Price rises</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="scenario-magnitude">Magnitude (%)</label>
              <input
                id="scenario-magnitude"
                type="number"
                min="0"
                step="any"
                required
                value={(value as StressTestRequest).scenario.magnitude_pct}
                onChange={(event) =>
                  setValue({
                    ...value,
                    scenario: {
                      ...(value as StressTestRequest).scenario,
                      magnitude_pct: Number(event.target.value),
                    },
                  } as StressTestRequest)
                }
              />
            </div>
          </div>
        </section>
      )}
      <button className="button button-primary form-submit" disabled={loading}>
        {loading ? "Analyzing strategy..." : (
          <>
            {copy[mode].submit}
            <span>→</span>
          </>
        )}
      </button>
      <p className="form-note">Values are preloaded · Edit any input</p>
    </form>
  );
}

function SafetyBufferCard({ score }: { score: number }) {
  const status = score >= 80 ? "strong" : score >= 70 ? "healthy" : score >= 60 ? "acceptable" : "weak";

  return (
    <section className={`panel safety-hero safety-${status}`}>
      <div className="safety-copy">
        <span className="safety-kicker">Primary risk signal</span>
        <h2>Safety Buffer</h2>
        <p>Collateral resilience score</p>
      </div>
      <RiskGauge
        value={score}
        max={100}
        tone={score >= 80 ? "positive" : score >= 60 ? "warning" : "danger"}
        label={safetyBufferLabel(score)}
        caption="Collateral resilience"
        size="md"
      />
    </section>
  );
}

function Summary({ result }: { result: ResultValue }) {
  const items = [
    ["Asset", result.asset],
    ["Strategy name", result.strategy_name],
    ["Strategy health", result.strategy_health],
    ["Recommendation", recommendationLabel(result.recommendation.action)],
    ["Estimated net carry APY", `${result.metrics.estimated_net_carry_apy.toFixed(1)}%`],
    ["Safety Buffer score", result.metrics.safety_buffer_score.toFixed(1)],
  ];

  return (
    <section className="panel summary-card">
      <div className="summary-heading">
        <div>
          <span className="summary-meta">Analysis complete · {result.service}</span>
          <h2>Strategy Risk Report</h2>
        </div>
        <span className="summary-check">✓ Complete</span>
      </div>
      <div className="summary-grid">
        {items.map(([label, value]) => (
          <div key={label}>
            <label>{label}</label>
            <strong
              className={
                label === "Strategy health"
                  ? `summary-state health-${result.strategy_health}`
                  : label === "Recommendation"
                    ? `summary-state action-${result.recommendation.action.toLowerCase()}`
                    : ""
              }
            >
              {value}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionPanel({
  result,
  request,
  mode,
}: {
  result: ResultValue;
  request: FormValue;
  mode: Mode;
}) {
  const action = result.recommendation.action;
  const displayAction = recommendationLabel(action);
  const needsSafetyWarning = ["WAIT", "REDUCE", "REBALANCE", "CLOSE"].includes(action);
  const shouldShowPositiveMessage = action === "OPEN" || action === "HOLD";
  const mainSentence = needsSafetyWarning
    ? "The proposed strategy does not currently satisfy DeltaZero's minimum safety requirements."
    : result.recommendation.summary;
  const healthMessage =
    result.strategy_health === "healthy"
      ? "Current risk posture is within acceptable limits."
      : result.strategy_health === "warning"
        ? action === "REBALANCE"
          ? "Adjust the hedge before maintaining or increasing exposure."
          : "Monitor the position and avoid increasing exposure."
        : action === "REDUCE"
          ? "Reduce risk before continuing."
          : action === "CLOSE"
            ? "Risk requires adjustment before execution."
            : "Risk requires adjustment before execution.";
  const confidenceSignals = [
    {
      label: "Positive carry",
      state: carryState(result.metrics.estimated_net_carry_apy),
    },
    {
      label: "Hedge within tolerance",
      state: result.metrics.hedge_drift_pct <= hedgeThresholdForRequest(request, mode) ? "positive" : "warning",
    },
    {
      label: "Adequate Safety Buffer",
      state: safetyState(result.metrics.safety_buffer_score),
    },
    {
      label: "Capital risk acceptable",
      state:
        capitalRiskPct(request, result) <= riskToleranceCapitalWarning[request.risk_tolerance]
          ? "positive"
          : "warning",
    },
  ] as const;
  const distinctNotes = result.risk_notes.filter((note) => note.trim() !== result.recommendation.summary.trim());
  const primaryCause = distinctNotes[0] ?? result.recommendation.summary;
  const expectedImprovement =
    mode === "builder" && "recommended_structure" in result
      ? `Target hedge ratio ${result.recommended_structure.target_hedge_ratio.toFixed(3)}`
      : "actions" in result && result.actions.length > 0
        ? formatKey(result.actions[0])
        : distinctNotes[1] ?? "Re-analyze after applying the recommendation";
  const timeHorizon =
    action === "OPEN" ? "Before opening" : action === "HOLD" ? "Next monitoring cycle" : action === "WAIT" ? "Before execution" : action === "REBALANCE" ? "Before increasing exposure" : "Immediate risk review";

  return (
    <section className="panel decision-card">
      <div className="assessment-main">
        <div className="assessment-heading">
          <span className="assessment-icon" aria-hidden="true">
            Δ
          </span>
          <p className="decision-eyebrow">Decision Assessment</p>
        </div>
        <div className="decision-summary-row">
          <div>
            <span className="decision-label">Recommended Action</span>
            <strong className={`action-value action-${action.toLowerCase()}`}>{displayAction}</strong>
          </div>
          <div className="decision-confidence">
            <AnalysisConfidence value={result.decision_confidence} />
          </div>
        </div>
        <h2>{mainSentence}</h2>
        {shouldShowPositiveMessage && <p className="recommendation-reason">{result.recommendation.summary}</p>}
        <div className="assessment-signals" aria-label="Decision signals">
          {confidenceSignals.map((signal) => (
            <span key={signal.label} className={`signal-chip ${metricStateClass(signal.state)}`}>
              <b aria-hidden="true">{signal.state === "positive" ? "✓" : "!"}</b>
              <span>{signal.label}</span>
            </span>
          ))}
        </div>
        <div className="decision-detail-grid">
          <div><span>Risk Level</span><strong className={`health-${result.strategy_health}`}>{result.strategy_health}</strong></div>
          <div><span>Primary Cause</span><strong>{primaryCause}</strong></div>
          <div><span>Expected Improvement</span><strong>{expectedImprovement}</strong></div>
          <div><span>Time Horizon</span><strong>{timeHorizon}</strong></div>
        </div>
      </div>
      <div className="health-context">
        <div>
          <span className="decision-label">Strategy Health</span>
          <strong className={`health-value health-${result.strategy_health}`}>{result.strategy_health}</strong>
        </div>
        <p>{healthMessage}</p>
      </div>
      <div className="decision-rationale">
        <span>Why this recommendation</span>
        <p>
          <strong>{displayAction}</strong> is the appropriate next step because {result.recommendation.summary.charAt(0).toLowerCase() + result.recommendation.summary.slice(1)}
          {distinctNotes[0] ? ` The report also identifies ${distinctNotes[0].charAt(0).toLowerCase() + distinctNotes[0].slice(1)}` : ""}
        </p>
        {distinctNotes.length > 1 ? <ul>{distinctNotes.slice(1, 3).map((note) => <li key={note}>{note}</li>)}</ul> : null}
      </div>
    </section>
  );
}

const structureIcons: Record<string, string> = {
  long_notional_usd: "↑",
  short_notional_usd: "↓",
  collateral_usd: "◇",
  target_hedge_ratio: "⚖",
};

const reportNames: Record<Mode, string> = {
  builder: "AI Strategy Report",
  auditor: "Position Risk Report",
  "stress-test": "Scenario Risk Report",
};

const reportSections: Record<Mode, string> = {
  builder: "Builder",
  auditor: "Auditor",
  "stress-test": "Stress Test",
};

function MetricCard({
  label,
  value,
  helper,
  state,
  primary,
  gauge,
}: {
  label: string;
  value: string;
  helper: string;
  state: DecisionSupportState;
  primary: boolean;
  gauge?: { value: number; max: number; tone: "positive" | "warning" | "danger"; label: string; caption: string; suffix?: string };
}) {
  return (
    <article className={`metric-card ${primary ? "metric-primary" : "metric-secondary"} ${metricStateClass(state)} ${gauge ? "metric-gauge-card" : ""}`}>
      <div className="metric-topline">
        <label>{label}</label>
        <span>{state === "positive" ? "Positive" : "Warning"}</span>
      </div>
      {gauge ? (
        <RiskGauge
          value={gauge.value}
          max={gauge.max}
          tone={gauge.tone}
          label={gauge.label}
          caption={gauge.caption}
          suffix={gauge.suffix}
          size={primary ? "md" : "sm"}
        />
      ) : (
        <strong>{value}</strong>
      )}
      <small>{helper}</small>
    </article>
  );
}

function MetricsView({
  metrics,
  request,
  result,
  mode,
}: {
  metrics: Metrics;
  request: FormValue;
  result: ResultValue;
  mode: Mode;
}) {
  const capitalPct = capitalRiskPct(request, result);
  const hedgeSupportState = metrics.hedge_drift_pct <= hedgeThresholdForRequest(request, mode) ? "positive" : "warning";
  const carryEfficiency = `${metrics.carry_efficiency_score.toFixed(1)} / 100`;
  const carryEfficiencyContext = carryEfficiencyLabel(metrics.carry_efficiency_score);
  const targetRange = targetRangeForRequest(request);
  const hedgeTarget = mode === "builder" && "recommended_structure" in result
    ? result.recommended_structure.target_hedge_ratio
    : null;
  const hedgeTargetCopy =
    hedgeTarget != null
      ? `Target: ${hedgeTarget.toFixed(3)}`
      : `Target range: ${targetRange[0].toFixed(2)}-${targetRange[1].toFixed(2)}`;

  const primaryCards: Array<{
    label: string;
    value: string;
    helper: string;
    state: DecisionSupportState;
  }> = [
    {
      label: "Safety Buffer",
      value: metrics.safety_buffer_score.toFixed(1),
      helper: `${safetyBufferLabel(metrics.safety_buffer_score)} · Collateral resilience score`,
      state: safetyState(metrics.safety_buffer_score),
    },
    {
      label: "Estimated net carry APY",
      value: `${metrics.estimated_net_carry_apy.toFixed(1)}%`,
      helper: metrics.estimated_net_carry_apy > 0 ? "Positive carry after funding and fees" : "Carry is not yet acceptable",
      state: carryState(metrics.estimated_net_carry_apy),
    },
    {
      label: "Hedge ratio",
      value: metrics.hedge_ratio.toFixed(3),
      helper: `Actual: ${metrics.hedge_ratio.toFixed(3)} · ${hedgeTargetCopy}`,
      state: hedgeSupportState,
    },
  ];

  const secondaryCards: Array<{
    label: string;
    value: string;
    helper: string;
    state: DecisionSupportState;
    gauge?: { value: number; max: number; tone: "positive" | "warning" | "danger"; label: string; caption: string; suffix?: string };
  }> = [
    {
      label: "Hedge drift",
      value: `${metrics.hedge_drift_pct.toFixed(1)}%`,
      helper: hedgeDriftLabel(metrics.hedge_drift_pct),
      state: hedgeSupportState,
      gauge: {
        value: metrics.hedge_drift_pct,
        max: Math.max(hedgeThresholdForRequest(request, mode), metrics.hedge_drift_pct, 1),
        tone: hedgeSupportState === "positive" ? "positive" : "warning",
        label: "Hedge drift",
        caption: `Threshold ${hedgeThresholdForRequest(request, mode).toFixed(1)}%`,
        suffix: "%",
      },
    },
    {
      label: "Net delta estimate",
      value: `${metrics.net_delta_estimate > 0 ? "+" : ""}${metrics.net_delta_estimate.toFixed(1)}%`,
      helper: metrics.net_delta_estimate > 0 ? "Long exposure dominates" : "Short exposure dominates",
      state: Math.abs(metrics.net_delta_estimate) <= 5 ? "positive" : "warning",
    },
    {
      label: "Carry efficiency",
      value: carryEfficiency,
      helper: carryEfficiencyContext,
      state: carryEfficiencyState(metrics.carry_efficiency_score),
    },
    {
      label: "Capital at risk",
      value: usd(metrics.capital_at_risk_proxy),
      helper: `${capitalPct.toFixed(1)}% of submitted capital`,
      state: capitalState(request, result),
    },
  ];

  return (
    <section className="metrics-section">
      <div className="section-label-row">
        <h2 className="panel-title">Core metrics</h2>
        <span>Deterministic output</span>
      </div>
      <div className="primary-metrics-grid">
        {primaryCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            state={card.state}
            primary
          />
        ))}
      </div>
      <div className="secondary-metrics-grid">
        {secondaryCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            state={card.state}
            primary={false}
            gauge={"gauge" in card ? card.gauge : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function StrategyBlueprint({ result, request }: { result: BuildResponse; request: BuildRequest }) {
  const cards = [
    ["Expected Net Carry", `${result.metrics.estimated_net_carry_apy.toFixed(1)}%`, "Annualized carry after submitted funding and fee assumptions."],
    ["Estimated Hedge Cost", `${request.short_funding_apy.toFixed(1)}%`, "Submitted annual funding cost for the short hedge."],
    ["Capital Efficiency", `${result.metrics.carry_efficiency_score.toFixed(1)} / 100`, "Existing carry efficiency score for the proposed structure."],
    ["Safety Buffer", `${result.metrics.safety_buffer_score.toFixed(1)} / 100`, "Existing resilience score for the evaluated structure."],
    ["Expected Drawdown", "Unavailable", "Run Stress Test to measure scenario impairment."],
    ["Recommendation", recommendationLabel(result.recommendation.action), result.recommendation.summary],
  ];

  return (
    <section className="panel strategy-blueprint">
      <div className="section-label-row"><div><span className="decision-eyebrow">Strategy Snapshot</span><h2 className="panel-title">Strategy Snapshot</h2></div><span>Measured values</span></div>
      <div className="blueprint-grid">
        {cards.map(([label, value, helper]) => <article key={label}><span>{label}</span><strong className={label === "Recommendation" ? `action-${result.recommendation.action.toLowerCase()}` : ""}>{value}</strong><p>{helper}</p></article>)}
      </div>
    </section>
  );
}

function RiskOutlook({ mode, result }: { mode: Mode; result: ResultValue }) {
  const stress = mode === "stress-test" ? (result as StressTestResponse) : null;
  const postAction = result.recommendation.action === "HOLD" || result.recommendation.action === "OPEN"
    ? "Maintain and monitor"
    : "Re-analysis required";
  const worstValue = stress ? stress.scenario_result.health_after_stress : "Not evaluated";
  const worstCopy = stress
    ? `${stress.scenario_result.estimated_impairment_loss_pct.toFixed(1)}% estimated impairment in this scenario.`
    : "Run Stress Test to measure a downside scenario; no worst-case state is inferred.";

  return (
    <section className="panel risk-outlook-panel">
      <div className="section-label-row"><div><span className="decision-eyebrow">Risk Timeline</span><h2 className="panel-title">Decision path</h2></div><span>Measured vs. pending</span></div>
      <div className="risk-outlook-grid">
        <article><i>1</i><span>Current Risk</span><strong className={`health-${result.strategy_health}`}>{result.strategy_health}</strong><p>Measured from the submitted structure and assumptions.</p></article>
        <article><i>2</i><span>After Recommendation</span><strong>{postAction}</strong><p>{result.recommendation.action === "HOLD" || result.recommendation.action === "OPEN" ? result.recommendation.summary : "Apply the recommendation, then run a fresh analysis to measure improvement."}</p></article>
        <article><i>3</i><span>Worst Case</span><strong className={stress ? `health-${stress.scenario_result.health_after_stress}` : ""}>{worstValue}</strong><p>{worstCopy}</p></article>
      </div>
    </section>
  );
}

function Result({
  mode,
  result,
  request,
}: {
  mode: Mode;
  result: ResultValue;
  request: FormValue;
}) {
  const withActions = result as AuditResponse | StressTestResponse;
  const build = result as BuildResponse;
  const stress = result as StressTestResponse;
  const displayedMetrics = mode === "stress-test" ? stress.scenario_result.stressed_metrics : result.metrics;
  const [monteCarloPreview, setMonteCarloPreview] = useState<MonteCarloResultHandoff | null>(null);

  useEffect(() => {
    if (mode !== "builder") return;
    const timer = window.setTimeout(() => {
      const saved = readSession<MonteCarloResultHandoff>(MONTE_CARLO_RESULT_KEY);
      if (!saved || saved.source !== "strategy_builder") return;
      const structure = build.recommended_structure;
      const matches = saved.request.asset === build.asset
        && saved.request.capital_usd === (request as BuildRequest).capital_usd
        && saved.request.long_notional_usd === structure.long_notional_usd
        && saved.request.short_notional_usd === structure.short_notional_usd
        && saved.request.collateral_usd === structure.collateral_usd;
      if (matches) setMonteCarloPreview(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [build, mode, request]);

  function sendProposedHedgeToStressTest() {
    if (mode !== "builder" || !build.hedge_adjustment || !(request as BuildRequest).wallet_exposure) return;
    const adjustment = build.hedge_adjustment;
    if (adjustment.current_long_notional_usd === null || adjustment.current_short_notional_usd === null || adjustment.target_short_notional_usd === null || adjustment.short_adjustment_usd === null) return;
    const imported = (request as BuildRequest).wallet_exposure!;
    const payload: StressHandoff = {
      source: "wallet_hedge_builder",
      wallet_address: imported.wallet_address,
      snapshot_timestamp: imported.data_timestamp,
      asset: build.asset,
      current_long_notional_usd: adjustment.current_long_notional_usd,
      current_short_notional_usd: adjustment.current_short_notional_usd,
      proposed_short_notional_usd: adjustment.target_short_notional_usd,
      collateral_usd: build.recommended_structure.collateral_usd,
      short_adjustment_usd: adjustment.short_adjustment_usd,
      target_hedge_ratio: adjustment.target_hedge_ratio,
      long_yield_apy: (request as BuildRequest).long_yield_apy,
      short_funding_apy: build.funding_rate_apy !== undefined ? -build.funding_rate_apy : (request as BuildRequest).short_funding_apy,
      fee_drag_apy: (request as BuildRequest).fee_drag_apy,
      risk_tolerance: request.risk_tolerance,
    };
    sessionStorage.setItem(STRESS_HANDOFF_KEY, JSON.stringify(payload));
    window.location.href = "/stress-test?source=wallet_hedge_builder";
  }

  function sendToMonteCarlo() {
    if (mode !== "builder") return;
    const input = request as BuildRequest;
    const handoff: MonteCarloHandoff = { source: "strategy_builder", asset: build.asset, capital_usd: input.capital_usd, long_notional_usd: build.recommended_structure.long_notional_usd, short_notional_usd: build.recommended_structure.short_notional_usd, collateral_usd: build.recommended_structure.collateral_usd, long_yield_apy: input.long_yield_apy, short_funding_apy: input.short_funding_apy, fee_drag_apy: input.fee_drag_apy, risk_tolerance: input.risk_tolerance, target_style: input.target_style };
    sessionStorage.setItem(MONTE_CARLO_HANDOFF_KEY, JSON.stringify(handoff));
    window.location.href = "/monte-carlo?source=strategy_builder";
  }

  return (
    <div className="result-stack" aria-live="polite">
      <div className="report-breadcrumb" aria-label="Report location">
        <span>{reportSections[mode]}</span>
        <i aria-hidden="true">/</i>
        <strong>{reportNames[mode]}</strong>
      </div>
      <DeltaZeroVerdict health={result.strategy_health} action={result.recommendation.action} confidence={result.decision_confidence} safetyBuffer={displayedMetrics.safety_buffer_score} />
      <DecisionPanel result={result} request={request} mode={mode} />
      <Summary result={result} />
      {mode === "builder" ? <StrategyBlueprint result={build} request={request as BuildRequest} /> : null}
      {mode === "builder" ? (
        <section className="panel builder-monte-carlo">
          <div className="section-label-row">
            <div><span className="decision-eyebrow">Sensitivity analysis</span><h2 className="panel-title">Monte Carlo Sensitivity</h2></div>
            <span>User initiated</span>
          </div>
          {monteCarloPreview ? (
            <>
              <div className="builder-mc-grid">
                {[
                  ["P95 Impairment", `${monteCarloPreview.result.summary.p95_impairment_loss_pct.toFixed(1)}%`],
                  ["P99 Impairment", `${monteCarloPreview.result.summary.p99_impairment_loss_pct.toFixed(1)}%`],
                  ["Safety Buffer Breach", `${monteCarloPreview.result.summary.probability_safety_buffer_breach_pct.toFixed(1)}%`],
                  ["Hedge Drift Breach", `${monteCarloPreview.result.summary.probability_hedge_drift_breach_pct.toFixed(1)}%`],
                  ["Recommendation", monteCarloPreview.result.summary.recommendation],
                ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
              </div>
              <div className="builder-mc-distribution" aria-label="Monte Carlo impairment percentile preview">
                {["p5", "p25", "p50", "p75", "p95", "p99"].map((key) => {
                  const values = monteCarloPreview.result.percentiles.impairment_loss_pct;
                  const value = values[key as keyof typeof values];
                  const maximum = Math.max(values.p99, 1);
                  return <i key={key} style={{ height: `${Math.max(8, value / maximum * 100)}%` }} title={`${key.toUpperCase()}: ${value.toFixed(1)}%`} />;
                })}
              </div>
              <p className="builder-mc-note">Completed {new Date(monteCarloPreview.completed_at).toLocaleString()}. Results match this exact strategy structure.</p>
              <button className="button button-secondary" type="button" onClick={sendToMonteCarlo}>Run again <span>→</span></button>
            </>
          ) : (
            <div className="builder-mc-empty"><p>Measure impairment percentiles and breach probabilities across deterministic stress paths. Simulation runs only when you request it.</p><button className="button button-primary" type="button" onClick={sendToMonteCarlo}>Run Monte Carlo on this strategy <span>→</span></button></div>
          )}
        </section>
      ) : null}
      <SafetyBufferCard score={displayedMetrics.safety_buffer_score} />
      <RiskOutlook mode={mode} result={result} />
      {mode === "builder" && (
        <section className="panel">
          <h2 className="panel-title">Recommended structure</h2>
          <div className="structure-grid">
            {Object.entries(build.recommended_structure).map(([key, value]) => (
              <div className="structure-item" key={key}>
                <div className="structure-label">
                  <span aria-hidden="true">{structureIcons[key]}</span>
                  <label>{formatKey(key)}</label>
                </div>
                <strong>{key.includes("usd") ? usd(value) : value.toFixed(3)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      {mode === "builder" && build.hedge_adjustment ? (
        <section className="panel hedge-adjustment-report">
          <div className="section-label-row"><h2 className="panel-title">Proposed Hedge</h2><span>Read only recommendation</span></div>
          {build.hedge_adjustment.limitation ? <p className="error-copy">{build.hedge_adjustment.limitation}</p> : <>
            <div className="structure-grid">
              {[
                ["Current long", build.hedge_adjustment.current_long_notional_usd], ["Current short", build.hedge_adjustment.current_short_notional_usd],
                ["Adjustment USD", build.hedge_adjustment.short_adjustment_usd], ["Target hedge ratio", build.hedge_adjustment.target_hedge_ratio],
                ["Projected net delta", build.hedge_adjustment.projected_net_delta_usd], ["Projected hedge drift", build.hedge_adjustment.projected_hedge_drift_pct],
              ].map(([label, item]) => <div className="structure-item" key={String(label)}><label>{label}</label><strong>{String(label).includes("ratio") ? Number(item).toFixed(3) : String(label).includes("drift") ? `${Number(item).toFixed(2)}%` : usd(Number(item))}</strong></div>)}
            </div>
            <div className="hedge-direction"><span>Recommended adjustment</span><strong>{build.hedge_adjustment.adjustment_direction?.replaceAll("_", " ")}</strong></div>
            {build.market_context ? <div className="market-context-grid"><div><span>Mark Price</span><strong>{usd(build.market_context.mark_price_usd, 2)}</strong></div><div><span>Current Funding</span><strong>{build.funding_rate_apy?.toFixed(2)}%</strong></div><div><span>24h Average</span><strong>{build.market_context.historical_funding?.average_funding_apy.toFixed(2) ?? "Unavailable"}%</strong></div><div><span>Open Interest</span><strong>{usd(build.market_context.open_interest_usd)}</strong></div><div><span>24h Volume</span><strong>{usd(build.market_context.day_volume_usd)}</strong></div></div> : null}
            {build.funding_rate_apy !== undefined ? <p className="funding-impact">{build.funding_rate_apy > 0 ? "Current Hyperliquid funding pays short positions, improving expected carry for the proposed hedge." : build.funding_rate_apy < 0 ? "Current Hyperliquid funding charges short positions, reducing expected carry for the proposed hedge." : "Current funding has limited effect on expected carry."} Funding rates are variable and may change after the analysis.</p> : null}
            <button className="button button-primary" type="button" onClick={sendProposedHedgeToStressTest}>Stress Test Proposed Hedge <span>→</span></button>
          </>}
        </section>
      ) : null}
      {mode === "stress-test" && (request as StressTestRequest & { imported_source?: string }).imported_source ? <section className="panel imported-stress-banner"><span>Imported proposed hedge</span><p>This scenario tests the proposed wallet hedge snapshot. No position is executed.</p></section> : null}
      {mode === "stress-test" && (
        <section className="panel scenario-card">
          <div className="section-label-row">
            <h2 className="panel-title">Scenario impact</h2>
            <span>Post-stress result</span>
          </div>
          <div className="structure-grid">
            {Object.entries(stress.scenario_result)
              .filter(([key]) => key !== "stressed_metrics")
              .map(([key, value]) => (
                <div className="structure-item" key={key}>
                  <label>{formatKey(key)}</label>
                  <strong>
                    {typeof value === "number"
                      ? key.includes("usd")
                        ? usd(value)
                        : value
                      : String(value).replaceAll("_", " ")}
                  </strong>
                </div>
              ))}
          </div>
        </section>
      )}
      <MetricsView metrics={displayedMetrics} request={request} result={result} mode={mode} />
      <div className="result-columns">
        {mode !== "builder" && (
          <section className="panel corrective-actions">
            <h2 className="panel-title">Corrective actions</h2>
            <p className="panel-copy">Ordered actions returned for this position.</p>
            <div className="actions-row">
              {withActions.actions.map((action, index) => (
                <span key={action}>
                  <b>{index + 1}</b>
                  {action}
                </span>
              ))}
            </div>
          </section>
        )}
        {mode === "builder" && (
          <section className="panel context-card">
            <h2 className="panel-title">How to read this result</h2>
            <p>
              Health measures the proposed structure&apos;s risk condition. Action determines whether the strategy should be
              opened now.
            </p>
          </section>
        )}
      </div>
      <ReportActions
        data={result}
        analysis={`${reportNames[mode]}\nRecommendation: ${result.recommendation.action}\nRisk level: ${result.strategy_health}\nDecision confidence: ${result.decision_confidence.toFixed(0)}%\n${result.recommendation.summary}`}
        filename={`deltazero-${mode}-${result.asset.toLowerCase()}.json`}
        title={`DeltaZero ${reportNames[mode]}`}
      />
      <details className="panel json-box">
        <summary>
          <span>
            <b>Raw JSON response</b>
            <small>Developer payload</small>
          </span>
          <i aria-hidden="true">⌄</i>
        </summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

export function StrategyWorkspace({ mode }: { mode: Mode }) {
  const [value, setValue] = useState<FormValue>(() => structuredClone(samples[mode]));
  const [submittedValue, setSubmittedValue] = useState<FormValue | null>(null);
  const [result, setResult] = useState<ResultValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentChallenge, setPaymentChallenge] = useState<X402Challenge | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [walletImport, setWalletImport] = useState<WalletExposureImport | null>(null);
  const [liveMarket, setLiveMarket] = useState<HyperliquidMarketResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [stressImport, setStressImport] = useState<StressHandoff | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "builder") {
        const imported = readSession<WalletExposureImport>(WALLET_HANDOFF_KEY);
        if (imported) {
          setWalletImport(imported);
          if (imported.asset === "ETH" || imported.asset === "SOL") setValue((current) => ({ ...current, asset: imported.asset } as BuildRequest));
        }
      }
      if (mode === "stress-test") {
        const imported = readSession<StressHandoff>(STRESS_HANDOFF_KEY);
        if (imported) {
          setStressImport(imported);
          setValue({
          asset: imported.asset, long_notional_usd: imported.current_long_notional_usd,
          short_notional_usd: imported.proposed_short_notional_usd, collateral_usd: imported.collateral_usd,
          risk_tolerance: imported.risk_tolerance, long_yield_apy: imported.long_yield_apy,
          short_funding_apy: imported.short_funding_apy, fee_drag_apy: imported.fee_drag_apy,
          scenario: (samples["stress-test"] as StressTestRequest).scenario, imported_source: imported.source,
          } as StressTestRequest);
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  async function refreshMarket() {
    if (mode !== "builder") return;
    const buildValue = value as BuildRequest;
    setMarketLoading(true); setMarketError(null);
    try {
      const market = await getHyperliquidMarket(buildValue.asset, buildValue.funding_lookback_hours ?? 24, buildValue.market_dex ?? undefined);
      setLiveMarket(market);
      if (!buildValue.override_live_funding) setValue({ ...buildValue, short_funding_apy: -market.current_funding_apy });
    } catch (caught) {
      setLiveMarket(null); setMarketError(caught instanceof Error ? caught.message : "Live market data unavailable.");
    } finally { setMarketLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "builder" && (value as BuildRequest).market_data_mode === "hyperliquid") void refreshMarket();
    }, 0);
    return () => window.clearTimeout(timer);
    // Asset/mode/lookback intentionally trigger a fresh public market snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, (value as BuildRequest).asset, (value as BuildRequest).market_data_mode, (value as BuildRequest).funding_lookback_hours]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    setPaymentChallenge(undefined);

    try {
      const response =
        mode === "builder"
          ? await buildStrategy(value as BuildRequest)
          : mode === "auditor"
            ? await auditStrategy(value as AuditRequest)
            : await stressTestStrategy(value as StressTestRequest);
      setResult(response);
      setSubmittedValue(structuredClone(value));
    } catch (caught) {
      setResult(null);
      if (caught instanceof PaymentRequiredError) setPaymentChallenge(caught.challenge);
      else setError(caught instanceof Error ? caught.message : "Unable to reach the strategy service.");
    } finally {
      setLoading(false);
    }
  }

  const requestValue = submittedValue ?? value;

  return (
    <div className="workspace">
      <header className="page-intro">
        <div>
          <p className="kicker">{copy[mode].kicker}</p>
          <h1>{copy[mode].title}</h1>
          <p>{copy[mode].description}</p>
        </div>
        <span className="endpoint">{copy[mode].endpoint}</span>
      </header>
      <div className="workspace-grid">
        <div>
          {mode === "stress-test" && stressImport ? <section className="panel imported-wallet-panel">
            <span className="decision-eyebrow">Imported Proposed Hedge</span><h2>{stressImport.asset} hedge snapshot</h2>
            <div className="import-grid"><div><span>Source wallet</span><strong>{`${stressImport.wallet_address.slice(0, 6)}…${stressImport.wallet_address.slice(-4)}`}</strong></div><div><span>Snapshot</span><strong>{stressImport.snapshot_timestamp ? new Date(stressImport.snapshot_timestamp).toLocaleString() : "Unavailable"}</strong></div><div><span>Current long</span><strong>{usd(stressImport.current_long_notional_usd)}</strong></div><div><span>Current short</span><strong>{usd(stressImport.current_short_notional_usd)}</strong></div><div><span>Proposed short</span><strong>{usd(stressImport.proposed_short_notional_usd)}</strong></div><div><span>Proposed adjustment</span><strong>{usd(stressImport.short_adjustment_usd)}</strong></div></div>
            <p>Select a scenario below to stress the proposed structure. This remains a read-only analysis.</p>
          </section> : null}
          {mode === "builder" && walletImport ? <section className="panel imported-wallet-panel">
            <span className="decision-eyebrow">Imported Wallet Exposure</span><h2>{walletImport.largest_risk_asset ?? "Dominant asset unavailable"}</h2>
            {walletImport.data_quality === "partial" ? <p className="partial-copy">Partial wallet coverage. The hedge recommendation may not reflect positions that could not be retrieved.</p> : null}
            <div className="import-grid"><div><span>Wallet</span><strong>{`${walletImport.wallet_address.slice(0, 6)}…${walletImport.wallet_address.slice(-4)}`}</strong></div><div><span>Long</span><strong>{walletImport.gross_long_exposure_usd === null ? "Unavailable" : usd(walletImport.gross_long_exposure_usd)}</strong></div><div><span>Short</span><strong>{walletImport.gross_short_exposure_usd === null ? "Unavailable" : usd(walletImport.gross_short_exposure_usd)}</strong></div><div><span>Current hedge ratio</span><strong>{walletImport.current_hedge_ratio?.toFixed(3) ?? "Unavailable"}</strong></div><div><span>Net delta</span><strong>{walletImport.net_delta_usd === null ? "Unavailable" : usd(walletImport.net_delta_usd)}</strong></div><div><span>Wallet action</span><strong>{walletImport.recommended_action}</strong></div></div>
            <p>This Builder analysis uses a snapshot imported from the Wallet Auditor. Refresh the wallet assessment before acting if market conditions or positions have changed.</p>
            <div className="import-actions"><button type="button" onClick={() => setValue({ ...(value as BuildRequest), wallet_exposure: walletImport })}>Use Imported Exposure</button><button type="button" onClick={() => { sessionStorage.removeItem(WALLET_HANDOFF_KEY); setWalletImport(null); setValue({ ...(value as BuildRequest), wallet_exposure: null }); }}>Clear Import</button><a href="/wallet">Return to Wallet Auditor</a></div>
          </section> : null}
          <StrategyForm mode={mode} value={value} setValue={setValue} submit={submit} loading={loading} liveMarket={liveMarket} marketLoading={marketLoading} marketError={marketError} refreshMarket={() => void refreshMarket()} />
        </div>
        <div className="result-region">
          {paymentChallenge !== undefined ? (
            <PaymentRequiredCard challenge={paymentChallenge} retry={() => void submit()} loading={loading} />
          ) : error ? (
            <div className="error-box" role="alert">
              <span className="state-icon">!</span>
              <div>
                <strong>Analysis could not be completed</strong>
                <p>{error}</p>
                <small>Check that the API is running and try again.</small>
              </div>
            </div>
          ) : loading ? (
            <div className="panel loading-state">
              <StepProgress kind={mode} />
            </div>
          ) : result ? (
            <Result mode={mode} result={result} request={requestValue} />
          ) : (
            <div className="panel empty-state">
              <div>
                <div className="empty-icon">Δ</div>
                <strong>{mode === "builder" ? "Build a decision-ready strategy report" : mode === "auditor" ? "Evaluate an existing position" : "Measure a downside scenario"}</strong>
                <p>{mode === "builder" ? "Review capital, market assumptions, and risk settings. The report will explain carry, hedge quality, resilience, and the recommended next action." : mode === "auditor" ? "Enter the current long, short, and collateral structure to identify hedge drift, capital risk, and corrective actions." : "Choose a scenario and magnitude to compare stressed metrics, impairment, and the resulting recommendation."}</p>
                <small>Every result is deterministic and includes the raw API response for verification.</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
