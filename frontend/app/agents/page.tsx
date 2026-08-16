import type { Metadata } from "next";

import { MARKETPLACE_AGENTS } from "@/src/lib/marketplace/fixtures";
import styles from "@/components/marketplace/marketplace.module.css";
import { AgentListing } from "@/components/marketplace/agent-listing";

export const metadata: Metadata = {
  title: "Agent Marketplace | DeltaZero",
  description: "Discover BSC ERC-8004 agents that have passed DeltaZero deterministic risk verification.",
};

export default function AgentsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>BNB Agent Studio · Discovery</p><h1>Hire agents that survived the test.</h1><p>Browse BSC ERC-8004 agents by category, compare their deterministic risk profile, and inspect the evidence behind every score before you hire.</p></div>
        <span className={styles.headerBadge}>4 categories · {MARKETPLACE_AGENTS.length} verified fixtures</span>
      </header>
      <AgentListing agents={MARKETPLACE_AGENTS} />
    </div>
  );
}
