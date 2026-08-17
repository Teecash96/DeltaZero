import { expect, test } from "@playwright/test";

const categories = [
  ["health_factor", "Health Factor Monitoring"],
  ["yield_optimisation", "Yield Optimisation"],
  ["rebalancing", "Rebalancing"],
  ["grid_trading", "Grid Trading"],
] as const;

const simulationJob = {
  id: "e2e-job",
  status: "AWAITING_PAYMENT",
  agent_id: "aave-health-sentinel",
  agent_erc8004_id: "bsc-8004-1042",
  agent_name: "Aave Health Sentinel",
  provider_address: "0x2222222222222222222222222222222222222222",
  buyer_address: "0x3333333333333333333333333333333333333333",
  agent_endpoint: "https://fixture.deltazero.local/aave-health-sentinel",
  category: "health_factor",
  objective: "Check a lending position before the next rebalance.",
  input_data: { asset: "BNB", capital_usd: 5000 },
  budget_amount: "5",
  budget_currency: "USDT",
  payment_amount: "1",
  deadline: "2099-01-01T00:00:00.000Z",
  risk_policy: {
    safety_buffer_min: 50,
    decision_confidence_min: 70,
    data_freshness_max_minutes: 30,
    require_human_approval_for: ["ADJUST", "REDUCE", "CLOSE"],
    endpoint_timeout_seconds: 10,
  },
  risk_policy_hash: "0xpolicy",
  expected_schema_hash: "0xschema",
  erc8183: {
    chain_id: 56,
    contract_address: null,
    job_id: "e2e-job",
    agent_id: "bsc-8004-1042",
    buyer: "0x3333333333333333333333333333333333333333",
    provider: "0x2222222222222222222222222222222222222222",
    budget_amount: "5",
    budget_currency: "USDT",
    deadline: "2099-01-01T00:00:00.000Z",
    risk_policy_hash: "0xpolicy",
    expected_schema_hash: "0xschema",
    mode: "simulation",
    transaction_hash: null,
  },
  execution_mode: "simulation",
  payment: null,
  result: null,
  proof: null,
  risk_guard: null,
  timeline: [
    {
      event: "created",
      status: "AWAITING_PAYMENT",
      message: "Job created in simulation mode.",
      at: "2026-08-17T08:00:00.000Z",
    },
  ],
  created_at: "2026-08-17T08:00:00.000Z",
  updated_at: "2026-08-17T08:00:00.000Z",
};

const executedJob = {
  ...simulationJob,
  status: "VERIFYING",
  result: {
    generated_at: "2026-08-17T08:00:03.000Z",
    risk_envelope: {
      decision: { action: "OPEN" },
      measures: { safety_buffer_score: 82, decision_confidence: 91 },
    },
  },
};

const verifiedJob = {
  ...executedJob,
  status: "MONITORING",
  proof: {
    schema_id: "risk-envelope.v1",
    schema_version: "1.0",
    job_id: "e2e-job",
    agent_id: "aave-health-sentinel",
    expected_schema_hash: "0xschema",
    request_hash: "0xrequest",
    result_hash: "0xresult",
    identity_verified: true,
    job_id_verified: true,
    timestamps_verified: true,
    payment_verified: true,
    schema_validated: true,
    deterministic: true,
    created_at: "2026-08-17T08:00:03.000Z",
  },
  risk_guard: {
    state: "ALLOW",
    safety_buffer: 82,
    decision_confidence: 91,
    data_age_minutes: 1,
    endpoint_available: true,
    deadline_ok: true,
    action: "OPEN",
    reasons: ["All configured Risk Guard thresholds passed."],
    checked_at: "2026-08-17T08:00:04.000Z",
  },
  timeline: [
    ...simulationJob.timeline,
    { event: "verified", status: "MONITORING", message: "Proof envelope verified.", at: "2026-08-17T08:00:04.000Z" },
  ],
};

test.describe("Phase 4 marketplace readiness", () => {
  test("browse, inspect, and configure a verified agent", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Hire agents that survived the test." })).toBeVisible();
    await expect(page.getByText("4 categories · 4 live verified")).toBeVisible();

    const card = page.locator("article").filter({ hasText: "Aave Health Sentinel" }).first();
    await expect(card).toContainText("DeltaZero score");
    await card.getByRole("link", { name: "Open Aave Health Sentinel detail" }).click();
    await expect(page).toHaveURL(/\/agents\/aave-health-sentinel$/);
    await expect(page.getByRole("heading", { name: "Aave Health Sentinel" })).toBeVisible();
    const hireLink = page.getByRole("link", { name: /Hire with Risk Guard/ });
    await expect(hireLink).toHaveAttribute("href", "/hire/aave-health-sentinel");
    await page.goto("/hire/aave-health-sentinel");
    await expect(page).toHaveURL(/\/hire\/aave-health-sentinel$/);
    await expect(page.getByRole("heading", { name: "Hire Aave Health Sentinel" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect wallet to continue|Create ERC-8183 job/ })).toBeVisible();
  });

  test("renders all category hubs, comparison, and methodology", async ({ page }) => {
    for (const [slug, title] of categories) {
      await page.goto(`/categories/${slug}`);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByRole("heading", { name: /passed the category gate/ })).toBeVisible();
    }

    await page.goto("/compare?ids=aave-health-sentinel,venus-yield-desk,bnb-rebalance-pilot");
    await expect(page.getByRole("heading", { name: "Compare risk profiles." })).toBeVisible();
    await expect(page.getByText("3/3 selected")).toBeVisible();

    await page.goto("/methodology");
    await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live Model Context Protocol server" })).toBeVisible();
  });

  test("surfaces failed live verification instead of hiding it", async ({ page }) => {
    const response = await page.request.post("/api/marketplace/verify/aave-health-sentinel");
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.status).toBe("failed");
    expect(payload.checks.health).toBe(false);
    expect(payload.message).toMatch(/fetch failed|Unable to reach|returned HTTP|verification/);
  });

  test("runs the complete local job path and shows Risk Guard evidence", async ({ page }) => {
    let currentJob: unknown = simulationJob;
    await page.route("**/jobs/e2e-job", async (route) => {
      if (route.request().resourceType() === "document") return route.fallback();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentJob) });
    });
    await page.route("**/jobs/execute", async (route) => {
      currentJob = executedJob;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(executedJob) });
    });
    await page.route("**/jobs/e2e-job/verify", async (route) => {
      currentJob = verifiedJob;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: verifiedJob }) });
    });
    await page.route("**/jobs/e2e-job/monitor", async (route) => {
      currentJob = verifiedJob;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: verifiedJob }) });
    });

    await page.goto("/jobs/e2e-job");
    await expect(page.getByRole("heading", { name: "Aave Health Sentinel" })).toBeVisible();
    await page.getByRole("button", { name: "Run explicit local simulation" }).click();
    await expect(page.getByRole("heading", { name: "Proof envelope" })).toBeVisible();
    await expect(page.getByText("All configured Risk Guard thresholds passed.")).toBeVisible();
    await expect(page.getByText("MONITORING", { exact: true }).first()).toBeVisible();
  });

  test("keeps critical pages within a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/agents", "/compare", "/methodology", "/hire/aave-health-sentinel"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${path} has horizontal overflow`).toBe(false);
    }
    await page.goto("/agents/aave-health-sentinel");
    const ctaHeight = await page.getByRole("link", { name: /Hire with Risk Guard/ }).evaluate((element) => element.getBoundingClientRect().height);
    expect(ctaHeight).toBeGreaterThanOrEqual(44);
  });
});
