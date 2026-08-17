import { NextResponse } from "next/server";

import { getLiveMarketplaceAgent, verifyRegisteredService } from "@/src/server/marketplace/live-registry";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = await getLiveMarketplaceAgent(agentId);
  if (!agent) return NextResponse.json({ message: "Verified agent was not found in the current live discovery window." }, { status: 404 });

  const startedAt = Date.now();
  const service = {
    kind: agent.verification.serviceKind ?? "mcp",
    endpoint: agent.verification.endpoint,
  } as const;
  const check = await verifyRegisteredService(service);
  const checkedAt = new Date().toISOString();
  const paymentDeclared = agent.verification.checks.paymentFlow === true;
  const checks = {
    health: check.ok,
    schema: check.ok,
    erc8004: agent.verification.checks.erc8004,
    categoryCoverage: agent.verification.checks.categoryCoverage,
    serviceEndpoint: check.ok,
    paymentFlow: paymentDeclared,
  };

  return NextResponse.json(
    {
      status: check.ok && Object.values(checks).every(Boolean) ? "passed" : "failed",
      checkedAt,
      latencyMs: Math.max(check.latencyMs, Date.now() - startedAt),
      checks,
      message: check.ok
        ? `${check.message}. x402 support remains registry-declared and must be rechecked before hire.`
        : check.message,
      serviceKind: service.kind,
      toolCount: check.toolCount,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
