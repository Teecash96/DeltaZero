const frontendUrl = (process.env.MARKETPLACE_URL ?? "https://delta-zero-alpha.vercel.app").replace(/\/$/, "");
const backendUrl = (process.env.BACKEND_URL ?? "https://deltazero-production.up.railway.app").replace(/\/$/, "");
const verifyLimit = Number.parseInt(process.env.SMOKE_VERIFY_LIMIT ?? "2", 10);

async function request(url, init = {}) {
  const started = performance.now();
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000)),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 500);
  }
  return {
    response,
    body,
    latencyMs: Math.round(performance.now() - started),
  };
}

function assertOk(label, result) {
  if (!result.response.ok) {
    throw new Error(`${label} returned HTTP ${result.response.status}`);
  }
}

function isVerified(agent) {
  return ["passed", "verified"].includes(agent.verification?.status);
}

function countVerified(agents) {
  return agents.filter(isVerified).length;
}

try {
  const home = await request(frontendUrl);
  assertOk("frontend", home);

  const health = await request(`${backendUrl}/health`);
  assertOk("backend health", health);

  const openapi = await request(`${backendUrl}/openapi.json`);
  assertOk("backend OpenAPI", openapi);
  if (!openapi.body || typeof openapi.body !== "object" || !openapi.body.paths) {
    throw new Error("backend OpenAPI did not contain a paths object");
  }

  const marketplace = await request(`${frontendUrl}/api/marketplace`);
  assertOk("marketplace discovery", marketplace);
  const discovery = marketplace.body?.data ?? marketplace.body;
  const agents = Array.isArray(discovery?.agents) ? discovery.agents : [];
  if (!agents.length) throw new Error("marketplace discovery returned no agents");

  const categoryCounts = agents.reduce((counts, agent) => {
    const categories = Array.isArray(agent.categories) && agent.categories.length
      ? agent.categories
      : [agent.category ?? "uncategorized"];
    for (const category of categories) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
    return counts;
  }, {});

  console.log(JSON.stringify({
    checked_at: new Date().toISOString(),
    frontend: { url: frontendUrl, http: home.response.status, latency_ms: home.latencyMs },
    backend: {
      url: backendUrl,
      health_http: health.response.status,
      health_latency_ms: health.latencyMs,
      openapi_http: openapi.response.status,
      openapi_latency_ms: openapi.latencyMs,
    },
    marketplace: {
      http: marketplace.response.status,
      latency_ms: marketplace.latencyMs,
      total_agents: agents.length,
      verified_agents: countVerified(agents),
      category_counts: categoryCounts,
      exclusions: Array.isArray(discovery?.exclusions) ? discovery.exclusions.length : 0,
    },
  }, null, 2));

  const candidates = agents
    .filter((agent) => agent.id && isVerified(agent))
    .slice(0, Math.max(0, verifyLimit));
  for (const agent of candidates) {
    const result = await request(`${frontendUrl}/api/marketplace/verify/${encodeURIComponent(agent.id)}`, { method: "POST" });
    assertOk(`verification ${agent.id}`, result);
    const status = result.body?.status ?? result.body?.data?.status;
    console.log(JSON.stringify({
      verification: agent.id,
      http: result.response.status,
      latency_ms: result.latencyMs,
      status,
      checks: result.body?.checks ?? result.body?.data?.checks,
      cache_hit: result.body?.cacheHit ?? result.body?.data?.cacheHit ?? false,
    }, null, 2));
  }
} catch (error) {
  console.error(`Live BSC smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
