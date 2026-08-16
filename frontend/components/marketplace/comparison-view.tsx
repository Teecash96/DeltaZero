"use client";

import { useMemo, useState } from "react";

import type { MarketplaceAgent } from "@/src/lib/marketplace/types";
import { CATEGORY_DEFINITIONS } from "@/src/lib/marketplace/categories";
import styles from "./marketplace.module.css";
import { RiskStatusBadge } from "./risk-status-badge";

function winnerIds(agents: MarketplaceAgent[], metric: (agent: MarketplaceAgent) => number): Set<string> {
  if (agents.length === 0) return new Set();
  const best = Math.max(...agents.map(metric));
  return new Set(agents.filter((agent) => metric(agent) === best).map((agent) => agent.id));
}

export function ComparisonView({ agents, initialIds }: { agents: MarketplaceAgent[]; initialIds: string[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds.filter((id) => agents.some((agent) => agent.id === id)).slice(0, 3));
  const selected = useMemo(() => selectedIds.map((id) => agents.find((agent) => agent.id === id)).filter((agent): agent is MarketplaceAgent => Boolean(agent)), [agents, selectedIds]);
  const winners = {
    dzs: winnerIds(selected, (agent) => agent.risk.deltaZeroScore),
    safety: winnerIds(selected, (agent) => agent.risk.safetyBuffer),
    dq: winnerIds(selected, (agent) => agent.risk.dataQuality),
    functionality: winnerIds(selected, (agent) => agent.risk.functionality),
  };

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <>
      <section className={styles.section}><div className={styles.compareToolbar}><p>Select up to three verified agents. Winners are highlighted per metric; this is not a profit ranking.</p><strong className={styles.headerBadge}>{selected.length}/3 selected</strong></div><div className={styles.agentPicker}>{agents.map((agent) => <button type="button" className={styles.picker} aria-pressed={selectedIds.includes(agent.id)} key={agent.id} onClick={() => toggle(agent.id)}>{agent.name}</button>)}</div></section>
      {selected.length === 0 ? <section className={styles.empty}><h2>Select agents to compare</h2><p>Choose two or three verified BSC agents above. DeltaZero will compare their common scores and category evidence.</p></section> : <section className={styles.section}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Metric</th>{selected.map((agent) => <th key={agent.id}>{agent.name}</th>)}</tr></thead><tbody>
        <tr><td>Risk zone</td>{selected.map((agent) => <td key={agent.id}><RiskStatusBadge status={agent.risk.status} /></td>)}</tr>
        <tr><td>DeltaZero Score</td>{selected.map((agent) => <td className={winners.dzs.has(agent.id) ? styles.winner : undefined} key={agent.id}>{agent.risk.deltaZeroScore.toFixed(1)}</td>)}</tr>
        <tr><td>Safety Buffer</td>{selected.map((agent) => <td className={winners.safety.has(agent.id) ? styles.winner : undefined} key={agent.id}>{agent.risk.safetyBuffer.toFixed(1)}</td>)}</tr>
        <tr><td>Decision Confidence</td>{selected.map((agent) => <td key={agent.id}>{agent.risk.decisionConfidence.toFixed(1)}</td>)}</tr>
        <tr><td>Data Quality</td>{selected.map((agent) => <td className={winners.dq.has(agent.id) ? styles.winner : undefined} key={agent.id}>{agent.risk.dataQuality.toFixed(1)}</td>)}</tr>
        <tr><td>Functionality</td>{selected.map((agent) => <td className={winners.functionality.has(agent.id) ? styles.winner : undefined} key={agent.id}>{agent.risk.functionality.toFixed(1)}</td>)}</tr>
        <tr><td>Price</td>{selected.map((agent) => <td key={agent.id}>{agent.startingPrice.amount} {agent.startingPrice.currency} / month</td>)}</tr>
        <tr><td>Protocols</td>{selected.map((agent) => <td key={agent.id}>{agent.supportedProtocols.join(", ")}</td>)}</tr>
      </tbody></table></div>
      {selected.map((agent) => { const category = CATEGORY_DEFINITIONS[agent.categories[0]]; return <div className={styles.section} key={agent.id}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{agent.name} · {category.name}</p><h2>Category metrics</h2></div></div><div className={styles.metricList}>{agent.categoryMetrics[agent.categories[0]].map((metric) => <article className={styles.metricItem} key={metric.key}><div><strong>{metric.label}</strong><b>{metric.value}{metric.unit ? ` ${metric.unit}` : ""}</b></div><p>{metric.description}</p></article>)}</div></div>; })}
      </section>}
    </>
  );
}
