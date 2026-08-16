"use client";

import Link from "next/link";
import { useState } from "react";

import { CATEGORY_DEFINITIONS } from "@/src/lib/marketplace/categories";
import { runHealthSchemaCheck } from "@/src/lib/marketplace/verification";
import type { MarketplaceAgent, VerificationResult } from "@/src/lib/marketplace/types";
import styles from "./marketplace.module.css";
import { RiskStatusBadge } from "./risk-status-badge";

function scoreRows(agent: MarketplaceAgent) {
  return [
    ["DeltaZero Score", agent.risk.deltaZeroScore.toFixed(1), "Weighted category Safety Buffer, confidence, data quality, and functionality."],
    ["Safety Buffer", agent.risk.safetyBuffer.toFixed(1), agent.riskZoneLabel],
    ["Decision Confidence", agent.risk.decisionConfidence.toFixed(1), "Confidence in the supplied inputs and deterministic replay."],
    ["Data Quality", agent.risk.dataQuality.toFixed(1), "Completeness, freshness, source trust, and replay consistency."],
    ["Functionality", agent.risk.functionality.toFixed(1), "Endpoint availability, latency, schema validity, and payment flow validity."],
  ];
}

export function AgentDetail({ agent }: { agent: MarketplaceAgent }) {
  const [checking, setChecking] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const category = CATEGORY_DEFINITIONS[agent.categories[0]];

  async function verify() {
    setChecking(true);
    setVerification(null);
    const result = await runHealthSchemaCheck(agent);
    setVerification(result);
    setChecking(false);
  }

  return (
    <>
      <div className={styles.detailGrid}>
        <section>
          <p className={styles.eyebrow}>Verified BSC agent · {category.name}</p>
          <h1 className={styles.detailTitle}>{agent.name}</h1>
          <p className={styles.detailDescription}>{agent.description}</p>
          <div className={styles.meta}>{agent.tags.map((tag) => <span className={styles.chip} key={tag}>{tag}</span>)}{agent.supportedProtocols.map((protocol) => <span className={styles.chip} key={protocol}>{protocol}</span>)}</div>
          <div className={styles.ctaRow}><Link href={`/hire/${agent.id}`} className={styles.primaryCta}>Hire with Risk Guard →</Link><Link href="/methodology" className={styles.secondaryCta}>Read methodology →</Link></div>
        </section>
        <aside className={styles.proof} aria-label="Agent identity proof">
          <h2>Identity and verification</h2>
          <div className={styles.proofRows}>
            <div className={styles.proofRow}><span>Risk zone</span><RiskStatusBadge status={agent.risk.status} /></div>
            <div className={styles.proofRow}><span>BSC status</span><strong className={styles.proofPass}>● Active · chain 56</strong></div>
            <div className={styles.proofRow}><span>ERC-8004</span><strong className={styles.proofPass}>✓ {agent.registryProof.agentId}</strong></div>
            <div className={styles.proofRow}><span>Registry</span><strong>{agent.registryProof.registryAddress}</strong></div>
            <div className={styles.proofRow}><span>Owner</span><strong>{agent.registryProof.ownerAddress}</strong></div>
            <div className={styles.proofRow}><span>Price</span><strong>{agent.startingPrice.amount} {agent.startingPrice.currency} / month</strong></div>
          </div>
          <div className={styles.verificationBox}><p><strong>Last successful verification</strong><br />{new Date(agent.verification.lastVerifiedAt).toLocaleString()}<br />{agent.verification.mode === "verified_fixture" ? "Verified fixture, not a live production claim." : "Live endpoint verification."}</p><button type="button" className={styles.verifyButton} onClick={verify} disabled={checking}>{checking ? "Checking…" : "Run health check"}</button></div>
          {verification ? <p className={styles.verifyMessage} role="status">{verification.status === "passed" ? "✓" : "!"} {verification.message} {verification.latencyMs} ms.</p> : null}
        </aside>
      </div>

      <section className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Risk profile</p><h2>Deterministic score breakdown</h2><p>The scores are calculated with the Phase 0 pure functions. They are risk assessments, not profit forecasts.</p></div><span className={styles.headerBadge}>Formula v1</span></div><div className={styles.metricList}>{scoreRows(agent).map(([label, value, description]) => <article className={styles.metricItem} key={label}><div><strong>{label}</strong><b>{value}</b></div><p>{description}</p></article>)}</div></section>

      <section className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Category evidence</p><h2>{category.name} metrics</h2><p>{category.decisionQuestion}</p></div></div><div className={styles.metricList}>{agent.categoryMetrics[agent.categories[0]].map((metric) => <article className={styles.metricItem} key={metric.key}><div><strong>{metric.label}</strong><b>{metric.value}{metric.unit ? ` ${metric.unit}` : ""}</b></div><p>{metric.description}</p></article>)}</div></section>

      <section className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Provenance</p><h2>Evidence and source freshness</h2></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Metric</th><th>Value</th><th>Source</th><th>Observed</th></tr></thead><tbody>{agent.evidence.map((item) => <tr key={item.metric}><td>{item.metric}</td><td>{String(item.value)}{item.unit ? ` ${item.unit}` : ""}</td><td>{item.source}</td><td>{new Date(item.observedAt).toLocaleString()}</td></tr>)}</tbody></table></div><p className={styles.smallNote}>Data mode: {agent.dataMode === "verified_fixture" ? "verified fixture" : "live"}. A production listing must replace fixture evidence with a reachable endpoint and current source timestamp before it can be treated as live.</p></section>
    </>
  );
}
