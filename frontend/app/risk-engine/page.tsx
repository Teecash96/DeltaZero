import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Risk Engine — DeltaZero",
  description: "The deterministic risk gate for pseudo delta neutral DeFi positions.",
};

const modules = [
  {
    href: "/builder",
    number: "01",
    title: "Strategy Build",
    description: "Construct a pseudo-delta-neutral strategy from capital, yield, funding, risk tolerance, and target-style assumptions.",
    bullets: ["Long and short allocation", "Hedge ratio", "Net carry", "Safety Buffer"],
    action: "Build a strategy",
  },
  {
    href: "/auditor",
    number: "02",
    title: "Hedge-Drift Auditing",
    description: "Inspect an existing long-and-short structure to identify hedge mismatch, capital risk, and corrective action.",
    bullets: ["Current hedge drift", "Net delta", "Capital at risk", "Rebalance guidance"],
    action: "Audit hedge drift",
  },
  {
    href: "/stress-test",
    number: "03",
    title: "Funding Stress Testing",
    description: "Apply deterministic funding, yield, price, and collateral shocks to measure post-stress resilience.",
    bullets: ["Funding-rate shock", "Post-stress equity", "Impairment breakdown", "Operator action"],
    action: "Run funding stress",
  },
  {
    href: "/monte-carlo",
    number: "04",
    title: "Monte Carlo Sensitivity",
    description: "Simulate bounded stress paths to reveal tail impairment, breach probabilities, and the largest risk drivers.",
    bullets: ["P95 and P99 impairment", "Safety Buffer breaches", "Hedge-drift probability", "Sensitivity drivers"],
    action: "Run Monte Carlo",
  },
];

export default function RiskEnginePage() {
  return (
    <main className="workspace risk-engine-page">
      <header className="page-intro">
        <div>
          <p className="kicker">Deterministic risk gate</p>
          <h1>Four risk views. One decision boundary.</h1>
          <p>
            DeltaZero evaluates pseudo delta neutral DeFi positions through Strategy Build, Hedge-Drift Auditing,
            Funding Stress Testing, and Monte Carlo Sensitivity. The result is a reproducible recommendation to
            rebalance, reduce, or exit before capital is deployed.
          </p>
        </div>
        <span className="endpoint">4 RISK MODULES</span>
      </header>

      <section className="tool-grid product-grid risk-engine-grid risk-engine-included" aria-label="Reports included in the Risk Engine Pass">
        {modules.map((module) => (
          <article className="tool-card product-card" key={module.href}>
            <div className="tool-number">{module.number}</div>
            <h2>{module.title}</h2>
            <p>{module.description}</p>
            <ul className="product-bullets">
              {module.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
            <Link className="button button-primary risk-engine-action" href={module.href}>
              {module.action} <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </section>

      <aside className="panel risk-engine-boundary">
        <div><span>Shared methodology</span><strong>One engine, four decision views</strong></div>
        <p>Choose a module above, or run all four reports from the same assumptions with one Risk Engine Pass. Outputs remain deterministic and read-only. DeltaZero is not a price predictor, prediction market, charting terminal, token intelligence service, or trade executor.</p>
        <div className="risk-engine-boundary-actions"><Link href="/risk-engine/pass" className="button button-primary">Complete four-report pass</Link><Link href="/methodology" className="button button-secondary">Review methodology</Link></div>
      </aside>
    </main>
  );
}
