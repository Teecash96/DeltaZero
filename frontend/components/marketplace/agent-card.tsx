"use client";

import Link from "next/link";

import type { MarketplaceAgent } from "@/src/lib/marketplace/types";
import { CATEGORY_DEFINITIONS } from "@/src/lib/marketplace/categories";
import styles from "./marketplace.module.css";
import { RiskStatusBadge } from "./risk-status-badge";

export function AgentCard({ agent, selected = false, onCompare }: { agent: MarketplaceAgent; selected?: boolean; onCompare?: (agentId: string) => void }) {
  const category = CATEGORY_DEFINITIONS[agent.categories[0]];
  const initials = agent.name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const verificationAge = agent.sources[0]?.freshnessMinutes ?? 0;
  const price = agent.startingPrice.amount === "Not listed" ? "Price not listed" : `${agent.startingPrice.amount} ${agent.startingPrice.currency} / ${agent.startingPrice.interval === "monthly" ? "month" : "call"}`;
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <Link href={`/agents/${agent.id}`} className={styles.identity} aria-label={`Open ${agent.name} detail`}>
          <span className={styles.agentMark} aria-hidden="true">{initials}</span>
          <span>
            <h2>{agent.name}</h2>
            <p>{category.name} · BSC · ERC-8004 {agent.erc8004AgentId}</p>
          </span>
        </Link>
        <RiskStatusBadge status={agent.risk.status} />
      </div>
      <p className={styles.description}>{agent.description}</p>
      <div className={styles.scoreGrid} aria-label={`${agent.name} risk scores`}>
        <div className={styles.score}><span>DeltaZero score</span><strong>{agent.risk.deltaZeroScore.toFixed(1)}</strong></div>
        <div className={styles.score}><span>Safety Buffer</span><strong>{agent.risk.safetyBuffer.toFixed(1)}</strong></div>
        <div className={styles.score}><span>Decision confidence</span><strong>{agent.risk.decisionConfidence.toFixed(1)}</strong></div>
        <div className={styles.score}><span>Data quality</span><strong>{agent.risk.dataQuality.toFixed(1)}</strong></div>
        <div className={styles.score}><span>Functionality</span><strong>{agent.risk.functionality.toFixed(1)}</strong></div>
      </div>
      <div className={styles.meta}>
        <span className={styles.chip}>● BSC live</span>
        <span className={styles.chip}>✓ ERC-8004 proof</span>
        <span className={styles.chip}>{price}</span>
        {agent.supportedProtocols.map((protocol) => <span className={styles.chip} key={protocol}>{protocol}</span>)}
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.freshness}><strong>Verified {new Date(agent.verification.lastVerifiedAt).toLocaleDateString()}</strong><br />Source freshness {verificationAge} min · {agent.verification.latencyMs} ms p95</span>
        <span className={styles.actions}>
          {onCompare ? <button type="button" className={styles.compareButton} aria-pressed={selected} onClick={() => onCompare(agent.id)}>{selected ? "Added" : "Compare"}</button> : null}
          <Link href={`/agents/${agent.id}`} className={styles.linkButton}>View risk profile →</Link>
        </span>
      </div>
    </article>
  );
}
