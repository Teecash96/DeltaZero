"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonteCarloResponse, StressTestResponse } from "@/lib/types";

const colors = {
  grid: "var(--line)",
  text: "var(--muted)",
  accent: "var(--green)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  color: "var(--ink)",
  fontSize: 12,
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildHistogram(values: number[], binCount = 12) {
  if (values.length === 0) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const width = Math.max((maximum - minimum) / binCount, 0.1);
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: minimum + index * width,
    upper: minimum + (index + 1) * width,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - minimum) / width), binCount - 1);
    bins[index].count += 1;
  }

  return bins.map((bin) => ({
    range: `${bin.lower.toFixed(1)}–${bin.upper.toFixed(1)}%`,
    midpoint: Number(((bin.lower + bin.upper) / 2).toFixed(2)),
    outcomes: bin.count,
  }));
}

export function MonteCarloOutcomeVisualizer({ result }: { result: MonteCarloResponse }) {
  const histogram = buildHistogram(result.sample_paths.map((path) => path.impairment_loss_pct));
  const equityPaths = [...result.sample_paths]
    .sort((left, right) => left.impairment_loss_pct - right.impairment_loss_pct)
    .map((path, index) => ({
      percentile: Math.round(((index + 1) / result.sample_paths.length) * 100),
      equity: path.post_stress_equity_usd,
    }));
  const impliedStartingCapital = result.summary.expected_post_stress_equity_usd + result.summary.expected_impairment_loss_usd;
  const capitalImpairmentBoundary = impliedStartingCapital * .8;
  const p95Bin = histogram.reduce(
    (closest, bin) => Math.abs(bin.midpoint - result.summary.p95_impairment_loss_pct) < Math.abs(closest.midpoint - result.summary.p95_impairment_loss_pct) ? bin : closest,
    histogram[0],
  );
  const impairmentZoneStart = histogram.find((bin) => bin.midpoint >= 20)?.range;

  return (
    <section className="panel risk-visualizer-panel">
      <div className="section-label-row">
        <div><span className="decision-eyebrow">Outcome map</span><h2 className="panel-title">Stress-path distribution</h2></div>
        <span>{result.sample_paths.length} visualized paths</span>
      </div>
      <div className="risk-chart-grid">
        <article className="risk-chart-card">
          <div className="risk-chart-heading"><h3>Impairment distribution</h3><p>Frequency of returned stress-path losses.</p></div>
          <div className="risk-chart-canvas" role="img" aria-label="Monte Carlo impairment loss histogram with capital impairment zone">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 18, right: 12, bottom: 8, left: -12 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="range" stroke={colors.text} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={colors.text} tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} paths`, "Outcomes"]} />
                {impairmentZoneStart ? <ReferenceArea x1={impairmentZoneStart} x2={histogram.at(-1)?.range} fill={colors.danger} fillOpacity={.1} /> : null}
                {p95Bin ? <ReferenceLine x={p95Bin.range} stroke={colors.warning} strokeDasharray="5 4" label={{ value: "P95", fill: colors.warning, fontSize: 10 }} /> : null}
                <Bar dataKey="outcomes" fill={colors.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend"><span><i className="legend-accent" />Simulated outcomes</span><span><i className="legend-danger" />Capital impairment zone ≥20%</span></div>
        </article>
        <article className="risk-chart-card">
          <div className="risk-chart-heading"><h3>Post-stress equity curve</h3><p>Equity ranked from lower to higher impairment.</p></div>
          <div className="risk-chart-canvas" role="img" aria-label="Post-stress equity curve with impairment boundary">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityPaths} margin={{ top: 18, right: 12, bottom: 8, left: 4 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="percentile" stroke={colors.text} tick={{ fontSize: 9 }} unit="%" />
                <YAxis stroke={colors.text} tick={{ fontSize: 9 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [usd(Number(value)), "Post-stress equity"]} labelFormatter={(value) => `Ranked path ${value}%`} />
                <ReferenceArea y1={0} y2={capitalImpairmentBoundary} fill={colors.danger} fillOpacity={.1} />
                <ReferenceLine y={capitalImpairmentBoundary} stroke={colors.danger} strokeDasharray="5 4" label={{ value: "Impairment boundary", fill: colors.danger, fontSize: 10, position: "insideTopLeft" }} />
                <Area type="monotone" dataKey="equity" stroke={colors.accent} fill={colors.accent} fillOpacity={.14} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend"><span><i className="legend-accent" />Post-stress equity</span><span><i className="legend-danger" />Capital impairment boundary</span></div>
        </article>
      </div>
      <p className="risk-chart-disclaimer">Zones are deterministic sensitivity boundaries from the submitted model. They are not price forecasts or protocol liquidation prices.</p>
    </section>
  );
}

export function StressTestLiquidationVisualizer({ result }: { result: StressTestResponse }) {
  const liabilityBoundary = Math.max(result.stressed_liabilities_usd, 0);
  const data = [
    { state: "Before stress", equity: result.pre_stress_equity_usd },
    { state: "After stress", equity: result.post_impairment_equity_usd },
  ];

  return (
    <section className="panel risk-visualizer-panel">
      <div className="section-label-row">
        <div><span className="decision-eyebrow">Liquidation boundary</span><h2 className="panel-title">Equity resilience under stress</h2></div>
        <span>{result.scenario_result.scenario_type.replaceAll("_", " ")}</span>
      </div>
      <div className="stress-chart-layout">
        <div className="risk-chart-canvas stress-chart" role="img" aria-label="Pre and post stress equity compared with stressed liabilities">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 18, bottom: 8, left: 8 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="state" stroke={colors.text} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.text} tick={{ fontSize: 9 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [usd(Number(value)), "Equity"]} />
              {liabilityBoundary > 0 ? <ReferenceArea y1={0} y2={liabilityBoundary} fill={colors.danger} fillOpacity={.12} /> : null}
              {liabilityBoundary > 0 ? <ReferenceLine y={liabilityBoundary} stroke={colors.danger} strokeDasharray="6 4" label={{ value: "Stressed liabilities", fill: colors.danger, fontSize: 10, position: "insideTopLeft" }} /> : null}
              <Bar dataKey="equity" fill={colors.accent} radius={[7, 7, 0, 0]} maxBarSize={92} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="liquidation-zone-summary">
          <article><span>Pre-stress equity</span><strong>{usd(result.pre_stress_equity_usd)}</strong></article>
          <article><span>Post-stress equity</span><strong>{usd(result.post_impairment_equity_usd)}</strong></article>
          <article><span>Stressed liabilities</span><strong>{usd(result.stressed_liabilities_usd)}</strong></article>
          <article><span>Impairment</span><strong>{result.estimated_impairment_loss_pct.toFixed(1)}%</strong></article>
        </div>
      </div>
      <div className="chart-legend"><span><i className="legend-accent" />Portfolio equity</span><span><i className="legend-danger" />Liquidation-risk proxy zone</span></div>
      <p className="risk-chart-disclaimer">The shaded zone compares modeled equity with returned stressed liabilities. It is a portfolio risk boundary, not a venue-specific liquidation price.</p>
    </section>
  );
}
