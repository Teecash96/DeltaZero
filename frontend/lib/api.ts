import type {
  AuditRequest,
  AuditResponse,
  BuildRequest,
  BuildResponse,
  WalletAnalyzeRequest,
  WalletPortfolioResponse,
  StressTestRequest,
  StressTestResponse,
  HyperliquidMarketResponse,
  MonteCarloRequest,
  MonteCarloResponse,
  RiskEnginePassRequest,
  RiskEnginePassResponse,
} from "./types";
import { decodePaymentReceipt, storePaymentReceipt, verifyPaymentReceiptOnChain } from "./payment-receipt";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type X402PaymentOption = {
  amount?: string;
  asset?: string;
  network?: string;
  payTo?: string;
  extra?: Record<string, unknown>;
};

export type X402Challenge = {
  x402Version?: number;
  accepts?: X402PaymentOption[];
};

function decodePaymentChallenge(value: string | null): X402Challenge | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as unknown;
    return decoded && typeof decoded === "object" ? decoded as X402Challenge : null;
  } catch {
    return null;
  }
}

export class PaymentRequiredError extends Error {
  readonly status = 402;
  readonly challenge: X402Challenge | null;

  constructor(challengeHeader: string | null) {
    super(challengeHeader ? "Payment is required to access this endpoint." : "Protected endpoint returned HTTP 402.");
    this.name = "PaymentRequiredError";
    this.challenge = decodePaymentChallenge(challengeHeader);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 402) {
    throw new PaymentRequiredError(response.headers.get("PAYMENT-REQUIRED"));
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody = await response.json();
      detail =
        typeof errorBody.detail === "string"
          ? errorBody.detail
          : JSON.stringify(errorBody.detail ?? errorBody);
    } catch {
      // keep statusText
    }
    throw new Error(`API ${response.status}: ${detail}`);
  }

  const paymentReceipt = decodePaymentReceipt(response.headers.get("PAYMENT-RESPONSE"));
  if (paymentReceipt) storePaymentReceipt(await verifyPaymentReceiptOnChain(paymentReceipt));

  return response.json() as Promise<T>;
}

export function buildStrategy(body: BuildRequest): Promise<BuildResponse> {
  return post<BuildResponse>("/strategy/build", body);
}

export function auditStrategy(body: AuditRequest): Promise<AuditResponse> {
  return post<AuditResponse>("/strategy/audit", body);
}

export function stressTestStrategy(
  body: StressTestRequest,
): Promise<StressTestResponse> {
  return post<StressTestResponse>("/stress-test/run", body);
}

export function analyzeWallet(
  body: WalletAnalyzeRequest,
): Promise<WalletPortfolioResponse> {
  return post<WalletPortfolioResponse>("/wallet/analyze", body);
}

export function runMonteCarlo(body: MonteCarloRequest): Promise<MonteCarloResponse> {
  return post<MonteCarloResponse>("/monte-carlo/run", body);
}

export function runRiskEnginePass(body: RiskEnginePassRequest): Promise<RiskEnginePassResponse> {
  return post<RiskEnginePassResponse>("/risk-engine/analyze", body);
}

export async function getHyperliquidMarket(asset: string, lookbackHours = 24, dex?: string): Promise<HyperliquidMarketResponse> {
  const query = new URLSearchParams({ asset, lookback_hours: String(lookbackHours) });
  if (dex) query.set("dex", dex);
  const response = await fetch(`${API_BASE}/market/hyperliquid?${query}`);
  if (!response.ok) throw new Error(`Market API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<HyperliquidMarketResponse>;
}
