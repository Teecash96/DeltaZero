import type { Metadata } from "next";

import { ComparisonView } from "@/components/marketplace/comparison-view";
import styles from "@/components/marketplace/marketplace.module.css";
import { MARKETPLACE_AGENTS } from "@/src/lib/marketplace/fixtures";

export const metadata: Metadata = { title: "Compare Agents | DeltaZero", description: "Compare verified BSC ERC-8004 agent risk profiles side by side." };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const query = await searchParams;
  const initialIds = query.ids?.split(",").filter(Boolean) ?? [];
  return <div className={styles.page}><header className={styles.pageHeader}><div><p className={styles.eyebrow}>Discovery tool</p><h1>Compare risk profiles.</h1><p>Side by side scores make tradeoffs visible. DeltaZero highlights the strongest deterministic metrics without claiming one agent will be more profitable.</p></div><span className={styles.headerBadge}>Up to 3 agents</span></header><ComparisonView agents={MARKETPLACE_AGENTS} initialIds={initialIds} /></div>;
}
