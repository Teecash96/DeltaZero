"use client";

import { useSyncExternalStore } from "react";

import { getPaymentReceipt, subscribeToPaymentReceipt } from "@/lib/payment-receipt";

function abbreviated(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
}

export function PaymentReceiptCard() {
  const receipt = useSyncExternalStore(subscribeToPaymentReceipt, getPaymentReceipt, () => null);
  if (!receipt) return null;

  return (
    <section className="panel payment-receipt-card" aria-label="Verified payment receipt">
      <div>
        <span className="decision-eyebrow">Paid analysis verified</span>
        <h2 className="panel-title">Payment receipt</h2>
        <p>The protected endpoint returned this receipt after verification and replay.</p>
      </div>
      <div className="payment-receipt-grid">
        <article><span>Status</span><strong>{receipt.status}</strong></article>
        <article><span>Network</span><strong>{receipt.network ?? "Not returned"}</strong></article>
        <article><span>Amount</span><strong>{receipt.amount ?? "Not returned"}</strong></article>
        <article title={receipt.transaction ?? undefined}><span>Transaction</span><strong>{receipt.transaction ? abbreviated(receipt.transaction) : "Not returned"}</strong></article>
      </div>
      <small>Recorded {new Date(receipt.recordedAt).toLocaleString()}. Receipt fields come directly from the protected API response.</small>
    </section>
  );
}
