import Link from "next/link";

import type { CategoryDefinition } from "@/src/lib/marketplace/categories";
import type { MarketplaceAgent } from "@/src/lib/marketplace/types";
import styles from "./marketplace.module.css";
import { AgentCard } from "./agent-card";

export function CategoryHub({ definition, agents }: { definition: CategoryDefinition; agents: MarketplaceAgent[] }) {
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
      <section className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Verified discovery</p><h2>{agents.length} agent{agents.length === 1 ? "" : "s"} passed the category gate</h2><p>Unverified agents are excluded from this list. Source timestamps and registry proof are shown on every detail page.</p></div></div><div className={styles.grid}>{agents.map((agent) => <AgentCard agent={agent} key={agent.id} />)}</div></section>
    </div>
  );
}
