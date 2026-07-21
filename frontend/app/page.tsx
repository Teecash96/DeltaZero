import Link from "next/link";
import { AgentSdkSection } from "@/components/agent-sdk-section";

const quickLinks = [
  { label: "Home", href: "#home", note: "Hero and product summary" },
  { label: "How It Works", href: "#how-it-works", note: "The five-step workflow" },
  { label: "Products", href: "#products", note: "Five connected risk services" },
  { label: "Integrations", href: "#integrations", note: "Live and planned read-only coverage" },
  { label: "Docs", href: "#docs", note: "Repository and API references" },
  { label: "Why Agents", href: "#why-agents", note: "Measured latency and repeatability" },
  { label: "Strategy Registry", href: "#strategy-registry", note: "Opt-in recommendation and outcome memory" },
  { label: "Agents", href: "#agents", note: "SDKs and automated workflows" },
  { label: "FAQs", href: "#faqs", note: "Common questions and constraints" },
];

const externalLinks = [
  { label: "Documentation", href: "https://github.com/Teecash96/DeltaZero#readme" },
  { label: "GitHub", href: "https://github.com/Teecash96/DeltaZero" },
  { label: "X", href: "https://x.com/DeltaZeroASP" },
];

const howItWorks = [
  {
    step: "01",
    title: "Input",
    description:
      "Users provide the asset, capital, risk tolerance, target style, yield assumptions, funding assumptions, fees, or existing position data.",
  },
  {
    step: "02",
    title: "Analyze",
    description:
      "DeltaZero evaluates estimated carry, hedge ratio, hedge drift, net delta, collateral resilience, capital at risk, and Safety Buffer.",
  },
  {
    step: "03",
    title: "Assess",
    description:
      "The deterministic risk engine compares the metrics against thresholds based on risk tolerance, target style, service type, and stress scenario.",
  },
  {
    step: "04",
    title: "Decide",
    description:
      "DeltaZero returns strategy health, recommended action, Decision Confidence, risk notes, and a recommended structure where applicable.",
  },
  {
    step: "05",
    title: "Act",
    description:
      "The user or an autonomous agent can use the result to OPEN, WAIT, HOLD, REBALANCE, REDUCE, or CLOSE.",
  },
];

const products = [
  {
    href: "/builder",
    number: "01",
    title: "Strategy Build",
    description:
      "Builds a pseudo delta neutral strategy from capital, market assumptions, risk tolerance, and target style.",
    bullets: ["Recommended long notional", "Short notional", "Collateral allocation", "Hedge ratio", "Carry metrics", "Safety Buffer", "Action"],
    action: "Open Strategy Build",
  },
  {
    href: "/auditor",
    number: "02",
    title: "Hedge-Drift Auditing",
    description:
      "Analyzes an existing long, short, and collateral structure for current health and corrective action.",
    bullets: ["Current health", "Hedge drift", "Capital risk", "Safety Buffer", "Corrective action"],
    action: "Analyze Hedge Drift",
  },
  {
    href: "/stress-test",
    number: "03",
    title: "Funding Stress Testing",
    description:
      "Applies deterministic scenarios such as funding worsens, yield drops, price shock, or collateral pressure.",
    bullets: ["Post stress metrics", "Post stress health", "Recommended action", "Scenario impact"],
    action: "Run Funding Stress Test",
  },
  {
    href: "/wallet",
    number: "04",
    title: "Hedge Intelligence",
    description:
      "Discovers supported public positions and converts portfolio exposure into an explainable risk assessment.",
    bullets: ["Public position discovery", "Net exposure", "Hedge ratio", "Protocol allocation", "Portfolio verdict"],
    action: "Open Hedge Intelligence",
  },
  {
    href: "/monte-carlo",
    number: "05",
    title: "Monte Carlo Sensitivity",
    description:
      "Simulates bounded stress paths to measure impairment, hedge drift, negative carry, and Safety Buffer fragility.",
    bullets: ["P95 and P99 impairment", "Breach probabilities", "Sensitivity drivers", "Sample paths", "Risk-zone verdict"],
    action: "Run Monte Carlo",
  },
];

const liveIntegrations = [
  {
    name: "Hyperliquid",
    badge: "LIVE",
    useCase: "Read-only perpetual positions, margin data, account value, unrealized PnL, and liquidation context through public protocol data.",
  },
  {
    name: "Aave",
    badge: "LIVE WITH RPC",
    useCase: "Read-only supply, borrow, collateral, debt, and health-factor analysis when supported RPC access is configured.",
  },
  {
    name: "Morpho",
    badge: "LIVE",
    useCase: "Read-only market and vault positions through Morpho’s supported public data API.",
  },
];

const plannedIntegrations = [
  { name: "Pendle", badge: "PLANNED", useCase: "Fixed-yield, PT, YT, and maturity-risk analysis." },
  { name: "Ethena", badge: "PLANNED", useCase: "Synthetic-dollar and hedged-yield strategy analysis." },
  { name: "Live Funding Rates", badge: "PLANNED", useCase: "Continuous real-time funding inputs from supported venues." },
  {
    name: "Additional Wallet and Protocol Coverage",
    badge: "PLANNED",
    useCase: "More networks, assets, protocols, LP positions, and portfolio adapters.",
  },
];

const strategyPlatforms = [
  {
    title: "Neutral Yield Carry",
    use: "Hold or earn yield on the long leg while shorting perpetual futures to reduce directional exposure.",
    platforms: "Hyperliquid, OKX, Drift, GMX, Aave, Morpho, Kamino",
  },
  {
    title: "Conservative Income",
    use: "Lower leverage, larger collateral reserve, tighter hedge, lower capital risk.",
    platforms: "Aave, Morpho, Spark, Compound, Silo",
  },
  {
    title: "Aggressive Carry",
    use: "Higher capital deployment, higher expected carry, wider risk tolerance, smaller collateral reserve.",
    platforms: "Hyperliquid, OKX, Drift, GMX, Ethena",
  },
  {
    title: "Capital Preservation",
    use: "Principal protection, tight hedge alignment, large collateral reserve, low capital at risk.",
    platforms: "Aave, Morpho, Pendle fixed yield, Spark, Ethena hedged products",
  },
];

const faqs = [
  {
    question: "Is DeltaZero non custodial?",
    answer: "Yes. The current MVP does not hold funds, connect wallets, or execute transactions.",
  },
  {
    question: "Does DeltaZero execute trades?",
    answer: "No. It provides deterministic risk analysis and recommendations only.",
  },
  { question: "Which assets are supported?", answer: "The current MVP supports SOL and ETH." },
  {
    question: "Which target styles are supported?",
    answer: "Neutral Yield, Conservative Income, Aggressive Carry, and Capital Preservation.",
  },
  {
    question: "How is the recommendation generated?",
    answer:
      "The backend evaluates carry, hedge alignment, Safety Buffer, capital risk, and service specific thresholds using deterministic rules.",
  },
  {
    question: "What is Decision Confidence?",
    answer:
      "Decision Confidence measures how clearly the current metrics support the recommendation. It is not a measure of profitability or strategy quality.",
  },
  {
    question: "Are protocol integrations live?",
    answer:
      "Hyperliquid, Aave, and Morpho are live read-only integrations. Pendle, Ethena, live funding inputs, and additional coverage remain planned. Hedge Intelligence is temporarily free during listing review.",
  },
  {
    question: "Is my data stored?",
    answer: "No. The current MVP has no database and does not retain submitted strategy inputs.",
  },
  {
    question: "Can autonomous agents use DeltaZero?",
    answer:
      "Yes. The services expose structured API responses that can be consumed by agents, dashboards, or trading workflows.",
  },
];

const agentBenchmarks = [
  { value: "18.09 ms", label: "Median local decision latency", note: "Four reports · 1,000 paths" },
  { value: "19.48 ms", label: "P95 local decision latency", note: "50 measured runs" },
  { value: "50 / 50", label: "Identical normalized outputs", note: "Fixed inputs and seed" },
  { value: "12 / 12", label: "Reference-policy agreement", note: "Expected action fixtures" },
];

const agentComparison = [
  {
    measure: "Agent integration",
    deltazero: "One typed API or MCP call",
    script: "Custom code, parser, and deployment",
    spreadsheet: "Human-operated workflow",
  },
  {
    measure: "Decision coverage",
    deltazero: "Four coordinated risk reports",
    script: "Depends on the implementation",
    spreadsheet: "Depends on workbook design",
  },
  {
    measure: "Measured decision latency",
    deltazero: "18.09 ms p50 · 19.48 ms p95",
    script: "Not benchmarked—no canonical script",
    spreadsheet: "Not benchmarked—human dependent",
  },
  {
    measure: "Repeatability evidence",
    deltazero: "50/50 identical normalized outputs",
    script: "Depends on seed, code, and tests",
    spreadsheet: "Depends on formula and version control",
  },
  {
    measure: "Policy-case evidence",
    deltazero: "12/12 reference fixtures passed",
    script: "No shared fixture set by default",
    spreadsheet: "Manual review required",
  },
  {
    measure: "Machine-readable contract",
    deltazero: "Validated structured JSON",
    script: "Must be designed and maintained",
    spreadsheet: "Export or wrapper required",
  },
  {
    measure: "Operational burden",
    deltazero: "Maintained thresholds and schemas",
    script: "Agent owner maintains the full stack",
    spreadsheet: "Formula, input, and handoff risk",
  },
];

export default function Home() {
  return (
    <>
      <section id="home" className="hero-shell hero-marketing anchor-section">
        <div className="hero-marketing-copy">
          <h1>Know your hedge.<br /><span>Protect your capital.</span></h1>
          <p className="hero-copy">DeltaZero helps agents and users build strategies, analyze hedge drift, and test funding stress for pseudo delta neutral DeFi positions using deterministic risk analysis, supported read-only protocol data, and Monte Carlo sensitivity.</p>
          <div className="hero-actions">
            <Link href="/risk-engine" className="button button-primary">Launch Risk Engine <span>→</span></Link>
            <Link href="/agent" className="button button-secondary">Agent Console <span>◎</span></Link>
            <Link href="/wallet" className="button button-secondary">Hedge Intelligence <span>◇</span></Link>
          </div>
          <div className="hero-trust-badges" aria-label="DeltaZero trust properties">
            {['Read only', 'No signatures', 'Deterministic engine', 'Agent payment ready'].map((badge) => <span key={badge}>✓ {badge}</span>)}
          </div>
        </div>
        <div className="hero-risk-dashboard glass-card" aria-label="Illustrative risk dashboard">
          <div className="hero-dashboard-head"><div><span>Illustrative risk dashboard</span><strong>SOL neutral carry</strong></div><i>ΔZ / 01</i></div>
          <div className="hero-dashboard-grid">
            <article className="hero-safety-gauge">
              <div className="hero-gauge" role="img" aria-label="Illustrative Safety Buffer score 76 out of 100"><strong>76</strong><span>/100</span></div>
              <div>
                <span>Safety Buffer</span>
                <b>Healthy · 80th percentile</b>
                <small>Better than 80% of 1,001 bounded DeltaZero SOL reference configurations.</small>
                <em>+16 points above the medium-risk warning threshold.</em>
              </div>
            </article>
            <article className="hero-mini-metric"><span>Hedge Drift</span><strong>4.2%</strong><small>Inside illustrative tolerance</small></article>
            <article className="hero-mini-metric"><span>Net Carry APY</span><strong>9.8%</strong><small>Illustrative annual estimate</small></article>
          </div>
          <div className="hero-dashboard-lower">
            <article className="hero-histogram"><div><span>Monte Carlo Distribution</span><small>Illustrative stress paths</small></div><div className="hero-histogram-bars" aria-hidden="true">{[18, 30, 48, 70, 92, 78, 55, 36, 22].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article>
            <article className="hero-position-card"><span>Delta neutral position</span><div><b>↑ Long SOL</b><b>↓ Short SOL Perp</b></div><strong>Near Neutral</strong></article>
          </div>
          <div className="hero-benchmark-note">
            <span>Reference context</span>
            <p>Illustrative policy cohort—not a ranking of live Hyperliquid accounts.</p>
            <a href="https://github.com/Teecash96/DeltaZero/blob/main/backend/benchmarks/safety_buffer_reference.json" target="_blank" rel="noreferrer">Inspect cohort ↗</a>
          </div>
        </div>
      </section>

      <section className="section-wrap risk-zones-home anchor-section" aria-labelledby="risk-zones-home-title">
        <div className="section-heading">
          <div>
            <p className="kicker">Deterministic interpretation</p>
            <h2 id="risk-zones-home-title">Risk zones that agents can understand</h2>
          </div>
          <p>DeltaZero translates complex hedge, carry, impairment, and stress metrics into clear operator zones.</p>
        </div>
        <div className="risk-zones-home-grid">
          {[
            ["Optimal", "Preferred range"],
            ["Healthy", "Acceptable risk"],
            ["Watch", "Review required"],
            ["Defensive", "Adjustment likely"],
            ["Critical", "Safety limits exceeded"],
          ].map(([zone, note], index) => (
            <article className={`risk-zone-mini risk-zone-${zone.toLowerCase()}`} key={zone}>
              <i aria-hidden="true">0{index + 1}</i>
              <strong>{zone}</strong>
              <span>{note}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-wrap action-demo-section anchor-section" aria-labelledby="action-demo-title">
        <div className="section-heading"><div><p className="kicker">Live product workflow</p><h2 id="action-demo-title">Run DeltaZero end to end.</h2></div><p>Use the real free analysis services across one connected risk workflow.</p></div>
        <div className="action-demo-shell glass-card">
          <div className="action-demo-track">
            {[['01', 'Hedge Intelligence', 'Read supported public positions.'], ['02', 'Build Hedge Recommendation', 'Convert exposure into a proposed adjustment.'], ['03', 'Strategy Build', 'Evaluate carry, hedge quality, and resilience.'], ['04', 'Monte Carlo Sensitivity', 'Measure impairment across bounded stress paths.'], ['05', 'Funding Stress Testing', 'Apply a deterministic funding scenario.']].map(([step, title, copy]) => <article key={step}><span>{step}</span><div><strong>{title}</strong><p>{copy}</p></div></article>)}
          </div>
          <Link href="/risk-engine" className="button button-primary">Launch Risk Engine <span>→</span></Link>
        </div>
      </section>

      <section id="quick-links" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Quick links</p>
            <h2>Navigate the product without losing context.</h2>
          </div>
          <p>
            The landing page is organized as a lightweight documentation surface so users can move from overview to
            workflow, integrations, documentation, and support in a single pass.
          </p>
        </div>
        <div className="quick-links-grid">
          <div className="quick-links-nav panel">
            <div className="panel-title">Navigation</div>
            <nav className="quick-links-list" aria-label="Landing page quick links">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="quick-link-row">
                  <span>{link.label}</span>
                  <small>{link.note}</small>
                </Link>
              ))}
            </nav>
          </div>
          <div className="quick-links-panel panel">
            <div className="panel-title">External links</div>
            <div className="quick-links-external">
              {externalLinks.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="external-link-card">
                  <strong>{link.label}</strong>
                  <span>{link.href.replace("https://", "")}</span>
                  <i>↗</i>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">How it works</p>
            <h2>Five deterministic steps from inputs to action.</h2>
          </div>
          <p>
            DeltaZero is a decision-support system. It takes the inputs you already know, applies deterministic risk
            rules, and returns an explicit next step.
          </p>
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

      <section id="products" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">What DeltaZero does</p>
            <h2>Five connected services, one coherent risk workflow.</h2>
          </div>
          <p>Each product is a focused view of the same underlying strategy engine, tuned for a different question.</p>
        </div>
        <div className="tool-grid product-grid">
          {products.map((tool) => (
            <Link href={tool.href} className="tool-card product-card" key={tool.href}>
              <div className="tool-number">{tool.number}</div>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <ul className="product-bullets">
                {tool.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <span>{tool.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="integrations" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Integrations</p>
            <h2>Supported read-only integrations and roadmap coverage.</h2>
          </div>
          <p>Live integrations are read-only. DeltaZero does not request signatures, private keys, approvals, or transaction permissions.</p>
        </div>
        <div className="integration-group">
          <div className="integration-group-head">
            <p className="kicker">Live read-only integrations</p>
            <span>Supported now</span>
          </div>
          <div className="integration-grid">
            {liveIntegrations.map((item) => (
              <article key={item.name} className="integration-card">
                <div className="integration-head">
                  <h3>{item.name}</h3>
                  <span>{item.badge}</span>
                </div>
                <p>{item.useCase}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="integration-group">
          <div className="integration-group-head">
            <p className="kicker">Hedge Intelligence</p>
            <span>Pro preview</span>
          </div>
          <div className="integration-single">
            <article className="integration-card">
              <div className="integration-head">
                <h3>Hedge Intelligence</h3>
                <span>PRO PREVIEW</span>
              </div>
              <p>Read-only wallet position discovery and portfolio risk assessment across supported integrations.</p>
            </article>
          </div>
        </div>
        <div className="integration-group">
          <div className="integration-group-head">
            <p className="kicker">Planned integrations</p>
            <span>Roadmap coverage</span>
          </div>
          <div className="integration-grid">
            {plannedIntegrations.map((item) => (
              <article key={item.name} className="integration-card">
                <div className="integration-head">
                  <h3>{item.name}</h3>
                  <span>{item.badge}</span>
                </div>
                <p>{item.useCase}</p>
              </article>
            ))}
          </div>
          <p className="integration-note">
            Unsupported positions and unavailable data sources are reported explicitly and are not treated as zero risk.
          </p>
        </div>
      </section>

      <section id="strategy-platforms" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Where these strategies can be used</p>
            <h2>Strategy styles and the platforms they map to.</h2>
          </div>
          <p>
            DeltaZero currently analyzes user supplied assumptions and does not execute trades or connect directly to
            these protocols.
          </p>
        </div>
        <div className="strategy-grid">
          {strategyPlatforms.map((strategy) => (
            <article key={strategy.title} className="strategy-card">
              <h3>{strategy.title}</h3>
              <p>{strategy.use}</p>
              <strong>Relevant platforms</strong>
              <span>{strategy.platforms}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="docs" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Docs</p>
            <h2>Repository documentation and API references.</h2>
          </div>
          <p>Documentation links point to the current repository while the MVP remains in active development.</p>
        </div>
        <div className="docs-grid">
          <article className="docs-card">
            <h3>Documentation</h3>
            <p>The canonical repository README describes installation, architecture, API usage, and limitations.</p>
            <a href="https://github.com/Teecash96/DeltaZero#readme" target="_blank" rel="noreferrer">
              Repository README ↗
            </a>
          </article>
          <article className="docs-card">
            <h3>API reference</h3>
            <p>The FastAPI backend exposes OpenAPI docs at runtime and the codebase mirrors the request/response models.</p>
            <span>See the backend service when it is running locally or in deployment.</span>
          </article>
        </div>
      </section>

      <section id="why-agents" className="section-wrap why-agents-section anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Why agents choose DeltaZero</p>
            <h2>Buy the maintained decision contract—not another risk-engine project.</h2>
          </div>
          <p>
            One typed request returns Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Monte Carlo
            Sensitivity without custom parsers, duplicated thresholds, or spreadsheet orchestration.
          </p>
        </div>

        <div className="agent-benchmark-summary" aria-label="Measured DeltaZero benchmark results">
          {agentBenchmarks.map((benchmark) => (
            <article key={benchmark.label}>
              <strong>{benchmark.value}</strong>
              <span>{benchmark.label}</span>
              <small>{benchmark.note}</small>
            </article>
          ))}
        </div>

        <div className="agent-comparison-shell">
          <div className="agent-comparison-heading">
            <div>
              <p className="kicker">Build versus integrate</p>
              <h3>DeltaZero compared with common alternatives</h3>
            </div>
            <span>Measured values are shown only where a reproducible benchmark exists.</span>
          </div>
          <div className="agent-comparison-table-wrap">
            <table className="agent-comparison-table">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">DeltaZero</th>
                  <th scope="col">Ad-hoc Python script</th>
                  <th scope="col">Manual spreadsheet</th>
                </tr>
              </thead>
              <tbody>
                {agentComparison.map((row) => (
                  <tr key={row.measure}>
                    <th scope="row">{row.measure}</th>
                    <td data-label="DeltaZero">{row.deltazero}</td>
                    <td data-label="Ad-hoc Python script">{row.script}</td>
                    <td data-label="Manual spreadsheet">{row.spreadsheet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="agent-benchmark-method">
          <div>
            <strong>What was measured</strong>
            <p>
              Local in-process FastAPI execution on 21 July 2026: 5 warmups, 50 measured runs, four reports per call,
              and 1,000 seeded Monte Carlo paths. Timestamp fields were removed only for repeatability hashing.
            </p>
          </div>
          <div>
            <strong>What was not measured</strong>
            <p>
              Network transit, deployment cold starts, public-protocol fetches, and payment settlement. No synthetic
              latency or error-rate figures are assigned to scripts or spreadsheets without a canonical baseline.
            </p>
          </div>
          <div className="agent-benchmark-links">
            <a
              href="https://github.com/Teecash96/DeltaZero/blob/main/backend/benchmarks/agent_risk_benchmark.py"
              target="_blank"
              rel="noreferrer"
            >
              Reproduce benchmark ↗
            </a>
            <a
              href="https://github.com/Teecash96/DeltaZero/blob/main/backend/benchmarks/results.json"
              target="_blank"
              rel="noreferrer"
            >
              Inspect raw results ↗
            </a>
          </div>
        </div>
        <p className="agent-benchmark-disclaimer">
          Reference-policy agreement verifies DeltaZero&apos;s configured decision rules. It is not a profitability
          forecast or a measured real-world loss rate.
        </p>
      </section>

      <section id="strategy-registry" className="section-wrap registry-home-section anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Agent ecosystem moat</p>
            <h2>Recommendations become evidence—not disposable API responses.</h2>
          </div>
          <p>
            Strategy Registry is an opt-in memory layer that connects each DeltaZero decision with the outcome an
            operator later observes, creating a portable evidence trail for safer policy refinement.
          </p>
        </div>
        <div className="registry-home-grid">
          <div className="registry-home-flow">
            {[
              ["01", "Decide", "Save the recommendation, risk zone, Safety Buffer, and impairment context."],
              ["02", "Observe", "Record whether risk stayed within tolerance, exceeded expectations, or avoided loss."],
              ["03", "Refine", "Surface recurring exceptions before an agent owner changes a risk policy."],
            ].map(([step, title, copy]) => <article key={step}><span>{step}</span><div><strong>{title}</strong><p>{copy}</p></div></article>)}
          </div>
          <article className="registry-home-contract glass-card">
            <span>Memory contract</span>
            <h3>Private by default. Portable by design.</h3>
            <ul>
              <li>Explicit user opt-in</li>
              <li>Browser-local storage</li>
              <li>Observed outcomes stay distinct from predictions</li>
              <li>JSON export and import for agent portability</li>
              <li>No silent threshold retraining</li>
            </ul>
            <Link href="/registry" className="button button-primary">Open Strategy Registry <span>→</span></Link>
          </article>
        </div>
      </section>

      <AgentSdkSection />

      <section id="why-deltazero" className="section-wrap trust-section anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">Why DeltaZero</p>
            <h2>Trust comes from inspectable decisions, not black-box claims.</h2>
          </div>
          <p>DeltaZero is designed for transparent, read-only analysis of user inputs and supported public position data.</p>
        </div>
        <div className="trust-grid">
          {[
            ["◇", "Deterministic analysis", "The same inputs and configured thresholds produce the same explainable result."],
            ["◉", "Read-only access", "Supported wallet integrations retrieve public position context without transaction permissions."],
            ["×", "No trading signatures", "Risk analysis never asks you to sign a trade, approval, or protocol transaction."],
            ["⌂", "No custody", "DeltaZero does not hold funds, control wallets, or execute the recommended action."],
            ["≡", "Transparent calculations", "Metrics, risk notes, decision drivers, and raw JSON remain available for verification."],
          ].map(([icon, title, description]) => <article key={title}><i aria-hidden="true">{icon}</i><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section id="faqs" className="section-wrap anchor-section">
        <div className="section-heading">
          <div>
            <p className="kicker">FAQs</p>
            <h2>Common questions, answered directly.</h2>
          </div>
          <p>The MVP is intentionally narrow, deterministic, and transparent about its limits.</p>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.question} className="faq-item">
              <summary>
                <span>{item.question}</span>
                <i>+</i>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
