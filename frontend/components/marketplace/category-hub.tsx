import Link from "next/link";

import type { CategoryDefinition } from "@/src/lib/marketplace/categories";
import type { MarketplaceAgent, MarketplaceExclusion } from "@/src/lib/marketplace/types";
import styles from "./marketplace.module.css";
import { AgentCard } from "./agent-card";

export function CategoryHub({ definition, agents, exclusions = [] }: { definition: CategoryDefinition; agents: MarketplaceAgent[]; exclusions?: MarketplaceExclusion[] }) {
  return (
    <div className={styles.page}>
      <Link href="/agents" className={styles.backLink}>← All agents</Link>
      <section className={styles.categoryHero}>
        <p className={styles.eyebrow}>Risk category · BSC ERC-8004</p>
        <h1>{definition.name}</h1>
        <p>{definition.description} {definition.decisionQuestion}</p>
      </section>
      <section className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Category policy</p><h2>How DeltaZero reads this category</h2></div></div><div className={styles.metricList}>{definition.metrics.map((metric) => <article className={styles.metricItem} key={metric.key}><div><strong>{metric.label}</strong>{metric.unit ? <b>{metric.unit}</b> : null}</div><p>{metric.explanation}</p></article>)}</div></section>
      <section className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Thresholds</p><h2>Risk zone policy</h2></div></div><div className={styles.thresholdGrid}>{definition.thresholds.map((threshold) => <article className={styles.infoCard} key={threshold.label}><span>{threshold.label}</span><strong>{threshold.value}</strong><p>{threshold.meaning}</p></article>)}</div></section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Verified discovery</p>
            <h2>{agents.length} agent{agents.length === 1 ? "" : "s"} passed the category gate</h2>
            <p>Target coverage is two live agents per BNB category. DeltaZero does not fill a gap with fixtures. Source timestamps and registry proof are shown on every detail page.</p>
          </div>
          <span className={styles.headerBadge}>{agents.length >= 2 ? "Coverage ready" : "Coverage gap"}</span>
        </div>
        {agents.length > 0 ? <div className={styles.grid}>{agents.map((agent) => <AgentCard agent={agent} key={agent.id} />)}</div> : <div className={styles.empty}><h2>No live {definition.shortName.toLowerCase()} agents passed today.</h2><p>An agent must have a BSC ERC-8004 identity, x402 declaration, and a reachable MCP or A2A endpoint.</p></div>}
        {exclusions.length > 0 ? <details className={styles.exclusionDetails}><summary>{exclusions.length} candidate{exclusions.length === 1 ? "" : "s"} excluded from this category</summary><div className={styles.exclusionList}>{exclusions.slice(0, 8).map((exclusion) => <div key={exclusion.id}><b>{exclusion.name}</b><span>{exclusion.reason}</span></div>)}</div></details> : null}
      </section>
    </div>
  );
}
