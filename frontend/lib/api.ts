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
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

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
  return post<StressTestResponse>("/strategy/stress-test", body);
}

export function analyzeWallet(
  body: WalletAnalyzeRequest,
): Promise<WalletPortfolioResponse> {
  return post<WalletPortfolioResponse>("/wallet/analyze", body);
}

export async function getHyperliquidMarket(asset: string, lookbackHours = 24, dex?: string): Promise<HyperliquidMarketResponse> {
  const query = new URLSearchParams({ asset, lookback_hours: String(lookbackHours) });
  if (dex) query.set("dex", dex);
  const response = await fetch(`${API_BASE}/market/hyperliquid?${query}`);
  if (!response.ok) throw new Error(`Market API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<HyperliquidMarketResponse>;
}
