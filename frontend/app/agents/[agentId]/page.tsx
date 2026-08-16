import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentDetail } from "@/components/marketplace/agent-detail";
import styles from "@/components/marketplace/marketplace.module.css";
import { MARKETPLACE_AGENTS, getMarketplaceAgent } from "@/src/lib/marketplace/fixtures";

export function generateStaticParams() {
  return MARKETPLACE_AGENTS.map((agent) => ({ agentId: agent.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ agentId: string }> }): Promise<Metadata> {
  const { agentId } = await params;
  const agent = getMarketplaceAgent(agentId);
  return { title: agent ? `${agent.name} | DeltaZero` : "Agent not found | DeltaZero", description: agent?.description };
}

export default async function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = getMarketplaceAgent(agentId);
  if (!agent) notFound();
  return <div className={styles.page}><Link href="/agents" className={styles.backLink}>← Back to verified agents</Link><AgentDetail agent={agent} /></div>;
}
