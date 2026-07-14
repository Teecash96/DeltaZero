import Link from "next/link";
import { AgentSdkSection } from "@/components/agent-sdk-section";

const quickLinks = [
  { label: "Home", href: "#home", note: "Hero and product summary" },
  { label: "How It Works", href: "#how-it-works", note: "The five-step workflow" },
  { label: "Products", href: "#products", note: "Builder, Auditor, Stress Test" },
  { label: "Integrations", href: "#integrations", note: "Live and planned read-only coverage" },
  { label: "Docs", href: "#docs", note: "Repository and API references" },
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
    title: "Deterministic Strategy Builder",
    description:
      "Builds a pseudo delta neutral strategy from capital, market assumptions, risk tolerance, and target style.",
    bullets: ["Recommended long notional", "Short notional", "Collateral allocation", "Hedge ratio", "Carry metrics", "Safety Buffer", "Action"],
    action: "Open Builder",
  },
  {
    href: "/auditor",
    number: "02",
    title: "Position Auditor",
    description:
      "Analyzes an existing long, short, and collateral structure for current health and corrective action.",
    bullets: ["Current health", "Hedge drift", "Capital risk", "Safety Buffer", "Corrective action"],
    action: "Open Auditor",
  },
  {
    href: "/stress-test",
    number: "03",
    title: "Portfolio Stress Simulator",
    description:
      "Applies deterministic scenarios such as funding worsens, yield drops, price shock, or collateral pressure.",
    bullets: ["Post stress metrics", "Post stress health", "Recommended action", "Scenario impact"],
    action: "Open Stress Test",
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
      "Hyperliquid, Aave, and Morpho are live read-only integrations. Pendle, Ethena, live funding inputs, and additional coverage remain planned. Wallet Auditor is available as a PRO PREVIEW.",
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

export default function Home() {
  return (
    <>
      <section id="home" className="hero-shell hero-marketing anchor-section">
        <div className="hero-marketing-copy">
          <div className="eyebrow">DEFI RISK INTELLIGENCE ASP</div>
          <h1>Know your hedge.<br /><span>Protect your capital.</span></h1>
          <p className="hero-copy">DeltaZero helps agents and users build, audit, and stress test pseudo delta neutral DeFi strategies using deterministic risk analysis, live market context, and Monte Carlo sensitivity.</p>
          <div className="hero-actions">
            <Link href="/builder" className="button button-primary">Start Risk Analysis <span>→</span></Link>
            <Link href="/monte-carlo" className="button button-secondary">Run Monte Carlo <span>∿</span></Link>
          </div>
          <div className="hero-trust-badges" aria-label="DeltaZero trust properties">
            {['Read only', 'No signatures', 'Deterministic engine', 'OKX x402 ready'].map((badge) => <span key={badge}>✓ {badge}</span>)}
          </div>
        </div>
        <div className="hero-risk-dashboard glass-card" aria-label="Illustrative risk dashboard">
          <div className="hero-dashboard-head"><div><span>Illustrative risk dashboard</span><strong>SOL neutral carry</strong></div><i>ΔZ / 01</i></div>
          <div className="hero-dashboard-grid">
            <article className="hero-safety-gauge"><div className="hero-gauge" role="img" aria-label="Illustrative Safety Buffer 76 percent"><strong>76</strong><span>%</span></div><div><span>Safety Buffer</span><b>Healthy</b><small>Illustrative resilience score</small></div></article>
            <article className="hero-mini-metric"><span>Hedge Drift</span><strong>4.2%</strong><small>Inside illustrative tolerance</small></article>
            <article className="hero-mini-metric"><span>Net Carry APY</span><strong>9.8%</strong><small>Illustrative annual estimate</small></article>
          </div>
          <div className="hero-dashboard-lower">
            <article className="hero-histogram"><div><span>Monte Carlo Distribution</span><small>Illustrative stress paths</small></div><div className="hero-histogram-bars" aria-hidden="true">{[18, 30, 48, 70, 92, 78, 55, 36, 22].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article>
            <article className="hero-position-card"><span>Delta neutral position</span><div><b>↑ Long SOL</b><b>↓ Short SOL Perp</b></div><strong>Near Neutral</strong></article>
          </div>
        </div>
      </section>

      <section className="section-wrap action-demo-section anchor-section" aria-labelledby="action-demo-title">
        <div className="section-heading"><div><p className="kicker">Product walkthrough</p><h2 id="action-demo-title">See DeltaZero in action</h2></div><p>A staged preview of the read-only workflow, prepared for a forthcoming product walkthrough.</p></div>
        <div className="action-demo-shell glass-card">
          <div className="action-demo-track">
            {[['01', 'Wallet Auditor', 'Read supported public positions.'], ['02', 'Build Hedge Recommendation', 'Convert exposure into a proposed adjustment.'], ['03', 'Strategy Builder', 'Evaluate carry, hedge quality, and resilience.'], ['04', 'Monte Carlo Sensitivity', 'Measure impairment across bounded stress paths.'], ['05', 'Stress Test', 'Apply a deterministic downside scenario.']].map(([step, title, copy]) => <article key={step}><span>{step}</span><div><strong>{title}</strong><p>{copy}</p></div></article>)}
          </div>
          <button className="button button-secondary" type="button" disabled>Watch demo soon</button>
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
            <p className="kicker">Products</p>
            <h2>Three services, one coherent risk workflow.</h2>
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
            <p className="kicker">Wallet Auditor</p>
            <span>Pro preview</span>
          </div>
          <div className="integration-single">
            <article className="integration-card">
              <div className="integration-head">
                <h3>Wallet Auditor</h3>
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
