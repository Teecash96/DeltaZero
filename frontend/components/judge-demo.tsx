"use client";

import Link from "next/link";
import { useState } from "react";

type DemoKey = "build" | "audit" | "monte" | "stress";

const demos = {
  build: {
    step: "01",
    label: "Strategy Build",
    title: "Construct a neutral SOL strategy",
    question: "How should $5,000 be allocated for medium-risk neutral yield?",
    input: ["Capital $5,000", "Long yield 14%", "Short funding 3%", "Fee drag 1%"],
    verdict: "PROCEED",
    zone: "Healthy",
    summary: "The proposed hedge is aligned and expected carry remains positive after funding and fees.",
    metrics: [["Long leg", "$3,800"], ["Short hedge", "$3,648"], ["Net carry", "10.12%"], ["Hedge drift", "4.00%"], ["Safety Buffer", "65.79"]],
    action: "Deploy only after verifying current venue funding, liquidity, and margin rules.",
  },
  audit: {
    step: "02",
    label: "Hedge-Drift Auditing",
    title: "Detect hedge drift",
    question: "Is a $3,800 long against a $3,000 short still neutral?",
    input: ["Long $3,800", "Short $3,000", "Collateral $1,200", "Medium risk"],
    verdict: "ADJUST",
    zone: "Critical",
    summary: "The short leg is materially underweight and the position has moved outside the neutral band.",
    metrics: [["Hedge ratio", "0.7895"], ["Hedge drift", "21.05%"], ["Net delta", "+21.05%"], ["Net carry", "7.84%"], ["Safety Buffer", "80.00"]],
    action: "Increase the short hedge toward the configured target before adding capital.",
  },
  monte: {
    step: "03",
    label: "Monte Carlo",
    title: "Measure tail fragility",
    question: "How does the strategy behave across 1,000 bounded stress paths?",
    input: ["1,000 paths", "30-day horizon", "Seed 42", "Bounded assumptions"],
    verdict: "ADJUST",
    zone: "Watch",
    summary: "Tail impairment remains contained, but hedge-drift breaches occur often enough to require monitoring.",
    metrics: [["Expected impairment", "1.94%"], ["P95 impairment", "4.46%"], ["P99 impairment", "5.63%"], ["Drift breach", "67.50%"], ["Negative carry", "9.90%"]],
    action: "Tighten the rebalance policy or increase the hedge reserve before autonomous use.",
  },
  stress: {
    step: "04",
    label: "Funding Stress Testing",
    title: "Reprice adverse funding",
    question: "What happens when short funding worsens by four APY points?",
    input: ["Long $4,000", "Short $3,840", "Collateral $1,200", "Funding +4 APY"],
    verdict: "HOLD",
    zone: "Healthy",
    summary: "Carry compresses but remains positive, while hedge alignment and collateral coverage stay inside tolerance.",
    metrics: [["Stressed carry", "3.32%"], ["Hedge drift", "4.00%"], ["Safety Buffer", "62.50"], ["Impairment", "1.04%"], ["Post-stress equity", "$5,146"]],
    action: "Continue monitoring funding; reassess if net carry approaches zero.",
  },
} as const;

export function JudgeDemo() {
  const [active, setActive] = useState<DemoKey>("build");
  const demo = demos[active];

  return (
    <div className="judge-demo">
      <section className="judge-demo-banner panel">
        <div><span>NO PAYMENT REQUIRED</span><h2>Judge-ready product walkthrough</h2><p>Explore verified reference scenarios produced from DeltaZero&apos;s documented v1 formulas. Real API calls remain protected by x402.</p></div>
        <Link href="/methodology" className="button button-secondary">Verify methodology</Link>
      </section>

      <nav className="judge-demo-tabs" aria-label="Demo workflow">
        {(Object.keys(demos) as DemoKey[]).map((key) => (
          <button key={key} type="button" className={active === key ? "active" : ""} onClick={() => setActive(key)}>
            <span>{demos[key].step}</span><strong>{demos[key].label}</strong>
          </button>
        ))}
      </nav>

      <section className="judge-demo-console panel" aria-live="polite">
        <div className="judge-demo-context">
          <span>STEP {demo.step} · REFERENCE SCENARIO</span>
          <h1>{demo.title}</h1>
          <p>{demo.question}</p>
          <div className="judge-demo-inputs">{demo.input.map((item) => <i key={item}>{item}</i>)}</div>
          <div className="judge-demo-flow"><b>Validated inputs</b><span>→</span><b>Deterministic engine</b><span>→</span><b>Operator action</b></div>
        </div>
        <div className="judge-demo-result">
          <div className="judge-demo-verdict"><span>DELTAZERO VERDICT</span><strong>{demo.verdict}</strong><i>{demo.zone} risk zone</i></div>
          <p>{demo.summary}</p>
          <div className="judge-demo-metrics">{demo.metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
          <div className="judge-demo-action"><span>Recommended operator action</span><p>{demo.action}</p></div>
        </div>
      </section>

      <section className="judge-demo-footer panel">
        <div><strong>Ready to inspect the real product?</strong><p>Protected workflows issue the live OKX x402 payment boundary. API contracts and source code remain public.</p></div>
        <div><Link href="/builder" className="button button-primary">Open Strategy Build</Link><a href="https://deltazero-production.up.railway.app/docs" className="button button-secondary" target="_blank" rel="noreferrer">Inspect API</a></div>
      </section>
    </div>
  );
}
