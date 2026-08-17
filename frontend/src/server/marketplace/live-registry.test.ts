import { describe, expect, it } from "vitest";

import { inferRiskCategoryForTest, parseRpcPayloadForTest } from "./live-registry";

describe("live BSC marketplace discovery helpers", () => {
  it("parses standard JSON and SSE JSON-RPC responses", () => {
    expect(parseRpcPayloadForTest('{"jsonrpc":"2.0","result":{"tools":[]}}')?.jsonrpc).toBe("2.0");
    expect(parseRpcPayloadForTest("event: message\ndata: {\"jsonrpc\":\"2.0\",\"result\":{\"tools\":[{}]}}\n\n")?.jsonrpc).toBe("2.0");
  });

  it("maps registered capability evidence to the four BNB categories", () => {
    expect(inferRiskCategoryForTest({ name: "Lending Guardian", description: "health factor and liquidation monitor" }, { kind: "a2a", endpoint: "https://example.com" })?.category).toBe("health_factor");
    expect(inferRiskCategoryForTest({ name: "Yield Desk", description: "APR vault optimizer" }, { kind: "mcp", endpoint: "https://example.com" })?.category).toBe("yield_optimisation");
    expect(inferRiskCategoryForTest({ name: "Range Keeper", description: "LP range rebalancer" }, { kind: "a2a", endpoint: "https://example.com" })?.category).toBe("rebalancing");
    expect(inferRiskCategoryForTest({ name: "Grid Operator", description: "perpetual order manager" }, { kind: "mcp", endpoint: "https://example.com" })?.category).toBe("grid_trading");
  });

  it("does not classify ambiguous metadata as a category", () => {
    expect(inferRiskCategoryForTest({ name: "Generic Assistant", description: "general purpose service" }, { kind: "a2a", endpoint: "https://example.com" })).toBeNull();
  });
});
