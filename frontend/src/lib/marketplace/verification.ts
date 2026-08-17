import type { MarketplaceAgent, VerificationResult } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export async function runHealthSchemaCheck(agent: MarketplaceAgent): Promise<VerificationResult> {
  const startedAt = performance.now();

  if (agent.dataMode === "verified_fixture") {
    const checks = {
      health: agent.verification.checks.health,
      schema: agent.verification.checks.schema,
      erc8004: agent.verification.checks.erc8004,
      categoryCoverage: agent.verification.checks.categoryCoverage,
    };
    const passed = Object.values(checks).every(Boolean);
    return {
      status: passed ? "passed" : "failed",
      checkedAt: nowIso(),
      latencyMs: Math.max(18, Math.round(performance.now() - startedAt)),
      checks,
      message: passed ? "Verified fixture passed health, schema, and registry checks." : "Fixture failed one or more verification checks.",
    };
  }

  try {
    const response = await fetch(`/api/marketplace/verify/${encodeURIComponent(agent.id)}`, { method: "POST", cache: "no-store" });
    const payload = await response.json() as VerificationResult;
    if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Live verification failed.");
    return payload;
  } catch {
    return {
      status: "failed",
      checkedAt: nowIso(),
      latencyMs: Math.round(performance.now() - startedAt),
      checks: { health: false, schema: false, erc8004: agent.verification.checks.erc8004, categoryCoverage: agent.verification.checks.categoryCoverage },
      message: "The server-side live verification route did not respond.",
    };
  }
}
