import Link from "next/link";

const quickLinks = [
  { label: "Home", href: "#home", note: "Hero and product summary" },
  { label: "How It Works", href: "#how-it-works", note: "The five-step workflow" },
  { label: "Products", href: "#products", note: "Builder, Auditor, Stress Test" },
  { label: "Integrations", href: "#integrations", note: "Planned roadmap connections" },
  { label: "Docs", href: "#docs", note: "Repository and API references" },
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
    title: "Strategy Builder",
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
    title: "Stress Test",
    description:
      "Applies deterministic scenarios such as funding worsens, yield drops, price shock, or collateral pressure.",
    bullets: ["Post stress metrics", "Post stress health", "Recommended action", "Scenario impact"],
    action: "Open Stress Test",
  },
];

const integrations = [
  { name: "Hyperliquid", useCase: "Perpetual short hedges, funding rate monitoring, position data." },
  { name: "Morpho", useCase: "Lending vault yield, collateral and borrowing analysis." },
  { name: "Aave", useCase: "Lending, borrowing, collateral health, stablecoin carry." },
  { name: "Pendle", useCase: "Fixed yield, PT and YT positions, yield maturity analysis." },
  { name: "Ethena", useCase: "Synthetic dollar and hedged yield strategy analysis." },
  { name: "Live Funding Rates", useCase: "Real time perpetual funding inputs from supported venues." },
  { name: "Wallet Position Import", useCase: "Read only wallet based position discovery and portfolio auditing." },
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
      "No. Hyperliquid, Morpho, Aave, Pendle, Ethena, live funding data, and wallet import are planned roadmap integrations.",
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
      <section id="home" className="hero-shell anchor-section">
        <div className="eyebrow">
          <span className="pulse-dot" />
          Neutral carry intelligence
        </div>
        <h1>
          Know your hedge.
          <br />
          <span>Protect your capital.</span>
        </h1>
        <p className="hero-copy">
          Deterministic risk analysis for pseudo-delta-neutral DeFi strategies. Build with intent, audit with clarity,
          and stress test before the market does.
        </p>
        <div className="hero-actions">
          <Link href="/builder" className="button button-primary">
            Build a strategy <span>→</span>
          </Link>
          <Link href="/demo" className="button button-secondary">
            Explore the demo
          </Link>
        </div>
        <div className="trust-row">
          <span>Deterministic outputs</span>
          <span>No wallet required</span>
          <span>SOL &amp; ETH</span>
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
            <h2>Planned Integrations</h2>
          </div>
          <p>These are roadmap integrations, not currently live integrations.</p>
        </div>
        <div className="integration-grid">
          {integrations.map((item) => (
            <article key={item.name} className="integration-card">
              <div className="integration-head">
                <h3>{item.name}</h3>
                <span>Planned</span>
              </div>
              <p>{item.useCase}</p>
            </article>
          ))}
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
