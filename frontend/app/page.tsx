import Link from "next/link";

const tools = [
  { href: "/builder", number: "01", title: "Strategy Builder", description: "Design a pseudo-delta-neutral carry structure from capital and risk inputs.", action: "Build a strategy" },
  { href: "/auditor", number: "02", title: "Position Auditor", description: "Measure hedge drift, carry efficiency, and collateral resilience on a live position.", action: "Audit a position" },
  { href: "/stress-test", number: "03", title: "Stress Test", description: "Pressure-test a structure against adverse funding, yield, and price scenarios.", action: "Run a scenario" },
];

export default function Home() {
  return (
    <>
      <section className="hero-shell">
        <div className="eyebrow"><span className="pulse-dot" />Neutral carry intelligence</div>
        <h1>Know your hedge.<br /><span>Protect your capital.</span></h1>
        <p className="hero-copy">Deterministic risk analysis for pseudo-delta-neutral DeFi strategies. Build with intent, audit with clarity, and stress test before the market does.</p>
        <div className="hero-actions">
          <Link href="/builder" className="button button-primary">Build a strategy <span>→</span></Link>
          <Link href="/demo" className="button button-secondary">Explore the demo</Link>
        </div>
        <div className="trust-row"><span>Deterministic outputs</span><span>No wallet required</span><span>SOL &amp; ETH</span></div>
      </section>

      <section className="section-wrap">
        <div className="section-heading"><div><p className="kicker">Risk toolkit</p><h2>Three tools. One clear view.</h2></div><p>From first allocation to ongoing risk management, every output leads to an explicit action.</p></div>
        <div className="tool-grid">
          {tools.map((tool) => (
            <Link href={tool.href} className="tool-card" key={tool.href}>
              <div className="tool-number">{tool.number}</div><h3>{tool.title}</h3><p>{tool.description}</p><span>{tool.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="principle-wrap">
        <div><p className="kicker">The DeltaZero principle</p><h2>Neutral is a target,<br />not a guarantee.</h2></div>
        <div className="principle-copy"><p>Yield changes. Funding flips. Prices move. DeltaZero turns a position into a small set of legible measures, then tells you what to do next.</p><div className="stat-row"><div><strong>7</strong><span>Core risk metrics</span></div><div><strong>6</strong><span>Explicit actions</span></div><div><strong>0</strong><span>Black-box models</span></div></div></div>
      </section>
    </>
  );
}
