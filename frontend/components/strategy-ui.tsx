"use client";

import { useState, type FormEvent } from "react";

import { auditStrategy, buildStrategy, stressTestStrategy } from "@/lib/api";
import { AUDIT_SAMPLE, BUILD_SAMPLE, STRESS_TEST_SAMPLE } from "@/lib/samples";
import { RiskGauge } from "@/components/risk-gauge";
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
} from "@/lib/types";

type Mode = "builder" | "auditor" | "stress-test";
type FormValue = BuildRequest | AuditRequest | StressTestRequest;
type ResultValue = BuildResponse | AuditResponse | StressTestResponse;

type DecisionSupportState = "positive" | "warning";

const copy = {
  builder: {
    kicker: "Design from first principles",
    title: "Strategy Builder",
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
    title: "Stress Test",
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
}: {
  mode: Mode;
  value: FormValue;
  setValue: (value: FormValue) => void;
  submit: (event: FormEvent) => void;
  loading: boolean;
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
      <p className="form-note">Demo values are preloaded · Edit any input</p>
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
    ["Recommended action", result.recommendation.action],
    ["Estimated net carry APY", `${result.metrics.estimated_net_carry_apy.toFixed(1)}%`],
    ["Safety Buffer score", result.metrics.safety_buffer_score.toFixed(1)],
  ];

  return (
    <section className="panel summary-card">
      <div className="summary-heading">
        <div>
          <span className="summary-meta">Analysis complete · {result.service}</span>
          <h2>AI Strategy Report</h2>
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
                  : label === "Recommended action"
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

  return (
    <section className="panel decision-card">
      <div className="assessment-main">
        <div className="assessment-heading">
          <span className="assessment-icon" aria-hidden="true">
            Δ
          </span>
          <p className="decision-eyebrow">AI Assessment</p>
        </div>
        <div className="decision-summary-row">
          <div>
            <span className="decision-label">Recommended Action</span>
            <strong className={`action-value action-${action.toLowerCase()}`}>{action}</strong>
          </div>
          <div className="decision-confidence">
            <RiskGauge
              value={result.decision_confidence}
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
      </div>
      <div className="health-context">
        <div>
          <span className="decision-label">Strategy Health</span>
          <strong className={`health-value health-${result.strategy_health}`}>{result.strategy_health}</strong>
        </div>
        <p>{healthMessage}</p>
      </div>
      <div className="decision-rationale">
        <span>Why this decision</span>
        <ul>
          {result.risk_notes
            .filter((note) => note.trim() !== result.recommendation.summary.trim())
            .slice(0, 3)
            .map((note) => (
              <li key={note}>{note}</li>
            ))}
        </ul>
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

  return (
    <div className="result-stack" aria-live="polite">
      <div className="report-breadcrumb" aria-label="Report location">
        <span>{reportSections[mode]}</span>
        <i aria-hidden="true">/</i>
        <strong>{reportNames[mode]}</strong>
      </div>
      <Summary result={result} />
      <DecisionPanel result={result} request={request} mode={mode} />
      <SafetyBufferCard score={displayedMetrics.safety_buffer_score} />
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
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

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
      setError(caught instanceof Error ? caught.message : "Unable to reach the strategy service.");
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
        <StrategyForm mode={mode} value={value} setValue={setValue} submit={submit} loading={loading} />
        <div className="result-region">
          {error ? (
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
              <div>
                <div className="spinner" />
                <strong>Analyzing strategy</strong>
                <p>Calculating hedge, carry, and collateral metrics…</p>
              </div>
            </div>
          ) : result ? (
            <Result mode={mode} result={result} request={requestValue} />
          ) : (
            <div className="panel empty-state">
              <div>
                <div className="empty-icon">Δ</div>
                <strong>Ready for analysis</strong>
                <p>Review the preloaded inputs, then submit to generate a deterministic strategy decision.</p>
                <small>No wallet or live market connection required.</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
