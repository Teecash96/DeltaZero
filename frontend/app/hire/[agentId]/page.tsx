import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HireConfiguration } from "@/components/hire/hire-configuration";
import { MARKETPLACE_AGENTS, getMarketplaceAgent } from "@/src/lib/marketplace/fixtures";

export function generateStaticParams() {
  return MARKETPLACE_AGENTS.map((agent) => ({ agentId: agent.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ agentId: string }> }): Promise<Metadata> {
  const { agentId } = await params;
  const agent = getMarketplaceAgent(agentId);
  return { title: agent ? `Hire ${agent.name} | DeltaZero` : "Hire agent | DeltaZero", description: "Configure a bounded agent job with DeltaZero Risk Guard." };
}

export default async function HirePage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = getMarketplaceAgent(agentId);
  if (!agent || agent.status !== "ACTIVE" || agent.verification.status !== "passed") notFound();
  return <HireConfiguration agent={agent} />;
}
