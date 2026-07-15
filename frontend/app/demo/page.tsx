import type { Metadata } from "next";
import { JudgeDemo } from "@/components/judge-demo";

export const metadata: Metadata = { title: "Judge Demo — DeltaZero", description: "A no-payment guided walkthrough of DeltaZero's deterministic DeFi risk workflow." };

export default function DemoPage() {
  return <div className="workspace judge-demo-page"><header className="page-intro"><div><p className="kicker">Experience the product</p><h1>DeltaZero Judge Demo</h1><p>See how DeltaZero turns strategy inputs into an explainable verdict, risk zone, metrics, and operator action—without a wallet, payment, or setup.</p></div><span className="endpoint">4-MINUTE WALKTHROUGH</span></header><JudgeDemo /></div>;
}
