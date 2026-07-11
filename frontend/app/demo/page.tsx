import Link from "next/link";
import { AUDIT_SAMPLE, BUILD_SAMPLE, STRESS_TEST_SAMPLE } from "@/lib/samples";

const demos = [
  { title: "Build SOL neutral carry", description: "Allocate $5,000 using medium risk assumptions and a 10% net carry spread before fees.", href: "/builder", payload: BUILD_SAMPLE },
  { title: "Audit hedge drift", description: "Inspect a $3,800 long against a $3,000 short and measure the resulting directional exposure.", href: "/auditor", payload: AUDIT_SAMPLE },
  { title: "Stress adverse funding", description: "Add four points to short funding and test whether the existing position still earns its carry.", href: "/stress-test", payload: STRESS_TEST_SAMPLE },
];
export default function DemoPage() { return <div className="workspace"><header className="page-intro"><div><p className="kicker">Preloaded walkthroughs</p><h1>Explore DeltaZero</h1><p>Each workflow is prefilled with the verified sample payload. Open one, submit it unchanged, then adjust the assumptions to compare decisions.</p></div></header><div className="demo-cards">{demos.map((demo, index) => <article className="demo-card" key={demo.href}><span className="tool-number">0{index + 1}</span><h2>{demo.title}</h2><p>{demo.description}</p><pre className="demo-payload">{JSON.stringify(demo.payload, null, 2)}</pre><Link href={demo.href} className="button button-primary">Open workflow <span>→</span></Link></article>)}</div></div>; }
