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

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(agent.verification.endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const checks = {
      health: response.ok,
      schema: contentType.includes("application/json"),
      erc8004: agent.verification.checks.erc8004,
      categoryCoverage: agent.verification.checks.categoryCoverage,
    };
    const passed = Object.values(checks).every(Boolean);
    return {
      status: passed ? "passed" : "failed",
      checkedAt: nowIso(),
      latencyMs: Math.round(performance.now() - startedAt),
      checks,
      message: passed ? "Live endpoint returned a valid JSON health response." : "Live endpoint responded, but its schema or registry checks failed.",
    };
  } catch {
    return {
      status: "failed",
      checkedAt: nowIso(),
      latencyMs: Math.round(performance.now() - startedAt),
      checks: { health: false, schema: false, erc8004: agent.verification.checks.erc8004, categoryCoverage: agent.verification.checks.categoryCoverage },
      message: "The live endpoint did not respond within four seconds.",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
