import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — DeltaZero",
  description: "Documented formulas, thresholds, data sources, and limitations behind DeltaZero risk reports.",
};

const profileRows = [
  ["Low risk", "0.92", "4%", "8%", "70", "50"],
  ["Medium risk", "0.96", "6%", "12%", "60", "40"],
  ["High risk", "0.98", "8%", "16%", "50", "35"],
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
        <div className="methodology-heading"><span>Core model</span><h2>Strategy metrics</h2></div>
        <div className="formula-grid">
          <article><h3>Hedge ratio</h3><code>short notional ÷ long notional</code><p>Measures how much of the effective long exposure is offset by the short leg.</p></article>
          <article><h3>Hedge drift</h3><code>|1 − hedge ratio| × 100</code><p>Distance from a fully matched hedge, expressed as a percentage.</p></article>
          <article><h3>Net delta estimate</h3><code>(long − short) ÷ long × 100</code><p>A simplified directional exposure estimate for the submitted structure.</p></article>
          <article><h3>Net carry APY</h3><code>long yield − weighted funding − fee drag</code><p>Funding is weighted by the hedged share of long exposure.</p></article>
          <article><h3>Safety Buffer</h3><code>min(100, collateral ÷ short × 200)</code><p>A heuristic collateral-coverage score. It is not a venue liquidation price.</p></article>
          <article><h3>Capital at risk proxy</h3><code>unhedged notional + margin deficit</code><p>Margin deficit uses a minimum short-margin ratio of 10%.</p></article>
        </div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Decision controls</span><h2>Risk thresholds</h2></div>
        <div className="methodology-table-wrap">
          <table className="methodology-table">
            <thead><tr><th>Profile</th><th>Target hedge</th><th>Drift warning</th><th>Drift critical</th><th>Buffer warning</th><th>Buffer critical</th></tr></thead>
            <tbody>{profileRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="methodology-note">Target styles apply their own documented allocation and intervention profiles. The most severe triggered condition takes priority in the final recommendation.</p>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Loss model</span><h2>Stress impairment</h2></div>
        <p>Pre-stress equity is compared with equity after repricing the long leg, short PnL, collateral haircut, liabilities, exit slippage, liquidation penalty proxy, and protocol-loss assumption. The report displays each component separately to avoid hiding double counting.</p>
        <div className="methodology-callout"><strong>Important</strong><p>Safety Buffer and liquidation penalty are decision heuristics, not protocol-perfect liquidation engines. Venue rules, oracle behavior, fees, and latency may differ.</p></div>
      </section>

      <section className="panel methodology-section">
        <div className="methodology-heading"><span>Sensitivity model</span><h2>Monte Carlo</h2></div>
        <p>DeltaZero draws bounded, clipped-normal stress assumptions for market movement, funding shifts, slippage, collateral haircuts, and protocol loss. Volatility scales with the square root of the selected horizon. A supplied seed makes the simulation reproducible.</p>
        <div className="formula-grid compact">
          <article><h3>Path count</h3><strong>100–10,000</strong><p>Validated before execution.</p></article>
          <article><h3>Market bounds</h3><strong>−95% to +100%</strong><p>Both positive and negative shocks.</p></article>
          <article><h3>Reported tails</h3><strong>P95 and P99</strong><p>Alongside median and worst simulated outcome.</p></article>
          <article><h3>Repeatability</h3><strong>Seeded</strong><p>Same request and seed, same paths.</p></article>
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
        <ul><li>DeltaZero does not predict prices or profitability.</li><li>Partial or unavailable integrations can produce incomplete portfolio coverage.</li><li>Outputs are decision support, not financial advice or execution instructions.</li><li>Users and agents should independently verify venue rules, liquidity, and transaction costs.</li></ul>
        <div className="methodology-actions"><a className="button button-secondary" href="https://deltazero-production.up.railway.app/docs" target="_blank" rel="noreferrer">Inspect API contracts</a><a className="button button-secondary" href="https://github.com/Teecash96/DeltaZero" target="_blank" rel="noreferrer">Review source code</a><Link className="button button-primary" href="/support">Get support</Link></div>
      </section>
    </div>
  );
}
