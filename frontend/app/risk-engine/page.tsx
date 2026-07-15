import type { Metadata } from "next";
import Link from "next/link";
import { RiskEnginePass } from "@/components/risk-engine-pass";

export const metadata: Metadata = {
  title: "Risk Engine — DeltaZero",
  description: "Access DeltaZero's four deterministic DeFi risk-analysis modules.",
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
          <p className="kicker">DeltaZero Risk Engine</p>
          <h1>One pass. Four risk views.</h1>
          <p>
            Four connected modules use the same deterministic methodology to build a hedge, audit its drift,
            test funding pressure, and measure sensitivity across thousands of bounded scenarios.
          </p>
        </div>
        <span className="endpoint">1 USDT · 4 MODULES</span>
      </header>

      <RiskEnginePass />

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
        <p>Outputs are deterministic decision support. DeltaZero remains read-only and never requests custody, approvals, or trade execution.</p>
        <Link href="/methodology" className="button button-secondary">Review methodology</Link>
      </aside>
    </main>
  );
}
