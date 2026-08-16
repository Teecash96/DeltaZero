"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useSwitchChain, useWalletClient } from "wagmi";
import type { Address } from "viem";

import {
  API_BASE_URL,
  attachPayment,
  cancelJob,
  completeJob,
  disputeJob,
  executeJobWithX402,
  executeJobSimulation,
  getJob,
  getPaymentChallenge,
  monitorJob,
  verifyJob,
  validatePaymentChallenge,
} from "@/src/lib/hire/api";
import type { JobRecord } from "@/src/lib/hire/types";
import { X_LAYER_CHAIN_ID } from "@/src/lib/web3/config";
import styles from "./hire.module.css";

function short(value: string | null | undefined): string {
  if (!value) return "Not available";
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function readable(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toFixed(2);
  return value == null ? "Not available" : JSON.stringify(value);
}

function isTerminal(status: JobRecord["status"]): boolean {
  return ["COMPLETED", "FAILED", "CANCELLED", "DISPUTED"].includes(status);
}

export function LiveJob({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [humanApproved, setHumanApproved] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  async function refresh() {
    try {
      const next = await getJob(jobId);
      setJob(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load job");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => {
      if (!job || !isTerminal(job.status)) void refresh();
    }, 5000);
    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(interval);
    };
    // Polling is intentionally bounded to the job page. The server worker is
    // the source of truth when DELTAZERO_ENABLE_JOB_WORKER is enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.status]);

  useEffect(() => {
    if (!job || isTerminal(job.status)) return;
    const interval = window.setInterval(() => { void monitorJob(job.id).then(setJob).catch(() => undefined); }, 15000);
    return () => window.clearInterval(interval);
  }, [job]);

  async function connectWallet() {
    const connector = connectors[0];
    if (!connector) {
      setError("No browser wallet connector is available.");
      return;
    }
    try {
      await connect({ connector });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed");
    }
  }

  async function payAndRun() {
    if (!job) return;
    setError(null);
    if (!isConnected || !address) {
      await connectWallet();
      return;
    }
    if (!walletClient) {
      setError("The connected wallet does not expose a signing client.");
      return;
    }
    setBusy("payment");
    try {
      const challenge = await getPaymentChallenge(job.id);
      const challengeError = validatePaymentChallenge(challenge, job.payment_amount);
      if (challengeError) throw new Error(challengeError);
      const challengeAmount = challenge.amount;
      const challengeRecipient = challenge.recipient;
      const challengeNetwork = challenge.network;
      if (!challengeAmount || !challengeRecipient || !challengeNetwork) {
        throw new Error("The x402 challenge became incomplete before signing. No payment was attempted.");
      }
      if (chainId !== X_LAYER_CHAIN_ID && switchChainAsync) {
        await switchChainAsync({ chainId: X_LAYER_CHAIN_ID });
      }
      const execution = await executeJobWithX402(job.id, address as Address, walletClient);
      let next = execution.job;
      next = await attachPayment(job.id, {
        amount: challengeAmount,
        currency: challenge.currency ?? "USDT",
        network: challengeNetwork,
        payer: address as Address,
        recipient: challengeRecipient,
        resource: challenge.resource,
        paymentResponseHeader: execution.paymentResponseHeader,
      });
      next = await verifyJob(job.id);
      next = await monitorJob(job.id);
      setJob(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment or execution failed");
    } finally {
      setBusy(null);
    }
  }

  async function runSimulation() {
    if (!job) return;
    setError(null);
    setBusy("simulation");
    try {
      const execution = await executeJobSimulation(job.id);
      let next = await verifyJob(job.id);
      next = await monitorJob(job.id);
      setJob(next ?? execution.job);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Simulation failed");
    } finally {
      setBusy(null);
    }
  }

  async function perform(action: "complete" | "cancel" | "dispute") {
    if (!job) return;
    setError(null);
    setBusy(action);
    try {
      const next = action === "complete"
        ? await completeJob(job.id, humanApproved)
        : action === "cancel" ? await cancelJob(job.id) : await disputeJob(job.id);
      setJob(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} job`);
    } finally {
      setBusy(null);
    }
  }

  const summary = useMemo(() => {
    const envelope = job?.result?.risk_envelope;
    const measures = envelope && typeof envelope === "object" && "measures" in envelope ? (envelope as { measures?: Record<string, unknown> }).measures : undefined;
    return {
      safety: measures?.safety_buffer_score,
      confidence: measures?.decision_confidence,
      action: envelope && typeof envelope === "object" && "decision" in envelope ? (envelope as { decision?: { action?: string } }).decision?.action : undefined,
    };
  }, [job]);

  if (loading) return <main className={styles.page}><p className={styles.eyebrow}>Risk Guard job</p><h1 className={styles.title}>Loading job…</h1></main>;
  if (!job) return <main className={styles.page}><p className={`${styles.notice} ${styles.error}`} role="alert">{error ?? "Job not found"}</p><Link className={styles.secondary} href="/agents">Back to marketplace</Link></main>;

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/agents">← Back to marketplace</Link>
      <div className={styles.jobTop}>
        <div><p className={styles.eyebrow}>Live Risk Guard job</p><h1 className={styles.title}>{job.agent_name}</h1><p className={styles.lede}>{job.objective}</p></div>
        <span className={styles.status} data-state={job.risk_guard?.state ?? job.status}>{job.risk_guard?.state ?? job.status}</span>
      </div>

      {error ? <p className={`${styles.notice} ${styles.error}`} role="alert">{error}</p> : null}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Job and payment</h2>
          <div className={styles.proofGrid}>
            <div className={styles.proofItem}><span>Job ID</span><strong>{short(job.id)}</strong></div>
            <div className={styles.proofItem}><span>Execution mode</span><strong>{job.execution_mode === "simulation" ? "Simulation · no chain write" : "ERC-8183 live"}</strong></div>
            <div className={styles.proofItem}><span>Agent identity</span><strong>{job.agent_erc8004_id}</strong></div>
            <div className={styles.proofItem}><span>Buyer</span><strong>{short(job.buyer_address)}</strong></div>
            <div className={styles.proofItem}><span>Maximum budget</span><strong>{job.budget_amount} {job.budget_currency}</strong></div>
            <div className={styles.proofItem}><span>x402 price</span><strong>{job.payment_amount} {job.budget_currency}</strong></div>
            <div className={styles.proofItem}><span>Deadline</span><strong>{new Date(job.deadline).toLocaleString()}</strong></div>
            <div className={styles.proofItem}><span>Payment state</span><strong>{job.payment?.status ?? "AWAITING_PAYMENT"}</strong></div>
          </div>
          {!job.payment ? <div className={styles.buttonRow}>
            <button className={styles.primary} type="button" onClick={payAndRun} disabled={busy !== null || connecting || switching}>{busy === "payment" ? "Paying and running…" : switching ? "Switching to X Layer…" : isConnected ? "Pay with x402 and run →" : "Connect wallet to pay"}</button>
            {job.execution_mode === "simulation" ? <button className={styles.secondary} type="button" onClick={() => void runSimulation()} disabled={busy !== null}>{busy === "simulation" ? "Running simulation…" : "Run explicit local simulation"}</button> : null}
          </div> : null}
          {job.payment ? <div className={`${styles.notice} ${styles.success}`}><strong>Payment linked.</strong> {job.payment.settlement_source === "simulation" ? "This is a simulation receipt." : "The x402 settlement was accepted by the API."} {job.payment.payment_response_header ? "Settlement response preserved." : "Settlement response header not attached."}</div> : null}
        </section>

        <aside className={styles.panel}>
          <h2>Risk Guard</h2>
          <div className={styles.metricGrid}>
            <div className={styles.metric}><span>State</span><strong>{job.risk_guard?.state ?? "PAUSE"}</strong></div>
            <div className={styles.metric}><span>Safety Buffer</span><strong>{readable(job.risk_guard?.safety_buffer)}</strong></div>
            <div className={styles.metric}><span>Confidence</span><strong>{readable(job.risk_guard?.decision_confidence)}</strong></div>
            <div className={styles.metric}><span>Data age</span><strong>{job.risk_guard?.data_age_minutes == null ? "n/a" : `${job.risk_guard.data_age_minutes.toFixed(1)}m`}</strong></div>
          </div>
          <p className={styles.help}>{job.risk_guard?.reasons.join(" ") ?? "No verified result yet. Execution is paused."}</p>
          <p className={styles.help}>Endpoint: {job.risk_guard?.endpoint_available ? "available" : "unavailable"}. Deadline: {job.risk_guard?.deadline_ok ? "inside window" : "expired"}.</p>
          {job.proof && job.risk_guard?.state !== "COMPLETE" ? <label className={styles.checkRow}><input type="checkbox" checked={humanApproved} onChange={(event) => setHumanApproved(event.target.checked)} /><span>I approve the current Risk Guard action and understand that DeltaZero does not execute trades.</span></label> : null}
        </aside>
      </div>

      {job.result ? <section className={styles.panel}>
        <h2>Agent result</h2>
        <div className={styles.metricGrid}>
          <div className={styles.metric}><span>Safety Buffer</span><strong>{readable(summary.safety)}</strong></div>
          <div className={styles.metric}><span>Decision Confidence</span><strong>{readable(summary.confidence)}</strong></div>
          <div className={styles.metric}><span>Operator action</span><strong>{readable(summary.action)}</strong></div>
          <div className={styles.metric}><span>Generated</span><strong>{job.result.generated_at ? new Date(String(job.result.generated_at)).toLocaleTimeString() : "n/a"}</strong></div>
        </div>
        <div className={styles.resultBox}><pre>{JSON.stringify(job.result, null, 2)}</pre></div>
      </section> : null}

      {job.proof ? <section className={styles.panel}>
        <h2>Proof envelope</h2>
        <div className={styles.proofGrid}>
          <div className={styles.proofItem}><span>Schema validated</span><strong>{job.proof.schema_validated ? "Yes" : "No"}</strong></div>
          <div className={styles.proofItem}><span>Identity verified</span><strong>{job.proof.identity_verified ? "Yes" : "No"}</strong></div>
          <div className={styles.proofItem}><span>Payment verified</span><strong>{job.proof.payment_verified ? "Yes" : "No"}</strong></div>
          <div className={styles.proofItem}><span>Result hash</span><strong>{short(job.proof.result_hash)}</strong></div>
        </div>
      </section> : null}

      <section className={styles.panel}>
        <h2>Monitoring timeline</h2>
        <ol className={styles.timeline}>{job.timeline.map((event, index) => <li key={`${event.at}-${index}`}><time>{new Date(event.at).toLocaleString()}</time><span><strong>{event.status}</strong> · {event.message}</span></li>)}</ol>
        <div className={styles.buttonRow}>
          {job.proof && job.status !== "COMPLETED" && job.status !== "CANCELLED" && job.status !== "DISPUTED" ? <button className={styles.primary} type="button" onClick={() => void perform("complete")} disabled={busy !== null}>{busy === "complete" ? "Completing…" : "Complete job"}</button> : null}
          {!isTerminal(job.status) ? <button className={styles.danger} type="button" onClick={() => void perform("cancel")} disabled={busy !== null}>{busy === "cancel" ? "Cancelling…" : "Cancel"}</button> : null}
          {!isTerminal(job.status) ? <button className={styles.secondary} type="button" onClick={() => void perform("dispute")} disabled={busy !== null}>{busy === "dispute" ? "Opening dispute…" : "Dispute"}</button> : null}
        </div>
        <p className={`${styles.small} ${styles.muted}`}>API: {API_BASE_URL}. Monitoring is read only. A production worker can refresh Risk Guard when the browser is closed.</p>
      </section>
    </main>
  );
}
