export const PAYMENT_RECEIPT_KEY = "deltazero-payment-receipt";
export const PAYMENT_RECEIPT_EVENT = "deltazero-payment-receipt-change";

const X_LAYER_RPC = "https://rpc.xlayer.tech";
const X_LAYER_EXPLORER = "https://www.oklink.com/xlayer/tx/";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type PaymentReceiptContext = {
  amount?: string;
  asset?: string;
  network?: string;
  receiver?: string;
  tokenName?: string;
  tokenDecimals?: number;
};

export type PaymentReceipt = {
  status: string;
  transaction: string | null;
  network: string | null;
  amountAtomic: string | null;
  amountDisplay: string | null;
  asset: string | null;
  payer: string | null;
  receiver: string | null;
  blockNumber: number | null;
  onchainStatus: "confirmed" | "failed" | "pending" | "unavailable";
  transferVerified: boolean | null;
  explorerUrl: string | null;
  recordedAt: string;
  facilitatorReceipt: Record<string, unknown>;
};

let cachedRaw: string | null | undefined;
let cachedReceipt: PaymentReceipt | null = null;

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatAmount(amount: string | null, decimals: number, tokenName: string) {
  if (!amount || !/^\d+$/.test(amount)) return null;
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} ${tokenName}`;
}

export function decodePaymentReceipt(value: string | null, context: PaymentReceiptContext = {}): PaymentReceipt | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;
    const transaction = stringField(decoded.transaction) ?? stringField(decoded.txHash);
    const network = stringField(decoded.network) ?? context.network ?? null;
    const amountAtomic = stringField(decoded.amount) ?? context.amount ?? null;
    const asset = stringField(decoded.asset) ?? context.asset ?? null;
    const receiver = stringField(decoded.payTo) ?? stringField(decoded.receiver) ?? context.receiver ?? null;
    const decimals = context.tokenDecimals ?? 6;
    const tokenName = context.tokenName ?? "USD₮0";
    return {
      status: stringField(decoded.status) ?? (decoded.success === true ? "settled" : "verified"),
      transaction,
      network,
      amountAtomic,
      amountDisplay: formatAmount(amountAtomic, decimals, tokenName),
      asset,
      payer: stringField(decoded.payer),
      receiver,
      blockNumber: null,
      onchainStatus: transaction ? "pending" : "unavailable",
      transferVerified: null,
      explorerUrl: transaction && network === "eip155:196" ? `${X_LAYER_EXPLORER}${transaction}` : null,
      recordedAt: new Date().toISOString(),
      facilitatorReceipt: decoded,
    };
  } catch {
    return null;
  }
}

function topicAddress(topic: unknown) {
  return typeof topic === "string" && topic.length >= 42 ? `0x${topic.slice(-40)}`.toLowerCase() : null;
}

export async function verifyPaymentReceiptOnChain(receipt: PaymentReceipt): Promise<PaymentReceipt> {
  if (receipt.network !== "eip155:196" || !receipt.transaction || !/^0x[0-9a-fA-F]{64}$/.test(receipt.transaction)) return receipt;
  try {
    const response = await fetch(X_LAYER_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [receipt.transaction] }),
    });
    if (!response.ok) return { ...receipt, onchainStatus: "unavailable" };
    const payload = await response.json() as { result?: { status?: string; blockNumber?: string; logs?: Array<{ address?: string; topics?: unknown[]; data?: string }> } | null };
    if (!payload.result) return { ...receipt, onchainStatus: "pending" };
    const result = payload.result;
    const onchainStatus = result.status === "0x1" ? "confirmed" : result.status === "0x0" ? "failed" : "unavailable";
    const expectedAsset = receipt.asset?.toLowerCase();
    const expectedReceiver = receipt.receiver?.toLowerCase();
    const expectedAmount = receipt.amountAtomic ? BigInt(receipt.amountAtomic) : null;
    const matchingTransfer = result.logs?.some((log) => {
      if (log.address?.toLowerCase() !== expectedAsset || String(log.topics?.[0]).toLowerCase() !== TRANSFER_TOPIC) return false;
      const to = topicAddress(log.topics?.[2]);
      const amount = typeof log.data === "string" ? BigInt(log.data) : null;
      return to === expectedReceiver && amount === expectedAmount;
    });
    return {
      ...receipt,
      blockNumber: result.blockNumber ? Number.parseInt(result.blockNumber, 16) : null,
      onchainStatus,
      transferVerified: expectedAsset && expectedReceiver && expectedAmount !== null ? Boolean(matchingTransfer) : null,
    };
  } catch {
    return { ...receipt, onchainStatus: "unavailable" };
  }
}

export function storePaymentReceipt(receipt: PaymentReceipt) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(receipt);
  sessionStorage.setItem(PAYMENT_RECEIPT_KEY, raw);
  cachedRaw = raw;
  cachedReceipt = receipt;
  window.dispatchEvent(new Event(PAYMENT_RECEIPT_EVENT));
}

export function getPaymentReceipt(): PaymentReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAYMENT_RECEIPT_KEY);
    if (raw === cachedRaw) return cachedReceipt;
    cachedRaw = raw;
    cachedReceipt = raw ? JSON.parse(raw) as PaymentReceipt : null;
    return cachedReceipt;
  } catch {
    cachedRaw = null;
    cachedReceipt = null;
    return null;
  }
}

export function subscribeToPaymentReceipt(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(PAYMENT_RECEIPT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(PAYMENT_RECEIPT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
