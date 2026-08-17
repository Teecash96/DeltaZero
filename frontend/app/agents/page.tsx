import type { Metadata } from "next";

import styles from "@/components/marketplace/marketplace.module.css";
import { AgentListing } from "@/components/marketplace/agent-listing";
import { CATEGORY_DEFINITIONS, CATEGORY_ORDER } from "@/src/lib/marketplace/categories";
import { getLiveMarketplaceDiscovery } from "@/src/server/marketplace/live-registry";

export const metadata: Metadata = {
  title: "Agent Marketplace | DeltaZero",
  description: "Discover BSC ERC-8004 agents that have passed DeltaZero deterministic risk verification.",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const discovery = await getLiveMarketplaceDiscovery();
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>BNB Agent Studio · Discovery</p><h1>Hire agents that survived the test.</h1><p>Browse BSC ERC-8004 agents by category, compare their deterministic risk profile, and inspect the evidence behind every score before you hire.</p></div>
        <span className={styles.headerBadge}>4 categories · {discovery.agents.length} live verified</span>
      </header>
      <section className={styles.discoveryNotice} aria-live="polite">
        <strong>Live BSC discovery</strong>
        <span>{discovery.agents.length} agents passed registry, endpoint, schema, and payment checks at {new Date(discovery.checkedAt).toLocaleTimeString()}.</span>
        <span className={styles.noticeSource}>{discovery.source}</span>
        <div className={styles.coverageRow} aria-label="Live category coverage">
          {CATEGORY_ORDER.map((category) => {
            const count = discovery.categoryCounts[category];
            return <span key={category} className={count >= 2 ? styles.coverageReady : styles.coverageGap}><b>{count}</b> {CATEGORY_DEFINITIONS[category].shortName}{count < 2 ? " · gap" : " · ready"}</span>;
          })}
        </div>
      </section>
      <AgentListing agents={discovery.agents} exclusions={discovery.exclusions} />
    </div>
  );
}
