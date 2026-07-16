"use client";

import { useState, useSyncExternalStore } from "react";

import { getPaymentReceipt, subscribeToPaymentReceipt, type PaymentReceipt } from "@/lib/payment-receipt";

function shortAddress(value: string | null) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value ?? "Not returned";
}

function networkLabel(network: string | null) {
  return network === "eip155:196" ? "X Layer · eip155:196" : network ?? "Not returned";
}

function receiptJson(receipt: PaymentReceipt) {
  return JSON.stringify(receipt, null, 2);
}

export function PaymentReceiptCard() {
  const receipt = useSyncExternalStore(subscribeToPaymentReceipt, getPaymentReceipt, () => null);
  const [feedback, setFeedback] = useState<string | null>(null);
  if (!receipt) return null;

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(message);
      window.setTimeout(() => setFeedback(null), 1800);
    } catch {
      setFeedback("Copy unavailable");
    }
  }

  function download() {
    if (!receipt) return;
    const blob = new Blob([receiptJson(receipt)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `deltazero-payment-${receipt.transaction ?? "receipt"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const chainProof = receipt.onchainStatus === "confirmed" && receipt.transferVerified === true;
  return (
    <section className="panel payment-receipt-card" aria-label="Verified payment receipt">
      <header className="payment-receipt-heading">
        <div>
          <span className="decision-eyebrow">Paid analysis verified</span>
          <h2 className="panel-title">On-chain payment receipt</h2>
          <p>The facilitator receipt is preserved below and the transaction is checked independently against X Layer.</p>
        </div>
        <strong className={`payment-proof-status payment-proof-${chainProof ? "confirmed" : receipt.onchainStatus}`}>
          {chainProof ? "Transfer confirmed" : receipt.onchainStatus === "confirmed" ? "Transaction confirmed" : `On-chain ${receipt.onchainStatus}`}
        </strong>
      </header>

      <div className="payment-receipt-grid">
        <article><span>Settlement status</span><strong>{receipt.status}</strong></article>
        <article><span>Network</span><strong>{networkLabel(receipt.network)}</strong></article>
        <article><span>Amount</span><strong>{receipt.amountDisplay ?? receipt.amountAtomic ?? "Not returned"}</strong><small>{receipt.amountAtomic ? `${receipt.amountAtomic} atomic units` : "Atomic amount not returned"}</small></article>
        <article><span>Block</span><strong>{receipt.blockNumber?.toLocaleString() ?? "Not confirmed"}</strong></article>
        <article><span>Payer</span><strong title={receipt.payer ?? undefined}>{shortAddress(receipt.payer)}</strong></article>
        <article><span>Receiver</span><strong title={receipt.receiver ?? undefined}>{shortAddress(receipt.receiver)}</strong></article>
        <article><span>Asset contract</span><strong title={receipt.asset ?? undefined}>{shortAddress(receipt.asset)}</strong></article>
        <article><span>Transfer event</span><strong>{receipt.transferVerified === true ? "Matched" : receipt.transferVerified === false ? "Not matched" : "Not verified"}</strong></article>
      </div>

      <div className="payment-transaction-proof">
        <span>Transaction hash</span>
        <code>{receipt.transaction ?? "Not returned by facilitator"}</code>
        <div className="payment-receipt-actions">
          {receipt.transaction ? <button type="button" className="button" onClick={() => void copy(receipt.transaction as string, "Transaction copied")}>Copy transaction</button> : null}
          {receipt.explorerUrl ? <a className="button button-primary" href={receipt.explorerUrl} target="_blank" rel="noreferrer">View on OKLink ↗</a> : null}
          <button type="button" className="button" onClick={() => void copy(receiptJson(receipt), "Receipt JSON copied")}>Copy receipt JSON</button>
          <button type="button" className="button" onClick={download}>Download receipt</button>
          {feedback ? <small role="status">{feedback}</small> : null}
        </div>
      </div>

      <details className="payment-raw-receipt">
        <summary>Facilitator receipt payload</summary>
        <pre>{JSON.stringify(receipt.facilitatorReceipt, null, 2)}</pre>
      </details>
      <small>Recorded {new Date(receipt.recordedAt).toLocaleString()}. A successful explorer transaction and matching token-transfer event are the independent settlement evidence.</small>
    </section>
  );
}
