import assert from "node:assert/strict";
import test from "node:test";

import {
  createMonthlyPlan,
  MONTHLY_PRICE_ATOMIC,
  NETWORK,
  PLAN_ID,
  toAccept,
} from "../src/plan.js";

test("the DeltaZero plan charges exactly 5 USDT per calendar month", () => {
  const plan = createMonthlyPlan("0x1111111111111111111111111111111111111111");
  const accept = toAccept(plan);

  assert.equal(plan.id, PLAN_ID);
  assert.equal(plan.amountPerPeriod, MONTHLY_PRICE_ATOMIC);
  assert.equal(plan.periodMode, 1);
  assert.equal(plan.periodSec, 0);
  assert.equal(plan.initialCharge?.totalAmount, "5000000");
  assert.equal(accept.scheme, "period");
  assert.equal(accept.network, NETWORK);
  assert.equal(accept.extra?.amountPerPeriod, "5000000");
  assert.equal(accept.extra?.periodMode, 1);
});
