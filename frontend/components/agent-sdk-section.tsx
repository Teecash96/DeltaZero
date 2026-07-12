"use client";

import { useMemo, useState } from "react";

const links = [
  { label: "GitHub SDK folder", href: "https://github.com/Teecash96/DeltaZero/tree/main/sdk" },
  { label: "API documentation", href: "https://deltazero-production.up.railway.app/docs" },
  { label: "OKX ASP documentation", href: "https://github.com/Teecash96/DeltaZero/blob/main/docs/OKX_ASP_SERVICE.md" },
];

const snippets = {
  typescript: `import { DeltaZeroClient } from "@deltazero/core";\n\nconst client = new DeltaZeroClient({\n  baseUrl: "https://deltazero-production.up.railway.app",\n});\n\nconst report = await client.buildStrategy({\n  asset: "SOL",\n  capital_usd: 5000,\n  risk_tolerance: "medium",\n  target_style: "neutral_yield",\n  long_yield_apy: 14,\n  short_funding_apy: 3,\n  fee_drag_apy: 1,\n});\n\nconsole.log(report.recommendation.action);`,
  python: `from deltazero import DeltaZeroClient\n\nclient = DeltaZeroClient(\n    base_url="https://deltazero-production.up.railway.app"\n)\n\nreport = client.build_strategy({\n    "asset": "SOL",\n    "capital_usd": 5000,\n    "risk_tolerance": "medium",\n    "target_style": "neutral_yield",\n    "long_yield_apy": 14,\n    "short_funding_apy": 3,\n    "fee_drag_apy": 1,\n})\n\nprint(report["recommendation"]["action"])`,
} as const;

export function AgentSdkSection() {
  const [tab, setTab] = useState<keyof typeof snippets>("typescript");
  const [copied, setCopied] = useState<keyof typeof snippets | null>(null);
  const code = useMemo(() => snippets[tab], [tab]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(tab);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section id="agents" className="section-wrap anchor-section">
      <div className="section-heading">
        <div>
          <p className="kicker">Built for Agents</p>
          <h2>Deterministic, structured risk assessments for agent workflows.</h2>
        </div>
        <div className="sdk-badge-stack">
          <span className="sdk-badge">SDK PREVIEW</span>
          <span className="sdk-status">Local SDK package · Planned npm publication</span>
        </div>
      </div>
      <p className="sdk-copy">
        DeltaZero exposes deterministic, structured risk assessments that can be consumed by agents, dashboards, and
        automated workflows.
      </p>
      <div className="sdk-grid">
        <div className="panel sdk-panel">
          <div className="sdk-tabs" role="tablist" aria-label="SDK language examples">
            {(["typescript", "python"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`sdk-tab ${tab === item ? "sdk-tab-active" : ""}`}
                onClick={() => setTab(item)}
                aria-pressed={tab === item}
              >
                {item === "typescript" ? "TypeScript" : "Python"}
              </button>
            ))}
          </div>
          <div className="sdk-code-head">
            <span>{tab === "typescript" ? "TypeScript SDK" : "Python SDK"}</span>
            <button type="button" className="sdk-copy-button" onClick={copyCode}>
              {copied === tab ? "Copied" : "Copy snippet"}
            </button>
          </div>
          <pre className="sdk-code-block">
            <code>{code}</code>
          </pre>
        </div>
        <div className="sdk-links panel">
          <h3>Agent use cases</h3>
          <ul>
            <li>Portfolio automation with structured strategy responses.</li>
            <li>Dashboards that need deterministic risk results.</li>
            <li>Offline analysis workflows that call the live API.</li>
          </ul>
          <div className="sdk-link-grid">
            {links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="sdk-link-card">
                <strong>{link.label}</strong>
                <span>{link.href.replace("https://", "")}</span>
              </a>
            ))}
          </div>
          <p className="sdk-note">
            Install the SDKs from this repository locally. They are thin clients around the deployed API and are not
            published yet.
          </p>
        </div>
      </div>
    </section>
  );
}
