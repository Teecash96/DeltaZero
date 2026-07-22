import type { Metadata } from "next";

import { RiskEnginePass } from "@/components/risk-engine-pass";

export const metadata: Metadata = {
  title: "Complete Risk Engine Pass — DeltaZero",
  description: "Unlock four coordinated DeltaZero risk reports with one analysis pass.",
};

export default function RiskEnginePassPage() {
  return (
    <main className="workspace risk-engine-page">
      <header className="page-intro">
        <div>
          <p className="kicker">Complete assessment</p>
          <h1>One pass. Four coordinated reports.</h1>
          <p>Use one set of assumptions across Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Monte Carlo Sensitivity.</p>
        </div>
        <span className="endpoint">x402 PROTECTED · 4 REPORTS · 1 USDT</span>
      </header>
      <RiskEnginePass />
    </main>
  );
}
