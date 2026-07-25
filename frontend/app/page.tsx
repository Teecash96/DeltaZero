import Link from "next/link";
import { AgentSdkSection } from "@/components/agent-sdk-section";
import { StrategyBuilder } from "@/components/StrategyBuilder";

const quickLinks = [
  { label: "Interactive Builder", href: "#builder", note: "Live risk engine demo" },
  { label: "How It Works", href: "#how-it-works", note: "The five-step workflow" },
  { label: "Risk Zones", href: "#risk-zones", note: "Zone thresholds explained" },
  { label: "Engine Math", href: "#engine-math", note: "Formulas and decision logic" },
  { label: "Live Data", href: "#live-data", note: "Simulated protocol feeds" },
  { label: "Products", href: "#products", note: "Five connected risk services" },
  { label: "Integrations", href: "#integrations", note: "Live and planned read-only coverage" },
  { label: "Agent Integration", href: "#agent-integration", note: "SDK and MCP code examples" },
  { label: "Why Agents", href: "#why-agents", note: "Measured latency and repeatability" },
  { label: "FAQs", href: "#faqs", note: "Common questions and constraints" },
];

const externalLinks = [
  { label: "Documentation", href: "https://github.com/Teecash96/DeltaZero#readme" },
  { label: "GitHub", href: "https://github.com/Teecash96/DeltaZero" },
  { label: "X", href: "https://x.com/DeltaZeroASP" },
];

const howItWorks = [
  { step: "01", title: "Input", description: "Users provide the asset, capital, risk tolerance, target style, yield assumptions, funding assumptions, fees, or existing position data." },
  { step: "02", title: "Analyze", description: "DeltaZero evaluates estimated carry, hedge ratio, hedge drift, net delta, collateral resilience, capital at risk, and Safety Buffer." },
  { step: "03", title: "Assess", description: "The deterministic risk engine compares the metrics against thresholds based on risk tolerance, target style, service type, and stress scenario." },
  { step: "04", title: "Decide", description: "DeltaZero returns strategy health, recommended action, Decision Confidence, risk notes, and a recommended structure where applicable." },
  { step: "05", title: "Act", description: "The user or an autonomous agent can use the result to OPEN, WAIT, HOLD, REBALANCE, REDUCE, or CLOSE." },
];

const products = [
  { href: "/builder", number: "01", title: "Strategy Build", description: "Builds a pseudo delta neutral strategy from capital, market assumptions, risk tolerance, and target style.", bullets: ["Recommended long notional", "Short notional", "Collateral allocation", "Hedge ratio", "Carry metrics", "Safety Buffer", "Action"], action: "Run Strategy Build" },
  { href: "/auditor", number: "02", title: "Hedge-Drift Auditing", description: "Analyzes an existing long, short, and collateral structure for current health and corrective action.", bullets: ["Current health", "Hedge drift", "Capital risk", "Safety Buffer", "Corrective action"], action: "Analyze Hedge Drift" },
  { href: "/stress-test", number: "03", title: "Funding Stress Testing", description: "Applies deterministic scenarios such as funding worsens, yield drops, price shock, or collateral pressure.", bullets: ["Post stress metrics", "Post stress health", "Recommended action", "Scenario impact"], action: "Run Funding Stress Test" },
  { href: "/wallet", number: "04", title: "Hedge Intelligence", description: "Discovers supported public positions and converts portfolio exposure into an explainable risk assessment.", bullets: ["Public position discovery", "Net exposure", "Hedge ratio", "Protocol allocation", "Portfolio verdict"], action: "Open Hedge Intelligence" },
  { href: "/monte-carlo", number: "05", title: "Monte Carlo Sensitivity", description: "Simulates bounded stress paths to measure impairment, hedge drift, negative carry, and Safety Buffer fragility.", bullets: ["P95 and P99 impairment", "Breach probabilities", "Sensitivity drivers", "Sample paths", "Risk-zone verdict"], action: "Run Monte Carlo" },
];

const liveIntegrations = [
  { name: "Hyperliquid", badge: "LIVE", useCase: "Read-only perpetual positions, margin data, account value, unrealized PnL, and liquidation context through public protocol data." },
  { name: "Aave", badge: "LIVE WITH RPC", useCase: "Read-only supply, borrow, collateral, debt, and health-factor analysis when supported RPC access is configured." },
  { name: "Morpho", badge: "LIVE", useCase: "Read-only market and vault positions through Morpho's supported public data API." },
];

const plannedIntegrations = [
  { name: "Pendle", badge: "PLANNED", useCase: "Fixed-yield, PT, YT, and maturity-risk analysis." },
  { name: "Ethena", badge: "PLANNED", useCase: "Synthetic-dollar and hedged-yield strategy analysis." },
  { name: "Live Funding Rates", badge: "PLANNED", useCase: "Continuous real-time funding inputs from supported venues." },
  { name: "Additional Wallet and Protocol Coverage", badge: "PLANNED", useCase: "More networks, assets, protocols, LP positions, and portfolio adapters." },
];

const strategyPlatforms = [
  { title: "Neutral Yield Carry", use: "Hold or earn yield on the long leg while shorting perpetual futures to reduce directional exposure.", platforms: "Hyperliquid, OKX, Drift, GMX, Aave, Morpho, Kamino" },
  { title: "Conservative Income", use: "Lower leverage, larger collateral reserve, tighter hedge, lower capital risk.", platforms: "Aave, Morpho, Spark, Compound, Silo" },
  { title: "Aggressive Carry", use: "Higher capital deployment, higher expected carry, wider risk tolerance, smaller collateral reserve.", platforms: "Hyperliquid, OKX, Drift, GMX, Ethena" },
  { title: "Capital Preservation", use: "Principal protection, tight hedge alignment, large collateral reserve, low capital at risk.", platforms: "Aave, Morpho, Pendle fixed yield, Spark, Ethena hedged products" },
];

const faqs = [
  { question: "Is DeltaZero non custodial?", answer: "Yes. The current MVP does not hold funds, connect wallets, or execute transactions." },
  { question: "Does DeltaZero execute trades?", answer: "No. It provides deterministic risk analysis and recommendations only." },
  { question: "Which assets are supported?", answer: "The current MVP supports SOL and ETH." },
  { question: "Which target styles are supported?", answer: "Neutral Yield, Conservative Income, Aggressive Carry, and Capital Preservation." },
  { question: "How is the recommendation generated?", answer: "The backend evaluates carry, hedge alignment, Safety Buffer, capital risk, and service specific thresholds using deterministic rules." },
  { question: "What is Decision Confidence?", answer: "Decision Confidence measures how clearly the current metrics support the recommendation. It is not a measure of profitability or strategy quality." },
  { question: "Are protocol integrations live?", answer: "Hyperliquid, Aave, and Morpho are live read-only integrations. Pendle, Ethena, live funding inputs, and additional coverage remain planned." },
  { question: "Is my data stored?", answer: "No. The current MVP has no database and does not retain submitted strategy inputs." },
  { question: "Can autonomous agents use DeltaZero?", answer: "Yes. The services expose structured API responses that can be consumed by agents, dashboards, or trading workflows." },
];

const agentBenchmarks = [
  { value: "18.09 ms", label: "Median local decision latency", note: "Four reports · 1,000 paths" },
  { value: "19.48 ms", label: "P95 local decision latency", note: "50 measured runs" },
  { value: "50 / 50", label: "Identical normalized outputs", note: "Fixed inputs and seed" },
  { value: "12 / 12", label: "Reference-policy agreement", note: "Expected action fixtures" },
];

const agentComparison = [
  { measure: "Agent integration", deltazero: "One typed API or MCP call", script: "Custom code, parser, and deployment", spreadsheet: "Human-operated workflow" },
  { measure: "Decision coverage", deltazero: "Four coordinated risk reports", script: "Depends on the implementation", spreadsheet: "Depends on workbook design" },
  { measure: "Measured decision latency", deltazero: "18.09 ms p50 · 19.48 ms p95", script: "Not benchmarked—no canonical script", spreadsheet: "Not benchmarked—human dependent" },
  { measure: "Repeatability evidence", deltazero: "50/50 identical normalized outputs", script: "Depends on seed, code, and tests", spreadsheet: "Depends on formula and version control" },
  { measure: "Policy-case evidence", deltazero: "12/12 reference fixtures passed", script: "No shared fixture set by default", spreadsheet: "Manual review required" },
  { measure: "Machine-readable contract", deltazero: "Validated structured JSON", script: "Must be designed and maintained", spreadsheet: "Export or wrapper required" },
  { measure: "Operational burden", deltazero: "Maintained thresholds and schemas", script: "Agent owner maintains the full stack", spreadsheet: "Formula, input, and handoff risk" },
];

// ─── Risk Zone data ─────────────────────────────────────────

const riskZoneData = [
  { zone: "Optimal", color: "emerald", threshold: ">80% / >70% / >60%", description: "Preferred range. Strategy is well within safety limits.", action: "OPEN or HOLD" },
  { zone: "Healthy", color: "teal", threshold: "60-80% / 50-70% / 40-60%", description: "Acceptable risk. Minor hedge drift may be present.", action: "HOLD or WAIT" },
  { zone: "Watch", color: "amber", threshold: "40-60% / 30-50% / 20-40%", description: "Review required. Hedge drift or carry weakening.", action: "REBALANCE" },
  { zone: "Defensive", color: "orange", threshold: "20-40% / 15-30% / 10-20%", description: "Adjustment likely. Collateral at risk.", action: "REDUCE" },
  { zone: "Critical", color: "rose", threshold: "<20% / <15% / <10%", description: "Safety limits exceeded. Immediate action needed.", action: "CLOSE" },
];

export default function Home() {
  return (
    <>
      {/* ─── Hero: Interactive Strategy Builder ─────────────────────── */}
      <section id="builder" className="section-wrap" style={{ paddingTop: 48, borderTop: "none" }}>
        <div className="text-center mb-8">
          <p className="kicker">Build a strategy. See the risk. In seconds.</p>
          <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 590, letterSpacing: "-.04em", lineHeight: 1.1 }}>
            Know your hedge.<br /><span style={{ color: "#859188" }}>Protect your capital.</span>
          </h1>
          <p className="hero-copy" style={{ maxWidth: 640, margin: "0 auto", fontSize: 15 }}>
            DeltaZero helps agents and users build strategies, analyze hedge drift, and test funding stress for pseudo delta neutral DeFi positions using deterministic risk analysis, supported read-only protocol data, and Monte Carlo sensitivity.
          </p>
          <p className="hero-positioning" style={{ maxWidth: 640, margin: "16px auto 0" }}>
            The only MCP service on OKX.AI that runs a 4-module deterministic risk engine with on-chain x402 settlement — no custody, no signatures, 18ms.
          </p>
        </div>
        <div className="flex justify-center gap-3 mt-6 mb-8 flex-wrap">
          <span className="px-3 py-1.5 border border-slate-700/50 rounded-full text-[10px] text-slate-500 font-mono tracking-wider">Read only</span>
          <span className="px-3 py-1.5 border border-slate-700/50 rounded-full text-[10px] text-slate-500 font-mono tracking-wider">No signatures</span>
          <span className="px-3 py-1.5 border border-slate-700/50 rounded-full text-[10px] text-slate-500 font-mono tracking-wider">Deterministic engine</span>
          <span className="px-3 py-1.5 border border-slate-700/50 rounded-full text-[10px] text-slate-500 font-mono tracking-wider">Agent payment ready</span>
        </div>
        <StrategyBuilder />
        <div className="flex justify-center gap-3 mt-6 flex-wrap">
          <Link href="/risk-engine" className="button button-primary">Launch Full Risk Engine <span>→</span></Link>
          <Link href="/agent" className="button button-secondary">Agent Console <span>◎</span></Link>
        </div>
      </section>

      {/* ─── How the Engine Works ─────────────────────────────────── */}
      <section className="section-wrap" id="how-it-works">
        <div className="section-heading">
          <div><p className="kicker">Deterministic by design</p><h2>How the engine works</h2></div>
          <p>Every metric is calculated through documented formulas. Same inputs always produce the same outputs.</p>
        </div>

        <div className="step-grid">
          {howItWorks.map((step) => (
            <article key={step.step} className="step-card">
              <div className="step-badge">{step.step}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Risk Zones Explained ─────────────────────────────────── */}
      <section className="section-wrap" id="risk-zones">
        <div className="section-heading">
          <div><p className="kicker">Five operator-friendly zones</p><h2>Risk Zones Explained</h2></div>
          <p>DeltaZero classifies every report into one of five zones. Each zone has a deterministic threshold per risk tolerance and maps to a clear action.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {riskZoneData.map((rz) => {
            const colorVar = `var(--${rz.color === "emerald" ? "green" : rz.color === "teal" ? "teal" : rz.color === "amber" ? "warning" : rz.color === "orange" ? "orange" : "danger"})`;
            return (
              <article key={rz.zone} className="risk-zone-mini" style={{ "--zone-accent": colorVar } as React.CSSProperties}>
                <strong>{rz.zone}</strong>
                <span style={{ marginTop: 4, fontSize: 10, opacity: 0.7 }}>{rz.threshold}</span>
                <span style={{ marginTop: 8 }}>{rz.description}</span>
                <span style={{ marginTop: 6, fontWeight: 700, fontSize: 10 }}>Action: {rz.action}</span>
              </article>
            );
          })}
        </div>
        <details className="mt-6" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, background: "var(--panel)" }}>
          <summary style={{ cursor: "pointer", fontWeight: 650, color: "var(--ink)" }}>
            <span>Inspect the threshold formulas</span>
          </summary>
          <div className="mt-4 space-y-4" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
            <p><strong>Safety Buffer</strong> = (Collateral Reserve / Capital at Risk) × Risk Tolerance Multiplier</p>
            <p>Risk Tolerance Multipliers: Conservative = 1.5, Medium = 1.0, Aggressive = 0.6</p>
            <p><strong>Net Carry APY</strong> = Long Yield APY − Short Funding APY − Fee Drag APY</p>
            <p><strong>Decision Confidence</strong> = 100 − |Safety Buffer − Zone Midpoint| − (Hedge Drift × 5)</p>
            <p><strong>Zone thresholds by risk tolerance:</strong></p>
            <div className="grid grid-cols-5 gap-2 mt-2 overflow-x-auto" style={{ fontSize: 10 }}>
              {["", "Optimal", "Healthy", "Watch", "Defensive", "Critical"].map(h => <div key={h} style={{ fontWeight: 700, color: "var(--ink)" }}>{h}</div>)}
              <div style={{ color: "var(--green)" }}>Conservative</div>
              <div>&gt;80%</div><div>60-80%</div><div>40-60%</div><div>20-40%</div><div>&lt;20%</div>
              <div style={{ color: "var(--green)" }}>Medium</div>
              <div>&gt;70%</div><div>50-70%</div><div>30-50%</div><div>15-30%</div><div>&lt;15%</div>
              <div style={{ color: "var(--green)" }}>Aggressive</div>
              <div>&gt;60%</div><div>40-60%</div><div>20-40%</div><div>10-20%</div><div>&lt;10%</div>
            </div>
          </div>
        </details>
      </section>

      {/* ─── Engine Math ──────────────────────────────────────────── */}
      <section className="section-wrap" id="engine-math">
        <div className="section-heading">
          <div><p className="kicker">Transparent calculations</p><h2>Inspect the math</h2></div>
          <p>All formulas are documented in the methodology page and backend tests. No black-box models.</p>
        </div>

        <div className="formula-grid">
          <article>
            <h3>Safety Buffer</h3>
            <code>buffer = min(100, collateral / short_notional × 200)</code>
            <p>Measures collateral coverage relative to the short position. Higher is safer.</p>
          </article>
          <article>
            <h3>Hedge Drift</h3>
            <code>drift = |1 − hedge_ratio| × 100</code>
            <p>Deviation from the target hedge ratio. Drives rebalance decisions.</p>
          </article>
          <article>
            <h3>Net Carry</h3>
            <code>carry = long_yield − funding_cost − fees</code>
            <p>Annualized return estimate from yield minus funding and fees. Can be negative.</p>
          </article>
          <article>
            <h3>Decision Confidence</h3>
            <code>confidence = 100 − |buffer − midpoint| − drift × 5</code>
            <p>How clearly the metrics support the recommended action. Caps at 0-100.</p>
          </article>
          <article>
            <h3>Risk Zone</h3>
            <code>zone = f(buffer, tolerance)</code>
            <p>Maps Safety Buffer to a zone based on risk tolerance thresholds.</p>
          </article>
          <article>
            <h3>Monte Carlo</h3>
            <code>S(t+dt) = S(t) × exp((μ−½σ²)dt + σ√dt × Z)</code>
            <p>Geometric Brownian Motion with daily volatility derived from 60% annualized vol.</p>
          </article>
        </div>
        <div className="mt-4">
          <Link href="/methodology" className="button button-secondary">Full Methodology <span>↗</span></Link>
        </div>
      </section>

      {/* ─── Live Protocol Data ───────────────────────────────────── */}
      <section className="section-wrap" id="live-data">
        <div className="section-heading">
          <div><p className="kicker">Real-time market context</p><h2>Live Protocol Data</h2></div>
          <p>Simulated feeds for demo. Live data available via the production API.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="integration-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Demo</span>
            </div>
            <h3 className="text-base mb-1">SOL Funding Rate</h3>
            <div className="text-2xl font-mono font-bold text-emerald-400 mb-1">-0.003%</div>
            <div className="text-xs text-slate-500">per 8h · Hyperliquid</div>
            <div className="mt-3 text-[10px] text-slate-600">Updated 12s ago</div>
          </article>
          <article className="integration-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Demo</span>
            </div>
            <h3 className="text-base mb-1">ETH Supply APY</h3>
            <div className="text-2xl font-mono font-bold text-emerald-400 mb-1">3.2%</div>
            <div className="text-xs text-slate-500">Aave v3 · Ethereum</div>
            <div className="mt-3 text-[10px] text-slate-600">Updated 45s ago</div>
          </article>
          <article className="integration-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Demo</span>
            </div>
            <h3 className="text-base mb-1">SOL Open Interest</h3>
            <div className="text-2xl font-mono font-bold text-slate-200 mb-1">$2.4B</div>
            <div className="text-xs text-slate-500">Hyperliquid</div>
            <div className="mt-3 text-[10px] text-slate-600">Updated 8s ago</div>
          </article>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Ticker values are simulated for this demo. The same engine powers live data via the production API.
        </p>
      </section>

      {/* ─── Agent Integration (code block) ────────────────────────── */}
      <section className="section-wrap" id="agent-integration">
        <div className="section-heading">
          <div><p className="kicker">One typed call</p><h2>Agent Integration</h2></div>
          <p>DeltaZero exposes a complete risk engine through REST, MCP, and SDKs. Agents consume structured JSON directly.</p>
        </div>
        <div className="sdk-panel panel" style={{ overflow: "hidden" }}>
          <div className="sdk-tabs">
            <button className="sdk-tab sdk-tab-active">TypeScript</button>
            <button className="sdk-tab">Python</button>
            <button className="sdk-tab">MCP</button>
          </div>
          <div className="sdk-code-block" style={{ marginTop: 16 }}>
            <pre>{`import { DeltaZeroClient } from "deltazero-core";

const client = new DeltaZeroClient({
  baseUrl: "https://deltazero-production.up.railway.app",
});

// Build and evaluate a strategy
const report = await client.buildStrategy({
  asset: "SOL",
  capital_usd: 5000,
  risk_tolerance: "medium",
  target_style: "neutral_yield",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
});

console.log(report.recommendation.action);
// "HOLD"

if (report.action === "REBALANCE") {
  await agent.executeRebalance(report.params);
}`}</pre>
          </div>
          <div className="sdk-code-head">
            <span>npm: deltazero-core</span>
            <a href="https://www.npmjs.com/package/deltazero-core" target="_blank" rel="noreferrer" className="sdk-copy-button">npm ↗</a>
            <a href="https://pypi.org/project/deltazero-core/" target="_blank" rel="noreferrer" className="sdk-copy-button">PyPI ↗</a>
          </div>
        </div>
      </section>

      {/* ─── Products ────────────────────────────────────────────── */}
      <section id="products" className="section-wrap anchor-section">
        <div className="section-heading">
          <div><p className="kicker">What DeltaZero does</p><h2>Five connected services, one coherent risk workflow.</h2></div>
          <p>Each product is a focused view of the same underlying strategy engine, tuned for a different question.</p>
        </div>
        <div className="tool-grid product-grid">
          {products.map((tool) => (
            <Link href={tool.href} className="tool-card product-card" key={tool.href}>
              <div className="tool-number">{tool.number}</div>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <ul className="product-bullets">{tool.bullets.map((bullet) => (<li key={bullet}>{bullet}</li>))}</ul>
              <span>{tool.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Integrations ────────────────────────────────────────── */}
      <section id="integrations" className="section-wrap anchor-section">
        <div className="section-heading">
          <div><p className="kicker">Integrations</p><h2>Supported read-only integrations and roadmap coverage.</h2></div>
          <p>Live integrations are read-only. DeltaZero does not request signatures, private keys, approvals, or transaction permissions.</p>
        </div>
        <div className="integration-group">
          <div className="integration-group-head"><p className="kicker">Live read-only integrations</p><span>Supported now</span></div>
          <div className="integration-grid">{liveIntegrations.map((item) => (
            <article key={item.name} className="integration-card"><div className="integration-head"><h3>{item.name}</h3><span>{item.badge}</span></div><p>{item.useCase}</p></article>
          ))}</div>
        </div>
        <div className="integration-group">
          <div className="integration-group-head"><p className="kicker">Planned integrations</p><span>Roadmap coverage</span></div>
          <div className="integration-grid">{plannedIntegrations.map((item) => (
            <article key={item.name} className="integration-card"><div className="integration-head"><h3>{item.name}</h3><span>{item.badge}</span></div><p>{item.useCase}</p></article>
          ))}</div>
          <p className="integration-note">Unsupported positions and unavailable data sources are reported explicitly and are not treated as zero risk.</p>
        </div>
      </section>

      {/* ─── Why Agents ──────────────────────────────────────────── */}
      <section id="why-agents" className="section-wrap why-agents-section anchor-section">
        <div className="section-heading">
          <div><p className="kicker">Why agents choose DeltaZero</p><h2>Buy the maintained decision contract—not another risk-engine project.</h2></div>
          <p>One typed request returns Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Monte Carlo Sensitivity without custom parsers, duplicated thresholds, or spreadsheet orchestration.</p>
        </div>

        <div className="agent-benchmark-summary" aria-label="Measured DeltaZero benchmark results">
          {agentBenchmarks.map((benchmark) => (
            <article key={benchmark.label}><strong>{benchmark.value}</strong><span>{benchmark.label}</span><small>{benchmark.note}</small></article>
          ))}
        </div>

        <div className="agent-comparison-shell">
          <div className="agent-comparison-heading">
            <div><p className="kicker">Build versus integrate</p><h3>DeltaZero compared with common alternatives</h3></div>
            <span>Measured values are shown only where a reproducible benchmark exists.</span>
          </div>
          <div className="agent-comparison-table-wrap">
            <table className="agent-comparison-table">
              <thead><tr><th scope="col">Measure</th><th scope="col">DeltaZero</th><th scope="col">Ad-hoc Python script</th><th scope="col">Manual spreadsheet</th></tr></thead>
              <tbody>{agentComparison.map((row) => (
                <tr key={row.measure}><th scope="row">{row.measure}</th><td data-label="DeltaZero">{row.deltazero}</td><td data-label="Ad-hoc Python script">{row.script}</td><td data-label="Manual spreadsheet">{row.spreadsheet}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── FAQs ────────────────────────────────────────────────── */}
      <section id="faqs" className="section-wrap anchor-section">
        <div className="section-heading"><div><p className="kicker">FAQs</p><h2>Common questions, answered directly.</h2></div><p>The MVP is intentionally narrow, deterministic, and transparent about its limits.</p></div>
        <div className="faq-list">{faqs.map((item) => (
          <details key={item.question} className="faq-item"><summary><span>{item.question}</span><i>+</i></summary><p>{item.answer}</p></details>
        ))}</div>
      </section>

      {/* ─── Quick Links ─────────────────────────────────────────── */}
      <section id="quick-links" className="section-wrap anchor-section">
        <div className="section-heading"><div><p className="kicker">Quick links</p><h2>Navigate the product without losing context.</h2></div><p>The landing page is organized as a lightweight documentation surface so users can move from overview to workflow, integrations, documentation, and support in a single pass.</p></div>
        <div className="quick-links-grid">
          <div className="quick-links-nav panel"><div className="panel-title">Navigation</div><nav className="quick-links-list" aria-label="Landing page quick links">{quickLinks.map((link) => (<Link key={link.href} href={link.href} className="quick-link-row"><span>{link.label}</span><small>{link.note}</small></Link>))}</nav></div>
          <div className="quick-links-panel panel"><div className="panel-title">External links</div><div className="quick-links-external">{externalLinks.map((link) => (<a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="external-link-card"><strong>{link.label}</strong><span>{link.href.replace("https://", "")}</span><i>↗</i></a>))}</div></div>
        </div>
      </section>
    </>
  );
}
