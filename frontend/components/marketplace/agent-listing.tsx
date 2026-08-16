"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CATEGORY_DEFINITIONS, CATEGORY_ORDER } from "@/src/lib/marketplace/categories";
import { DEFAULT_FILTERS, filterAgents, sortAgents } from "@/src/lib/marketplace/filters";
import type { AgentFilters, AgentSort, MarketplaceAgent } from "@/src/lib/marketplace/types";
import styles from "./marketplace.module.css";
import { AgentCard } from "./agent-card";

export function AgentListing({ agents }: { agents: MarketplaceAgent[] }) {
  const [filters, setFilters] = useState<AgentFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<AgentSort>("delta_zero_score");
  const [selected, setSelected] = useState<string[]>([]);
  const visibleAgents = useMemo(() => sortAgents(filterAgents(agents, filters), sort), [agents, filters, sort]);

  function updateFilter<Key extends keyof AgentFilters>(key: Key, value: AgentFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleCompare(agentId: string) {
    setSelected((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : current.length >= 3 ? current : [...current, agentId]);
  }

  return (
    <>
      <section className={styles.toolbar} aria-label="Agent filters">
        <div className={styles.field}>
          <label htmlFor="agent-search">Search agents</label>
          <input id="agent-search" className={styles.input} type="search" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Name, protocol, capability" />
        </div>
        <div className={styles.field}><label htmlFor="agent-category">Category</label><select id="agent-category" className={styles.select} value={filters.category} onChange={(event) => updateFilter("category", event.target.value as AgentFilters["category"])}><option value="all">All categories</option>{CATEGORY_ORDER.map((category) => <option value={category} key={category}>{CATEGORY_DEFINITIONS[category].name}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="agent-status">Risk zone</label><select id="agent-status" className={styles.select} value={filters.riskStatus} onChange={(event) => updateFilter("riskStatus", event.target.value as AgentFilters["riskStatus"])}><option value="all">All zones</option><option value="PROCEED">Proceed</option><option value="WATCH">Watch</option><option value="ADJUST">Adjust</option><option value="AVOID">Avoid</option></select></div>
        <div className={styles.field}><label htmlFor="agent-freshness">Freshness</label><select id="agent-freshness" className={styles.select} value={filters.freshness} onChange={(event) => updateFilter("freshness", event.target.value as AgentFilters["freshness"])}><option value="all">Any age</option><option value="5m">Under 5 min</option><option value="30m">Under 30 min</option><option value="2h">Under 2 hours</option><option value="24h">Under 24 hours</option></select></div>
        <div className={styles.field}><label htmlFor="agent-price">Price</label><select id="agent-price" className={styles.select} value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value as AgentFilters["maxPrice"])}><option value="all">Any price</option><option value="1">Up to 1 USDT</option><option value="5">Up to 5 USDT</option><option value="10">Up to 10 USDT</option></select></div>
        <div className={styles.field}><label htmlFor="agent-sort">Sort by</label><select id="agent-sort" className={styles.select} value={sort} onChange={(event) => setSort(event.target.value as AgentSort)}><option value="delta_zero_score">DeltaZero Score</option><option value="functionality">Functionality</option><option value="data_quality">Data Quality</option><option value="lowest_price">Lowest price</option><option value="recent_verification">Recent verification</option></select></div>
        <label className={styles.liveToggle}><input type="checkbox" checked={filters.liveOnly} onChange={(event) => updateFilter("liveOnly", event.target.checked)} /> Live verified only</label>
      </section>
      <div className={styles.resultsBar} aria-live="polite"><span><strong>{visibleAgents.length}</strong> verified agents match these filters.</span>{selected.length > 0 ? <Link href={`/compare?ids=${selected.join(",")}`} className={styles.linkButton}>Compare {selected.length}/3 →</Link> : <span>Click Compare to build a side-by-side view.</span>}</div>
      {visibleAgents.length > 0 ? <section className={styles.grid} aria-label="Verified agents">{visibleAgents.map((agent) => <AgentCard key={agent.id} agent={agent} selected={selected.includes(agent.id)} onCompare={toggleCompare} />)}</section> : <section className={styles.empty}><h2>No verified agents match</h2><p>Change the category, risk zone, price, or freshness filter. DeltaZero hides unverified agents instead of presenting incomplete risk evidence.</p></section>}
    </>
  );
}
