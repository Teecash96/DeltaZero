"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { BSC_CHAIN_ID } from "@/src/lib/web3/config";
import type { MarketplaceAgent } from "@/src/lib/marketplace/types";
import {
  createJob,
  defaultRiskPolicy,
  sha256Hex,
} from "@/src/lib/hire/api";
import styles from "./hire.module.css";

function defaultDeadline(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatAddress(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function HireConfiguration({ agent }: { agent: MarketplaceAgent }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [objective, setObjective] = useState(`Run a verified ${agent.categories[0].replaceAll("_", " ")} assessment and return the complete risk envelope.`);
  const [walletInput, setWalletInput] = useState("");
  const [asset, setAsset] = useState("SOL");
  const [capital, setCapital] = useState("5000");
  const [longYield, setLongYield] = useState("14");
  const [shortFunding, setShortFunding] = useState("3");
  const [feeDrag, setFeeDrag] = useState("1");
  const [stress, setStress] = useState("4");
  const [simulations, setSimulations] = useState("1000");
  const [horizon, setHorizon] = useState("30");
  const [budget, setBudget] = useState(() => (
    agent.startingPrice.amount === "Not listed"
      ? (process.env.NEXT_PUBLIC_X402_PRICE_USDT ?? "1")
      : agent.startingPrice.amount
  ));
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [safetyMin, setSafetyMin] = useState("50");
  const [confidenceMin, setConfidenceMin] = useState("70");
  const [freshness, setFreshness] = useState("30");
  const [requireApproval, setRequireApproval] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const paymentAmount = process.env.NEXT_PUBLIC_X402_PRICE_USDT ?? "1";
  const expectedSchemaLabel = "risk-envelope.v1";
  const liveWriterConfigured = Boolean(process.env.NEXT_PUBLIC_ERC8183_CONTRACT_ADDRESS);
  const riskPolicy = useMemo(() => ({
    ...defaultRiskPolicy(),
    safety_buffer_min: Number(safetyMin),
    decision_confidence_min: Number(confidenceMin),
    data_freshness_max_minutes: Number(freshness),
    require_human_approval_for: requireApproval ? ["ADJUST", "REDUCE", "CLOSE"] : [],
  }), [confidenceMin, freshness, requireApproval, safetyMin]);

  async function connectWallet() {
    setError(null);
    const connector = connectors[0];
    if (!connector) {
      setError("No browser wallet connector is available. Install or enable an EVM wallet.");
      return;
    }
    try {
      await connect({ connector });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed");
    }
  }

  async function submit() {
    setError(null);
    if (!isConnected || !address) {
      await connectWallet();
      return;
    }
    setCreating(true);
    try {
      if (chainId !== BSC_CHAIN_ID && switchChainAsync) {
        await switchChainAsync({ chainId: BSC_CHAIN_ID });
      }
      const expectedSchemaHash = await sha256Hex(expectedSchemaLabel);
      const job = await createJob({
        agent_id: agent.id,
        agent_erc8004_id: agent.erc8004AgentId,
        agent_name: agent.name,
        provider_address: agent.registryProof.ownerAddress,
        buyer_address: address,
        agent_endpoint: agent.endpoint,
        agent_verified: agent.verification.status === "passed",
        agent_status: "ACTIVE",
        category: agent.categories[0],
        objective,
        input_data: {
          asset,
          capital_usd: Number(capital),
          risk_tolerance: "medium",
          target_style: "neutral_yield",
          long_yield_apy: Number(longYield),
          short_funding_apy: Number(shortFunding),
          fee_drag_apy: Number(feeDrag),
          stress_magnitude_pct: Number(stress),
          simulation_count: Number(simulations),
          time_horizon_days: Number(horizon),
          wallet_or_portfolio: walletInput.trim() || undefined,
        },
        budget_amount: budget,
        budget_currency: "USDT",
        payment_amount: paymentAmount,
        deadline: new Date(deadline).toISOString(),
        risk_policy: riskPolicy,
        expected_schema_hash: expectedSchemaHash,
        allow_simulation: !liveWriterConfigured,
      });
      window.location.assign(`/jobs/${encodeURIComponent(job.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job creation failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/agents/${agent.id}`}>← Back to agent</Link>
      <p className={styles.eyebrow}>Risk Guard hire configuration</p>
      <h1 className={styles.title}>Hire {agent.name}</h1>
      <p className={styles.lede}>Create one bounded job. DeltaZero records the terms, checks the agent result, and monitors the risk policy before completion.</p>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.agentHeader}>
            <div>
              <p className={styles.eyebrow}>Verified BSC · ERC-8004 {agent.erc8004AgentId}</p>
              <h2>{agent.name}</h2>
              <p>{agent.description}</p>
            </div>
            <div className={styles.score}><strong>{agent.risk.deltaZeroScore.toFixed(0)}</strong><span>DeltaZero score</span></div>
          </div>
          <div className={styles.metricGrid}>
            <div className={styles.metric}><span>Risk zone</span><strong>{agent.risk.status}</strong></div>
            <div className={styles.metric}><span>Safety Buffer</span><strong>{agent.risk.safetyBuffer.toFixed(1)}</strong></div>
            <div className={styles.metric}><span>Confidence</span><strong>{agent.risk.decisionConfidence.toFixed(1)}</strong></div>
            <div className={styles.metric}><span>Functionality</span><strong>{agent.risk.functionality.toFixed(1)}</strong></div>
          </div>

          <div className={styles.section}>
            <h2>Job objective</h2>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="objective">What should the agent do?</label><textarea id="objective" value={objective} onChange={(event) => setObjective(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="wallet">Wallet or portfolio input</label><input id="wallet" value={walletInput} onChange={(event) => setWalletInput(event.target.value)} placeholder="Optional public address or JSON reference" /><span className={styles.help}>Read only. No signature or custody is requested.</span></div>
              <div className={styles.field}><label htmlFor="asset">Asset</label><select id="asset" value={asset} onChange={(event) => setAsset(event.target.value)}><option>SOL</option><option>ETH</option><option>BNB</option><option>BTC</option></select></div>
              <div className={styles.field}><label htmlFor="capital">Capital under review (USD)</label><input id="capital" type="number" min="0" value={capital} onChange={(event) => setCapital(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="budget">Maximum job budget (USDT)</label><input id="budget" type="number" min="0" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="long-yield">Long yield APY (%)</label><input id="long-yield" type="number" min="0" value={longYield} onChange={(event) => setLongYield(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="short-funding">Short funding APY (%)</label><input id="short-funding" type="number" min="0" value={shortFunding} onChange={(event) => setShortFunding(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="fee-drag">Fee drag APY (%)</label><input id="fee-drag" type="number" min="0" value={feeDrag} onChange={(event) => setFeeDrag(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="stress">Funding stress magnitude (%)</label><input id="stress" type="number" min="0" value={stress} onChange={(event) => setStress(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="simulations">Monte Carlo paths</label><input id="simulations" type="number" min="100" max="10000" value={simulations} onChange={(event) => setSimulations(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="horizon">Simulation horizon (days)</label><input id="horizon" type="number" min="1" max="365" value={horizon} onChange={(event) => setHorizon(event.target.value)} /></div>
            </div>
          </div>

          <div className={styles.section}>
            <h2>Risk Guard policy</h2>
            <div className={styles.formGrid}>
              <div className={styles.field}><label htmlFor="safety-min">Minimum Safety Buffer</label><input id="safety-min" type="number" min="0" max="100" value={safetyMin} onChange={(event) => setSafetyMin(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="confidence-min">Minimum Decision Confidence</label><input id="confidence-min" type="number" min="0" max="100" value={confidenceMin} onChange={(event) => setConfidenceMin(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="freshness">Maximum data age (minutes)</label><input id="freshness" type="number" min="1" value={freshness} onChange={(event) => setFreshness(event.target.value)} /></div>
              <div className={styles.field}><label htmlFor="deadline">Job deadline</label><input id="deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div>
              <label className={`${styles.checkRow} ${styles.fieldFull}`}><input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} /><span>Require human approval before ADJUST, REDUCE, or CLOSE actions complete the job.</span></label>
            </div>
          </div>
        </section>

        <aside className={styles.panel}>
          <h2>Job terms preview</h2>
          <p className={styles.muted}>The maximum budget and the x402 service price are separate. The budget limits the job. The x402 price pays for the agent response.</p>
          <div className={styles.terms}>
            <div className={styles.term}><span>Agent</span><strong>{agent.name}</strong></div>
            <div className={styles.term}><span>ERC-8004</span><strong>{agent.erc8004AgentId}</strong></div>
            <div className={styles.term}><span>Buyer</span><strong>{address ? formatAddress(address) : "Connect wallet"}</strong></div>
            <div className={styles.term}><span>Provider</span><strong>{formatAddress(agent.registryProof.ownerAddress)}</strong></div>
            <div className={styles.term}><span>ERC-8183 chain</span><strong>BSC · chain 56</strong></div>
            <div className={styles.term}><span>Maximum budget</span><strong>{budget} USDT</strong></div>
            <div className={styles.term}><span>x402 service price</span><strong>{paymentAmount} USDT</strong></div>
            <div className={styles.term}><span>Expected schema</span><strong>{expectedSchemaLabel}</strong></div>
            <div className={styles.term}><span>Mode</span><strong>{liveWriterConfigured ? "ERC-8183 adapter configured" : "Local job simulation boundary"}</strong></div>
          </div>
          {!liveWriterConfigured ? <p className={styles.notice}>The ERC-8183 contract writer is not configured in this deployment. Create Job will store an explicit simulation record. It will not claim an on-chain transaction.</p> : <p className={`${styles.notice} ${styles.error}`}>A contract address is configured, but the audited ERC-8183 writer must be enabled before live creation.</p>}
          {error ? <p className={`${styles.notice} ${styles.error}`} role="alert">{error}</p> : null}
          <div className={styles.buttonRow}>
            {!isConnected ? <button className={styles.secondary} type="button" onClick={connectWallet} disabled={connecting}>{connecting ? "Connecting…" : "Connect wallet"}</button> : null}
            <button className={styles.primary} type="button" onClick={submit} disabled={creating || switching}>{creating ? "Creating job…" : switching ? "Switching to BSC…" : isConnected ? "Create ERC-8183 job →" : "Connect wallet to continue"}</button>
          </div>
          <p className={`${styles.small} ${styles.muted}`}>Wallet connection only identifies the buyer. DeltaZero never receives a private key. A live chain transaction requires a separate wallet confirmation.</p>
        </aside>
      </div>
    </main>
  );
}
