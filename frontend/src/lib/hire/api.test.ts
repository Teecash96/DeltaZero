import { describe, expect, it } from "vitest";

import { validatePaymentChallenge } from "./api";

const validChallenge = {
  job_id: "job-1",
  x402_required: true,
  configured: true,
  network: "eip155:196",
  amount: "1",
  currency: "USDT",
  recipient: "0x2222222222222222222222222222222222222222",
  resource: "https://deltazero-production.up.railway.app/jobs/execute",
  message: "Payment required",
};

describe("x402 hire payment validation", () => {
  it("accepts the expected network, amount, recipient, and resource", () => {
    expect(validatePaymentChallenge(validChallenge, "1")).toBeNull();
  });

  it("rejects a price mismatch before signing", () => {
    expect(validatePaymentChallenge({ ...validChallenge, amount: "5" }, "1")).toMatch(/does not match/);
  });

  it("rejects a wrong network, recipient, or replay resource", () => {
    expect(validatePaymentChallenge({ ...validChallenge, network: "eip155:56" }, "1")).toMatch(/X Layer/);
    expect(validatePaymentChallenge({ ...validChallenge, recipient: "not-an-address" }, "1")).toMatch(/valid EVM address/);
    expect(validatePaymentChallenge({ ...validChallenge, resource: "https://example.com/jobs/execute" }, "1")).toMatch(/resource does not match/);
  });
});
