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
import { getDemoAccessKey } from "./demo-access";
import { decodePaymentReceipt, storePaymentReceipt, verifyPaymentReceiptOnChain, type PaymentReceipt, type PaymentReceiptContext } from "./payment-receipt";

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

const DEMO_ACCESS_PATHS = new Set([
  "/strategy/build",
  "/strategy/audit",
  "/strategy/stress-test",
  "/stress-test/run",
  "/wallet/analyze",
  "/monte-carlo/run",
  "/risk-engine/analyze",
]);

function protectedRequestHeaders(path: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const demoAccessKey = DEMO_ACCESS_PATHS.has(path) ? getDemoAccessKey() : null;
  if (demoAccessKey) headers["X-DeltaZero-Admin-Key"] = demoAccessKey;
  return headers;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: protectedRequestHeaders(path),
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

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    okxwallet?: Eip1193Provider;
    ethereum?: Eip1193Provider;
  }
}

export async function payRiskEngineWithWallet(body: RiskEnginePassRequest, challenge?: X402Challenge | null): Promise<RiskEnginePassResponse> {
  if (typeof window === "undefined") throw new Error("Wallet payment is only available in the browser.");
  const provider = window.okxwallet ?? window.ethereum;
  if (!provider) throw new Error("OKX Wallet was not detected. Install or open the OKX Wallet extension, then try again.");

  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc4" }] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : null;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0xc4", chainName: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: ["https://rpc.xlayer.tech"], blockExplorerUrls: ["https://www.oklink.com/xlayer"] }],
    });
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] as `0x${string}` : null;
  if (!address) throw new Error("No wallet account was authorized.");

  const [{ x402Client, wrapFetchWithPayment }, { ExactEvmScheme }] = await Promise.all([
    import("@okxweb3/x402-fetch"),
    import("@okxweb3/x402-evm"),
  ]);
  const signer = {
    address,
    async signTypedData(typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) {
      const json = JSON.stringify(typedData, (_, value) => typeof value === "bigint" ? value.toString() : value);
      return provider.request({ method: "eth_signTypedData_v4", params: [address, json] }) as Promise<`0x${string}`>;
    },
  };
  const client = new x402Client().register("eip155:196", new ExactEvmScheme(signer));
  const paidFetch = wrapFetchWithPayment(fetch, client);
  const response = await paidFetch(`${API_BASE}/risk-engine/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const responseBody = await response.json();
      detail = typeof responseBody.detail === "string" ? responseBody.detail : JSON.stringify(responseBody);
    } catch { /* retain status text */ }
    throw new Error(`Payment failed: ${detail}`);
  }
  const option = challenge?.accepts?.[0];
  const receiptContext: PaymentReceiptContext = {
    amount: option?.amount,
    asset: option?.asset,
    network: option?.network,
    receiver: option?.payTo,
    tokenName: typeof option?.extra?.name === "string" ? option.extra.name : "USD₮0",
    tokenDecimals: typeof option?.extra?.decimals === "number" ? option.extra.decimals : 6,
  };
  const paymentReceipt = decodePaymentReceipt(response.headers.get("PAYMENT-RESPONSE"), receiptContext);
  if (paymentReceipt) storePaymentReceipt(await verifyPaymentReceiptOnChain(paymentReceipt));
  return response.json() as Promise<RiskEnginePassResponse>;
}

type RecoveredPayment = {
  result: RiskEnginePassResponse;
  receipt: {
    transaction: string;
    network: string;
    payer: string;
    receiver: string;
    asset: string;
    amount_atomic: string;
    block_number: number;
    status: string;
    transfer_verified: boolean;
  };
};

export async function recoverRiskEnginePayment(transactionHash: string, analysis: RiskEnginePassRequest): Promise<RiskEnginePassResponse> {
  if (typeof window === "undefined") throw new Error("Payment recovery is only available in the browser.");
  const provider = window.okxwallet ?? window.ethereum;
  if (!provider) throw new Error("Open the wallet that sent the payment, then try again.");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const payer = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0].toLowerCase() : null;
  if (!payer) throw new Error("No wallet account was authorized.");
  const normalizedHash = transactionHash.trim().toLowerCase();
  const transactionResponse = await fetch("https://rpc.xlayer.tech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [normalizedHash] }),
  });
  const transactionPayload = await transactionResponse.json() as { result?: { from?: string } | null };
  const paymentSender = transactionPayload.result?.from?.toLowerCase();
  if (!paymentSender) throw new Error("The payment transaction was not found on X Layer.");
  if (paymentSender !== payer) {
    throw new Error(`Switch your wallet account to ${paymentSender}. The currently connected account is ${payer}.`);
  }
  const message = `DeltaZero payment recovery\nTransaction: ${normalizedHash}`;
  const encodedMessage = `0x${Array.from(new TextEncoder().encode(message), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const signature = await provider.request({ method: "personal_sign", params: [encodedMessage, payer] });
  if (typeof signature !== "string") throw new Error("Wallet did not return an ownership signature.");

  const response = await fetch(`${API_BASE}/risk-engine/recover-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_hash: normalizedHash, payer, signature, analysis }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Payment recovery failed with API ${response.status}.`);
  }
  const recovered = await response.json() as RecoveredPayment;
  const receipt: PaymentReceipt = {
    status: recovered.receipt.status,
    transaction: recovered.receipt.transaction,
    network: recovered.receipt.network,
    amountAtomic: recovered.receipt.amount_atomic,
    amountDisplay: "1 USD₮0",
    asset: recovered.receipt.asset,
    payer: recovered.receipt.payer,
    receiver: recovered.receipt.receiver,
    blockNumber: recovered.receipt.block_number,
    onchainStatus: "confirmed",
    transferVerified: recovered.receipt.transfer_verified,
    explorerUrl: `https://www.oklink.com/xlayer/tx/${recovered.receipt.transaction}`,
    recordedAt: new Date().toISOString(),
    facilitatorReceipt: { recovery: true, ...recovered.receipt },
  };
  storePaymentReceipt(receipt);
  return recovered.result;
}

export async function getHyperliquidMarket(asset: string, lookbackHours = 24, dex?: string): Promise<HyperliquidMarketResponse> {
  const query = new URLSearchParams({ asset, lookback_hours: String(lookbackHours) });
  if (dex) query.set("dex", dex);
  const response = await fetch(`${API_BASE}/market/hyperliquid?${query}`);
  if (!response.ok) throw new Error(`Market API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<HyperliquidMarketResponse>;
}
