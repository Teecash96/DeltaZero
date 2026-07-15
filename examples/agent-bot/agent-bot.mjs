#!/usr/bin/env node

/**
 * DeltaZero Agent-in-a-Box
 *
 * Simulates a drifting SOL hedge, calls the paid live Position Auditor, handles
 * an x402 v2 challenge through the Onchain OS CLI, and prints (but never sends)
 * the exact rebalance payload an execution agent could consume.
 *
 * Requires Node.js 20+ and an authenticated `onchainos` CLI wallet.
 */

import { spawnSync } from "node:child_process";

const API_BASE = process.env.DELTAZERO_API_BASE ?? "https://deltazero-production.up.railway.app";
const POLL_MS = Number(process.env.DELTAZERO_POLL_MS ?? 5000);
const MAX_ITERATIONS = Number(process.env.DELTAZERO_MAX_ITERATIONS ?? 6);
const AUTO_PAY = process.env.DELTAZERO_AUTO_PAY === "1";
const MAX_PAYMENT_BASE_UNITS = BigInt(process.env.DELTAZERO_MAX_PAYMENT_BASE_UNITS ?? "10000");
const ADMIN_KEY = process.env.DELTAZERO_ADMIN_KEY;

const wallet = {
  asset: "SOL",
  long_notional_usd: 5_000,
  short_notional_usd: 4_850,
  collateral_usd: 2_000,
  risk_tolerance: "medium",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeChallenge(raw) {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
}

function parseCliJson(output) {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error(`Onchain OS returned non-JSON output: ${trimmed}`);
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function selectPayment(challenge) {
  const accepts = Array.isArray(challenge.accepts) ? challenge.accepts : [];
  if (accepts.length === 0) throw new Error("The server returned no supported payment options.");
  const exactIndex = accepts.findIndex((option) => option.scheme === "exact");
  const index = exactIndex >= 0 ? exactIndex : 0;
  const option = accepts[index];
  const amount = BigInt(option.amount);
  if (amount > MAX_PAYMENT_BASE_UNITS) {
    throw new Error(`Payment ${amount} exceeds DELTAZERO_MAX_PAYMENT_BASE_UNITS=${MAX_PAYMENT_BASE_UNITS}.`);
  }
  return { index, option };
}

function authorizePayment(rawChallenge, selectedIndex) {
  if (!AUTO_PAY) {
    throw new Error("Payment required. Set DELTAZERO_AUTO_PAY=1 only after reviewing the configured payment cap.");
  }

  const command = spawnSync(
    "onchainos",
    ["payment", "pay", "--payload", rawChallenge, "--selected-index", String(selectedIndex)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (command.error) throw command.error;
  if (command.status !== 0) throw new Error(command.stderr.trim() || "Onchain OS payment authorization failed.");
  const result = parseCliJson(command.stdout);
  if (!result.authorization_header || !result.header_name) {
    throw new Error("Onchain OS did not return a replay authorization header.");
  }
  return { headerName: result.header_name, authorization: result.authorization_header };
}

async function postAudit(headers = {}) {
  return fetch(`${API_BASE}/strategy/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(wallet),
  });
}

async function paidAudit() {
  const developerHeaders = ADMIN_KEY ? { "X-DeltaZero-Admin-Key": ADMIN_KEY } : {};
  let response = await postAudit(developerHeaders);
  if (response.status !== 402) return response;

  const rawChallenge = response.headers.get("PAYMENT-REQUIRED");
  if (!rawChallenge) throw new Error("HTTP 402 did not include a PAYMENT-REQUIRED challenge.");
  const challenge = decodeChallenge(rawChallenge);
  const { index, option } = selectPayment(challenge);
  console.log(`[payment] ${option.amount} base units on ${option.network} to ${option.payTo}`);
  const signed = authorizePayment(rawChallenge, index);
  response = await postAudit({ [signed.headerName]: signed.authorization });
  return response;
}

function simulateWalletScan(iteration) {
  const driftMultiplier = 1 + (iteration % 2 === 0 ? .018 : .032);
  wallet.long_notional_usd = Number((wallet.long_notional_usd * driftMultiplier).toFixed(2));
  return Math.abs(wallet.long_notional_usd - wallet.short_notional_usd) / wallet.long_notional_usd * 100;
}

function executionPayload(report) {
  const targetShort = Number((wallet.long_notional_usd * .96).toFixed(2));
  const difference = Number((targetShort - wallet.short_notional_usd).toFixed(2));
  return {
    version: "1.0",
    source: "deltazero-agent-bot",
    generated_at: new Date().toISOString(),
    mode: "PROPOSAL_ONLY",
    venue: "perpetuals",
    asset: wallet.asset,
    action: difference >= 0 ? "INCREASE_SHORT" : "REDUCE_SHORT",
    notional_delta_usd: Math.abs(difference),
    target_short_notional_usd: targetShort,
    current_short_notional_usd: wallet.short_notional_usd,
    max_slippage_bps: 25,
    requires_human_or_policy_approval: true,
    deltazero: {
      recommendation: report.recommendation.action,
      summary: report.recommendation.summary,
      hedge_drift_pct: report.metrics.hedge_drift_pct,
      safety_buffer_score: report.metrics.safety_buffer_score,
      decision_confidence: report.decision_confidence,
    },
  };
}

async function run() {
  console.log("DeltaZero Agent-in-a-Box started (proposal-only; no trades are executed).\n");
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    const localDrift = simulateWalletScan(iteration);
    console.log(`[scan ${iteration}] long=$${wallet.long_notional_usd.toFixed(2)} short=$${wallet.short_notional_usd.toFixed(2)} local drift=${localDrift.toFixed(2)}%`);
    if (localDrift < 5) {
      console.log("[decision] Drift remains below the 5% agent trigger. Monitoring continues.\n");
    } else {
      const response = await paidAudit();
      const body = await response.json();
      if (!response.ok) throw new Error(`DeltaZero API ${response.status}: ${JSON.stringify(body)}`);
      console.log(`[recommendation] ${body.recommendation.action}: ${body.recommendation.summary}`);
      console.log("[execution payload — not submitted]");
      console.log(JSON.stringify(executionPayload(body), null, 2));
      return;
    }
    if (iteration < MAX_ITERATIONS) await sleep(POLL_MS);
  }
  console.log("No rebalance trigger occurred within the configured scan window.");
}

run().catch((error) => {
  console.error(`[agent error] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
