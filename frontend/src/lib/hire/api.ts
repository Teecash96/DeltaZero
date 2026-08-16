"use client";

import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { isAddress } from "viem";
import type { Address, WalletClient } from "viem";

import type {
  JobCreatePayload,
  JobRecord,
  PaymentChallenge,
  PaymentExecutionResult,
  RiskPolicy,
} from "./types";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://deltazero-production.up.railway.app"
).replace(/\/$/, "");

export class HireApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HireApiError";
    this.status = status;
    this.body = body;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const detail = typeof body === "object" && body && "detail" in body ? String(body.detail) : response.statusText;
    throw new HireApiError(detail || "Hire API request failed", response.status, body);
  }
  return body as T;
}

export function defaultRiskPolicy(): RiskPolicy {
  return {
    safety_buffer_min: 50,
    decision_confidence_min: 70,
    data_freshness_max_minutes: 30,
    require_human_approval_for: ["ADJUST", "REDUCE", "CLOSE"],
    endpoint_timeout_seconds: 10,
  };
}

export async function createJob(payload: JobCreatePayload): Promise<JobRecord> {
  return requestJson<JobRecord>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getJob(jobId: string): Promise<JobRecord> {
  return requestJson<JobRecord>(`/jobs/${encodeURIComponent(jobId)}`);
}

export async function getPaymentChallenge(jobId: string): Promise<PaymentChallenge> {
  return requestJson<PaymentChallenge>(`/jobs/${encodeURIComponent(jobId)}/payment-challenge`);
}

export function validatePaymentChallenge(
  challenge: PaymentChallenge,
  expectedAmount: string,
): string | null {
  if (!challenge.configured || !challenge.x402_required) {
    return "The API did not expose an active x402 challenge. No payment was attempted.";
  }
  if (challenge.amount !== expectedAmount) {
    return `Challenge price ${challenge.amount ?? "unknown"} USDT does not match job price ${expectedAmount} USDT.`;
  }
  if (challenge.network !== "eip155:196") {
    return `The challenge uses ${challenge.network ?? "an unknown network"}. DeltaZero requires X Layer (eip155:196).`;
  }
  if (!challenge.recipient || !isAddress(challenge.recipient)) {
    return "The challenge recipient is missing or is not a valid EVM address. No payment was attempted.";
  }
  const expectedResource = `${API_BASE_URL}/jobs/execute`;
  if (challenge.resource !== expectedResource) {
    return `The challenge resource does not match ${expectedResource}. No payment was attempted.`;
  }
  return null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createPaymentSigner(account: Address, walletClient: WalletClient): ClientEvmSigner {
  const signTypedData = walletClient.signTypedData as unknown as (message: {
    account: Address;
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<`0x${string}`>;
  return {
    address: account,
    signTypedData: async (message) =>
      signTypedData({
        account,
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      }),
  };
}

export async function executeJobWithX402(
  jobId: string,
  account: Address,
  walletClient: WalletClient,
): Promise<PaymentExecutionResult> {
  const signer = createPaymentSigner(account, walletClient);
  const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(signer) }],
  });
  const response = await paidFetch(`${API_BASE_URL}/jobs/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const detail = typeof body === "object" && body && "detail" in body ? String(body.detail) : response.statusText;
    throw new HireApiError(`x402 execution failed: ${detail}`, response.status, body);
  }
  return {
    job: body as JobRecord,
    paymentResponseHeader: response.headers.get("PAYMENT-RESPONSE") ?? undefined,
  };
}

export async function executeJobSimulation(jobId: string): Promise<PaymentExecutionResult> {
  return { job: await requestJson<JobRecord>("/jobs/execute", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId }),
  }) };
}

export async function attachPayment(
  jobId: string,
  payment: {
    amount: string;
    currency: string;
    network: string;
    payer: Address;
    recipient?: string;
    resource?: string;
    paymentResponseHeader?: string;
  },
): Promise<JobRecord> {
  const response = await requestJson<{ job: JobRecord }>(`/jobs/${encodeURIComponent(jobId)}/payment`, {
    method: "POST",
    body: JSON.stringify({
      ...payment,
      status: "SETTLED",
      payment_response_header: payment.paymentResponseHeader,
      settlement_source: "x402",
    }),
  });
  return response.job;
}

export async function verifyJob(jobId: string): Promise<JobRecord> {
  return (await requestJson<{ job: JobRecord }>(`/jobs/${encodeURIComponent(jobId)}/verify`, { method: "POST" })).job;
}

export async function monitorJob(jobId: string): Promise<JobRecord> {
  return (await requestJson<{ job: JobRecord }>(`/jobs/${encodeURIComponent(jobId)}/monitor`, { method: "POST" })).job;
}

export async function completeJob(jobId: string, humanApproved: boolean): Promise<JobRecord> {
  return (await requestJson<{ job: JobRecord }>(`/jobs/${encodeURIComponent(jobId)}/complete`, {
    method: "POST",
    body: JSON.stringify({ human_approved: humanApproved }),
  })).job;
}

export async function cancelJob(jobId: string): Promise<JobRecord> {
  return (await requestJson<{ job: JobRecord }>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" })).job;
}

export async function disputeJob(jobId: string): Promise<JobRecord> {
  return (await requestJson<{ job: JobRecord }>(`/jobs/${encodeURIComponent(jobId)}/dispute`, { method: "POST" })).job;
}
