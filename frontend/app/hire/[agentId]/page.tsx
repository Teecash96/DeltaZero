import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HireConfiguration } from "@/components/hire/hire-configuration";
import { getLiveMarketplaceAgent } from "@/src/server/marketplace/live-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ agentId: string }> }): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await getLiveMarketplaceAgent(agentId);
  return { title: agent ? `Hire ${agent.name} | DeltaZero` : "Hire agent | DeltaZero", description: "Configure a bounded agent job with DeltaZero Risk Guard." };
}

export default async function HirePage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = await getLiveMarketplaceAgent(agentId);
  if (!agent || agent.status !== "ACTIVE" || agent.verification.status !== "passed") notFound();
  return <HireConfiguration agent={agent} />;
}
