import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — DeltaZero",
  description: "Documented formulas, thresholds, data sources, and limitations behind DeltaZero risk reports.",
};

const profileRows = [
  ["Low risk", "0.92", "4%", "8%", "70", "50", "Conservative engineering policy"],
  ["Medium risk", "0.96", "6%", "12%", "60", "40", "Baseline engineering policy"],
  ["High risk", "0.98", "8%", "16%", "50", "35", "User-selected higher tolerance"],
];

const modelFacts = [
  ["Model version", "1.0"],
  ["Released", "July 2026"],
  ["Calculation type", "Deterministic rules + seeded sensitivity"],
  ["Intended use", "Pre-deployment decision support"],
  ["Historical validation", "Not yet claimed"],
  ["Execution authority", "None — read only"],
];

export default function MethodologyPage() {
  return (
    <div className="workspace evidence-page">
      <header className="page-intro">
        <div>
          <p className="kicker">Transparent by design</p>
          <h1>Methodology</h1>
          <p>Every DeltaZero verdict is produced by documented calculations and deterministic thresholds. Numbers are computed in code; generative AI is not used to invent financial outputs.</p>
        </div>
        <span className="endpoint">VERSION 1.0</span>
      </header>

      <section className="methodology-principles">
        <article className="panel"><span>01</span><strong>Deterministic</strong><p>Identical inputs and seed produce identical results.</p></article>
        <article className="panel"><span>02</span><strong>Read only</strong><p>Wallet analysis uses public data and requests no custody or signatures.</p></article>
        <article className="panel"><span>03</span><strong>Traceable</strong><p>Reports identify the source, snapshot time, generation time, and data quality.</p></article>
        <article className="panel"><span>04</span><strong>Bounded</strong><p>Stress inputs are constrained; sensitivity results are not price forecasts.</p></article>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Governance record</span><h2>Model card</h2></div>
        <div className="model-card-grid">
          {modelFacts.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </div>
        <p className="methodology-note">DeltaZero is a transparent engineering risk model, not a statistically validated trading model. A version change is required when formulas, thresholds, factor distributions, or recommendation rules materially change.</p>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Core model</span><h2>Strategy metrics</h2></div>
        <div className="formula-grid">
          <article><h3>Hedge ratio</h3><code>short notional ÷ long notional</code><p>Measures how much of the effective long exposure is offset by the short leg.</p></article>
          <article><h3>Hedge drift</h3><code>|1 − hedge ratio| × 100</code><p>Distance from a fully matched hedge, expressed as a percentage.</p></article>
          <article><h3>Net delta estimate</h3><code>(long − short) ÷ long × 100</code><p>A simplified directional exposure estimate for the submitted structure.</p></article>
          <article><h3>Net carry APY</h3><code>long yield − weighted funding − fee drag</code><p>Funding is weighted by the hedged share of long exposure.</p></article>
          <article><h3>Safety Buffer</h3><code>min(100, collateral ÷ short × 200)</code><p>A heuristic collateral-coverage score. It is not a venue liquidation price.</p></article>
          <article><h3>Capital at risk proxy</h3><code>unhedged notional + margin deficit</code><p>Margin deficit uses a minimum short-margin ratio of 10%.</p></article>
        </div>
        <div className="methodology-worked-example">
          <div><span>Worked example</span><h3>Why is the Safety Buffer 76?</h3></div>
          <code>min(100, $1,500 ÷ $3,950 × 200) = 75.95 ≈ 76</code>
          <p>The score expresses collateral coverage relative to short notional. The 200 multiplier maps 50% collateral coverage to the top of the 0–100 display range. It is a deliberately simple product heuristic—not a probability of safety, liquidation distance, or venue health factor.</p>
          <div className="methodology-percentile-context">
            <strong>80th percentile in the DeltaZero reference cohort</strong>
            <p>The illustrative score exceeds 80% of 1,001 evenly spaced reference configurations spanning 10%–45% collateral-to-short coverage. It is also 16 points above the medium-risk warning threshold of 60.</p>
            <small>This is a bounded policy benchmark, not a sample or ranking of active Hyperliquid accounts.</small>
            <a href="https://github.com/Teecash96/DeltaZero/blob/main/backend/benchmarks/safety_buffer_reference.json" target="_blank" rel="noreferrer">Inspect reference data ↗</a>
          </div>
        </div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Decision controls</span><h2>Risk thresholds</h2></div>
        <div className="methodology-table-wrap">
          <table className="methodology-table">
            <thead><tr><th>Profile</th><th>Target hedge</th><th>Drift warning</th><th>Drift critical</th><th>Buffer warning</th><th>Buffer critical</th><th>Provenance</th></tr></thead>
            <tbody>{profileRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="methodology-note">These thresholds are explicit product risk policies chosen for explainability and conservative intervention; they are not presented as empirically optimal or protocol-issued limits. Target styles apply their own allocation and intervention profiles. The most severe triggered condition takes priority.</p>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Loss model</span><h2>Stress impairment</h2></div>
        <p>Pre-stress equity is compared with equity after repricing the long leg, short PnL, collateral haircut, liabilities, exit slippage, liquidation penalty proxy, and protocol-loss assumption. The report displays each component separately to avoid hiding double counting.</p>
        <div className="methodology-callout"><strong>Important</strong><p>Safety Buffer and liquidation penalty are decision heuristics, not protocol-perfect liquidation engines. Venue rules, oracle behavior, fees, and latency may differ.</p></div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Sensitivity model</span><h2>Monte Carlo</h2></div>
        <p>DeltaZero uses a correlated multivariate Student-t systemic layer for market movement, funding shifts, and collateral stress, then transmits collateral depeg severity into funding pressure, slippage, and collateral impairment. Non-systemic mode remains available as an independent normal baseline. Volatility scales with the square root of the selected horizon, and a supplied seed makes the simulation reproducible.</p>
        <div className="formula-grid compact">
          <article><h3>Path count</h3><strong>100–10,000</strong><p>Validated before execution.</p></article>
          <article><h3>Market bounds</h3><strong>−95% to +100%</strong><p>Both positive and negative shocks.</p></article>
          <article><h3>Reported tails</h3><strong>P95 and P99</strong><p>Alongside median and worst simulated outcome.</p></article>
          <article><h3>Repeatability</h3><strong>Seeded</strong><p>Same request and seed, same paths.</p></article>
          <article><h3>Systemic tails</h3><strong>Student-t · 5 DoF</strong><p>Configurable heavy-tail dependence across market, funding, and collateral factors.</p></article>
          <article><h3>Depeg transmission</h3><strong>Coupled</strong><p>Collateral depeg can amplify funding cost, exit slippage, and haircut loss in one path.</p></article>
        </div>
        <div className="methodology-callout"><strong>Current statistical assumptions</strong><p>The submitted correlation matrix must be positive semidefinite. Default correlations are explicit scenario assumptions, not empirically calibrated forecasts. The model captures static heavy-tail dependence and depeg transmission, but not time-varying correlations, volatility clustering, order-book feedback, oracle latency, contagion between venues, or path-perfect liquidations. P95 and P99 remain percentiles of the submitted sensitivity model—not forecasts of real-world loss probability.</p></div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Evidence status</span><h2>Validation record</h2></div>
        <div className="validation-grid">
          <article><span>Implemented</span><strong>Formula regression tests</strong><p>Automated tests cover deterministic repeatability, percentile ordering, input bounds, recommendation states, and payment protection.</p></article>
          <article><span>Implemented</span><strong>Reproducible scenarios</strong><p>Versioned regression fixtures use frozen reference inputs produced by the documented formulas. These demonstrate behavior, but are not historical performance claims.</p></article>
          <article><span>Not complete</span><strong>Historical replay</strong><p>DeltaZero has not yet published a time-aligned historical replay with funding, liquidity, and margin rules frozen at each observation.</p></article>
          <article><span>Not complete</span><strong>Empirical calibration</strong><p>Thresholds have not been optimized against realized liquidations or portfolio losses. They remain transparent engineering policies.</p></article>
        </div>
        <div className="methodology-callout"><strong>Required before claiming validation</strong><p>Publish a versioned replay dataset, remove look-ahead bias, include contemporaneous funding and venue rules, compare unhedged, original-hedge, and DeltaZero-adjusted structures, and report both favourable and adverse examples.</p></div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Reproducibility</span><h2>What every result should disclose</h2></div>
        <div className="source-list">
          <article><strong>Model identity</strong><p>Model version, selected risk profile, target style, and the recommendation policy used.</p></article>
          <article><strong>Simulation identity</strong><p>Seed, path count, horizon, distribution assumptions, bounds, and submitted stress parameters.</p></article>
          <article><strong>Data provenance</strong><p>Provider, source snapshot timestamp, report timestamp, freshness, and data-quality status.</p></article>
          <article><strong>Decision trace</strong><p>Triggered warning and critical thresholds, available metrics, and any unavailable or unsupported evidence.</p></article>
        </div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Agent interface</span><h2>Live Model Context Protocol server</h2></div>
        <p>Compatible agents can discover DeltaZero&apos;s typed tools and consume structured deterministic outputs directly—without endpoint-specific wrapper parsers.</p>
        <div className="methodology-worked-example">
          <div><span>Streamable HTTP endpoint</span><h3>Production MCP</h3></div>
          <code>https://deltazero-production.up.railway.app/mcp</code>
          <p>Premium tool calls are protected by the OKX x402 Agent Payments Protocol. Initialization, discovery, and methodology resources remain free; calculation tools require a 1 USDT settlement on X Layer.</p>
        </div>
        <div className="source-list">
          <article><strong>Native schemas</strong><p>Tool inputs and structured outputs are generated from the same validated Pydantic contracts as the API.</p></article>
          <article><strong>One calculation engine</strong><p>MCP tools call the existing deterministic services directly; formulas and verdict logic are not duplicated.</p></article>
          <article><strong>Six discoverable tools</strong><p>Live market context plus Strategy Build, Hedge-Drift, Funding Stress, Monte Carlo, and the complete Risk Engine.</p></article>
          <article><strong>Payment-ready</strong><p>Agents can inspect capabilities and invoke tools freely during review; standardized payment enforcement can be restored with one deployment setting.</p></article>
        </div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Data integrity</span><h2>Sources and freshness</h2></div>
        <div className="source-list">
          <article><strong>Hyperliquid</strong><p>Public market and supported position data. Live responses carry a source timestamp and data-quality label.</p></article>
          <article><strong>Aave</strong><p>Read-only lending data through configured Ethereum or Arbitrum RPC access.</p></article>
          <article><strong>Morpho</strong><p>Supported market and vault positions from Morpho&apos;s public API.</p></article>
          <article><strong>User assumptions</strong><p>Manual yield, funding, collateral, fee, stress, and simulation inputs are labelled as user supplied rather than live market data.</p></article>
        </div>
      </section>

      <section className="panel methodology-section methodology-limitations">
        <div className="methodology-heading"><span>Use responsibly</span><h2>Limitations</h2></div>
        <ul><li>DeltaZero does not predict prices or profitability.</li><li>Safety Buffer is a heuristic score and must not be interpreted as liquidation probability.</li><li>Systemic correlations and tail parameters are scenario inputs; they are not yet calibrated to a versioned historical dataset and do not change dynamically by regime.</li><li>Partial or unavailable integrations can produce incomplete portfolio coverage.</li><li>Outputs are decision support, not financial advice or execution instructions.</li><li>Users and agents should independently verify venue rules, liquidity, oracle behaviour, latency, and transaction costs.</li></ul>
        <div className="methodology-actions"><a className="button button-secondary" href="https://deltazero-production.up.railway.app/docs" target="_blank" rel="noreferrer">Inspect API contracts</a><a className="button button-secondary" href="https://github.com/Teecash96/DeltaZero" target="_blank" rel="noreferrer">Review source code</a><Link className="button button-primary" href="/support">Get support</Link></div>
      </section>
    </div>
  );
}
