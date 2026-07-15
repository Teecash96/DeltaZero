export const PAYMENT_RECEIPT_KEY = "deltazero-payment-receipt";
export const PAYMENT_RECEIPT_EVENT = "deltazero-payment-receipt-change";

export type PaymentReceipt = {
  status: string;
  transaction: string | null;
  network: string | null;
  amount: string | null;
  payer: string | null;
  recordedAt: string;
};

let cachedRaw: string | null | undefined;
let cachedReceipt: PaymentReceipt | null = null;

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function decodePaymentReceipt(value: string | null): PaymentReceipt | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;
    return {
      status: stringField(decoded.status) ?? (decoded.success === true ? "settled" : "verified"),
      transaction: stringField(decoded.transaction) ?? stringField(decoded.txHash),
      network: stringField(decoded.network),
      amount: stringField(decoded.amount),
      payer: stringField(decoded.payer),
      recordedAt: new Date().toISOString(),
    };
  } catch {
    return null;
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
