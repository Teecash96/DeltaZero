import { strict as assert } from "node:assert";
import test from "node:test";

import { DeltaZeroApiError, DeltaZeroClient, DeltaZeroError, DeltaZeroTimeoutError } from "../src/index.js";

type FetchStub = typeof fetch;

function mockResponse(body: string, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    async text() {
      return body;
    },
  } as Response;
}

function installFetch(stub: FetchStub) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return () => {
    globalThis.fetch = original;
  };
}

const builderResponse = {
  service: "strategy_builder",
  strategy_name: "DeltaZero Neutral Carry",
  asset: "SOL",
  strategy_health: "healthy",
  decision_confidence: 91,
  metrics: {
    hedge_ratio: 0.95,
    hedge_drift_pct: 3.1,
    net_delta_estimate: 0.8,
    estimated_net_carry_apy: 6.2,
    carry_efficiency_score: 76.4,
    safety_buffer_score: 86,
    capital_at_risk_proxy: 152,
  },
  recommendation: { action: "OPEN", summary: "Open the strategy." },
  risk_notes: ["Carry is positive."],
  recommended_structure: {
    long_notional_usd: 4200,
    short_notional_usd: 3990,
    collateral_usd: 800,
    target_hedge_ratio: 0.95,
  },
};

const builderRequest = {
  asset: "SOL",
  capital_usd: 5000,
  risk_tolerance: "medium",
  target_style: "neutral_yield",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
} as const;

test("successful builder request", async () => {
  const restore = installFetch(async () => mockResponse(JSON.stringify(builderResponse)));
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  const report = await client.buildStrategy(builderRequest);
  assert.equal(report.recommendation.action, "OPEN");
  restore();
});

test("successful risk-envelope request", async () => {
  const envelope = {
    schema_id: "https://deltazero.dev/schemas/risk-envelope/v1",
    schema_version: "1.0.0",
    methodology_version: "deltazero-v1",
    analysis_id: "dz_fixture",
    subject: { kind: "pseudo_delta_neutral_strategy", asset: "SOL", strategy_style: "neutral_yield", capital_usd: 5000 },
    decision: { action: "OPEN", risk_zone: "healthy", summary: "Healthy.", human_approval_required: true },
    measures: {}, evidence: {}, constraints: [], compatible_transports: ["REST", "MCP", "JSON"],
  };
  const restore = installFetch(async () => mockResponse(JSON.stringify(envelope)));
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  const report = await client.evaluateRiskEnvelope(builderRequest);
  assert.equal(report.schema_version, "1.0.0");
  assert.equal(report.decision.human_approval_required, true);
  restore();
});

test("successful auditor request", async () => {
  const restore = installFetch(async () => mockResponse(JSON.stringify({ ...builderResponse, actions: ["HOLD"] })));
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  const report = await client.auditPosition({
    asset: "SOL",
    long_notional_usd: 3800,
    short_notional_usd: 3000,
    collateral_usd: 1200,
    risk_tolerance: "medium",
    long_yield_apy: 12,
    short_funding_apy: 4,
    fee_drag_apy: 1,
  });
  assert.equal(report.actions[0], "HOLD");
  restore();
});

test("successful stress-test request", async () => {
  const restore = installFetch(async () =>
    mockResponse(JSON.stringify({ ...builderResponse, actions: ["REBALANCE"], scenario_result: { scenario_type: "funding_worsens", magnitude_pct: 4, stressed_long_notional_usd: 4200, stressed_short_notional_usd: 3990, stressed_collateral_usd: 800, stressed_long_yield_apy: 14, stressed_short_funding_apy: 7, stressed_metrics: builderResponse.metrics, health_after_stress: "warning", pre_stress_equity_usd: 1000, stressed_liabilities_usd: 0, estimated_impairment_loss_usd: 100, estimated_impairment_loss_pct: 10, post_impairment_equity_usd: 900, impairment_breakdown: { asset_value_impact_usd: 50, hedge_pnl_impact_usd: 20, collateral_haircut_usd: 10, exit_slippage_usd: 5, liquidation_penalty_usd: 10, protocol_loss_assumption_usd: 5 } }, pre_stress_equity_usd: 1000, stressed_liabilities_usd: 0, estimated_impairment_loss_usd: 100, estimated_impairment_loss_pct: 10, post_impairment_equity_usd: 900, impairment_breakdown: { asset_value_impact_usd: 50, hedge_pnl_impact_usd: 20, collateral_haircut_usd: 10, exit_slippage_usd: 5, liquidation_penalty_usd: 10, protocol_loss_assumption_usd: 5 } })),
  );
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  const report = await client.stressTest({
    asset: "SOL",
    long_notional_usd: 3500,
    short_notional_usd: 3150,
    collateral_usd: 1500,
    risk_tolerance: "medium",
    long_yield_apy: 14,
    short_funding_apy: 3,
    fee_drag_apy: 1,
    scenario: { type: "funding_worsens", magnitude_pct: 4 },
  });
  assert.equal(report.actions[0], "REBALANCE");
  restore();
});

test("successful wallet request", async () => {
  const restore = installFetch(async () =>
    mockResponse(
      JSON.stringify({
        service: "wallet_portfolio_auditor",
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        assessment_status: "positions_found",
        supported_positions_found: 1,
        unsupported_positions_found: 0,
        data_timestamp: "2026-07-12T00:00:00Z",
        data_quality: "complete",
        portfolio_summary: {
          current_position_value_usd: 4200,
          gross_long_exposure_usd: 4200,
          gross_short_exposure_usd: 3500,
          net_delta_usd: 700,
          net_delta_pct: 16.6,
          unrealized_pnl_usd: 100,
          collateral_value_usd: 1200,
          debt_value_usd: 0,
          estimated_funding_exposure_apy: 4.2,
        },
        risk_metrics: {
          hedge_ratio: 0.95,
          hedge_drift_pct: 3.2,
          collateral_health_score: 88,
          minimum_health_factor: 1.3,
          liquidation_proximity_pct: 12,
          safety_buffer_score: 86,
          capital_at_risk_proxy: 152,
          estimated_impairment_loss_usd: 12,
          estimated_impairment_loss_pct: 1.2,
          post_impairment_equity_usd: 988,
        },
        strategy_health: "healthy",
        decision_confidence: 94,
        recommendation: { action: "HOLD", summary: "Hold.", confidence: 94 },
        risk_notes: ["Carry is positive."],
        corrective_actions: ["Hold position."],
        positions: [],
        protocol_errors: [],
        warnings: [],
      }),
    ),
  );
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  const report = await client.auditWallet({
    wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
    networks: ["ethereum", "hyperliquid"],
    protocols: ["hyperliquid", "aave"],
    stress_profile: "standard",
  });
  assert.equal(report.recommendation?.action, "HOLD");
  restore();
});

test("timeout handling", async () => {
  const restore = installFetch(((...args: Parameters<FetchStub>) => {
    const init = args[1];
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }) as Promise<Response>;
  }) as FetchStub);
  const client = new DeltaZeroClient({ baseUrl: "https://example.com", timeoutMs: 1 });
  await assert.rejects(
    () =>
      client.buildStrategy({
        asset: "SOL",
        capital_usd: 5000,
        risk_tolerance: "medium",
        target_style: "neutral_yield",
        long_yield_apy: 14,
        short_funding_apy: 3,
        fee_drag_apy: 1,
      }),
    DeltaZeroTimeoutError,
  );
  restore();
});

test("non-2xx response", async () => {
  const restore = installFetch(async () => mockResponse(JSON.stringify({ detail: "Bad request" }), { ok: false, status: 400, statusText: "Bad Request" }));
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  await assert.rejects(() => client.buildStrategy(builderRequest), DeltaZeroApiError);
  restore();
});

test("invalid response body", async () => {
  const restore = installFetch(async () => mockResponse("not json"));
  const client = new DeltaZeroClient({ baseUrl: "https://example.com" });
  await assert.rejects(
    () => client.buildStrategy(builderRequest),
    (error: unknown) => error instanceof DeltaZeroError && !(error instanceof DeltaZeroApiError),
  );
  restore();
});
