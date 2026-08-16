import type { RiskStatus } from "../risk/types";
import type { AgentFilters, AgentSort, MarketplaceAgent } from "./types";

export function getPriceNumber(agent: MarketplaceAgent): number {
  const value = Number.parseFloat(agent.startingPrice.amount);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function matchesFreshness(agent: MarketplaceAgent, filter: AgentFilters["freshness"]): boolean {
  if (filter === "all") return true;
  const limits = { "5m": 5, "30m": 30, "2h": 120, "24h": 1_440 } as const;
  return agent.verification.status === "passed" && agent.risk.verifiedAt
    ? agent.verification.mode === "live" || agent.sources.some((source) => source.freshnessMinutes <= limits[filter])
    : false;
}

export function filterAgents(agents: MarketplaceAgent[], filters: AgentFilters): MarketplaceAgent[] {
  const query = filters.search.trim().toLowerCase();
  return agents.filter((agent) => {
    const searchable = [agent.name, agent.description, ...agent.supportedProtocols, ...agent.tags].join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (filters.category !== "all" && !agent.categories.includes(filters.category)) return false;
    if (filters.riskStatus !== "all" && agent.risk.status !== filters.riskStatus) return false;
    if (filters.maxPrice !== "all" && getPriceNumber(agent) > Number(filters.maxPrice)) return false;
    if (filters.liveOnly && (agent.status !== "ACTIVE" || agent.verification.status !== "passed")) return false;
    if (!matchesFreshness(agent, filters.freshness)) return false;
    return true;
  });
}

export function sortAgents(agents: MarketplaceAgent[], sort: AgentSort): MarketplaceAgent[] {
  return [...agents].sort((left, right) => {
    switch (sort) {
      case "functionality":
        return right.risk.functionality - left.risk.functionality;
      case "data_quality":
        return right.risk.dataQuality - left.risk.dataQuality;
      case "lowest_price":
        return getPriceNumber(left) - getPriceNumber(right);
      case "recent_verification":
        return Date.parse(right.verification.lastVerifiedAt) - Date.parse(left.verification.lastVerifiedAt);
      case "delta_zero_score":
      default:
        return right.risk.deltaZeroScore - left.risk.deltaZeroScore;
    }
  });
}

export const DEFAULT_FILTERS: AgentFilters = {
  search: "",
  category: "all",
  riskStatus: "all",
  freshness: "all",
  maxPrice: "all",
  liveOnly: true,
};

export function riskStatusLabel(status: RiskStatus): string {
  return status === "PROCEED" ? "Proceed" : status === "WATCH" ? "Watch" : status === "ADJUST" ? "Adjust" : "Avoid";
}
