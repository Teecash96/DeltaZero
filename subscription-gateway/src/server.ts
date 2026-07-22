import { OKXFacilitatorClient } from "@okxweb3/app-x402-core";
import {
  SubscriptionClient,
  type Subscription,
} from "@okxweb3/app-x402-core/subscription";
import {
  type RoutesConfig,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@okxweb3/app-x402-core/server";
import { PermitSubscriptionScheme } from "@okxweb3/app-x402-evm/subscription";
import { paymentMiddlewareFromHTTPServer } from "@okxweb3/app-x402-express";
import express, { type Request, type Response } from "express";
import { createClient } from "redis";

import { createMonthlyPlan, NETWORK, toAccept } from "./plan.js";
import { RedisSubscriptionStore } from "./store.js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const upstream = requireEnv("UPSTREAM_API_BASE_URL").replace(/\/$/, "");
const redis = createClient({ url: requireEnv("REDIS_URL") });
redis.on("error", (error) => console.error("redis_error", error));
await redis.connect();

const facilitator = new OKXFacilitatorClient({
  apiKey: requireEnv("OKX_API_KEY"),
  secretKey: requireEnv("OKX_SECRET_KEY"),
  passphrase: requireEnv("OKX_PASSPHRASE"),
  baseUrl: process.env.OKX_BASE_URL?.trim() || undefined,
  syncSettle: true,
});
const store = new RedisSubscriptionStore(redis);
const scheme = new PermitSubscriptionScheme({ facilitator, network: NETWORK, store });
const client = new SubscriptionClient({ scheme, store });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, scheme);
await resourceServer.initialize();

const plan = createMonthlyPlan(requireEnv("PAY_TO_ADDRESS"));
const accepts = [toAccept(plan)];
const protectedRoutes = [
  "POST /risk-engine/analyze",
  "POST /strategy/build",
  "POST /strategy/audit",
  "POST /stress-test/run",
  "POST /monte-carlo/run",
];
const routes: RoutesConfig = Object.fromEntries(
  protectedRoutes.map((route) => [
    route,
    {
      accepts,
      description: "DeltaZero deterministic DeFi risk intelligence — $5 per calendar month",
      mimeType: "application/json",
    },
  ]),
);
const httpServer = new x402HTTPResourceServer(resourceServer, routes);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(paymentMiddlewareFromHTTPServer(httpServer));

app.get("/health", (_request, response) => {
  response.json({ status: "ok", plan: plan.id, price: "5 USDT", cadence: "calendar_month" });
});
app.get("/plans", (_request, response) => {
  response.json({
    plans: [{ id: plan.id, name: plan.name, price: "5 USDT", cadence: "calendar_month" }],
  });
});

async function proxy(request: Request, response: Response): Promise<void> {
  const upstreamResponse = await fetch(`${upstream}${request.path}`, {
    method: request.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await upstreamResponse.text();
  response.status(upstreamResponse.status);
  response.type(upstreamResponse.headers.get("content-type") || "application/json");
  response.send(body);
}

for (const route of protectedRoutes) {
  const [, path] = route.split(" ");
  app.post(path, (request, response, next) => {
    proxy(request, response).catch(next);
  });
}

function isDue(subscription: Subscription, nowSeconds: number): boolean {
  return (
    subscription.state === "active" &&
    typeof subscription.nextChargeableAt === "number" &&
    subscription.nextChargeableAt <= nowSeconds
  );
}

let charging = false;
async function chargeDueSubscriptions(): Promise<void> {
  if (charging) return;
  charging = true;
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    for (const subscription of await store.list()) {
      if (!isDue(subscription, nowSeconds)) continue;
      try {
        await client.charge(subscription.subId);
        console.info("subscription_charge_succeeded", { subId: subscription.subId });
      } catch (error) {
        console.error("subscription_charge_failed", {
          subId: subscription.subId,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }
  } finally {
    charging = false;
  }
}

setInterval(() => void chargeDueSubscriptions(), 60_000).unref();

app.use((error: unknown, _request: Request, response: Response, _next: unknown) => {
  console.error("gateway_error", error);
  response.status(502).json({ error: "subscription_gateway_error" });
});

const port = Number(process.env.PORT || 4022);
app.listen(port, "0.0.0.0", () => {
  console.info(`DeltaZero subscription gateway listening on ${port}`);
});
