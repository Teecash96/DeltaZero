import type { Agent } from "../agents/types";
import type { RiskCategory, RiskEvidence, RiskStatus } from "../risk/types";

export type AgentDataMode = "verified_fixture" | "live";
export type VerificationStatus = "passed" | "failed" | "pending";

export interface AgentVerification {
  status: VerificationStatus;
  mode: AgentDataMode;
  lastVerifiedAt: string;
  checkedAt: string;
  latencyMs: number;
  schemaVersion: string;
  endpoint: string;
  checks: {
    health: boolean;
    schema: boolean;
    erc8004: boolean;
    categoryCoverage: boolean;
  };
}

export interface RegistryProof {
  registryAddress: string;
  agentId: string;
  ownerAddress: string;
  chainId: 56;
  identitySource: "erc8004_fixture" | "erc8004_onchain";
  metadataUri: string;
}

export interface SourceRecord {
  label: string;
  source: string;
  observedAt: string;
  freshnessMinutes: number;
  trust: "official" | "verified_indexer" | "fixture";
}

export interface CategoryMetricValue {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  description: string;
}

export interface MarketplaceAgent extends Agent {
  dataMode: AgentDataMode;
  verification: AgentVerification;
  registryProof: RegistryProof;
  sources: SourceRecord[];
  evidence: RiskEvidence[];
  categoryMetrics: Record<RiskCategory, CategoryMetricValue[]>;
  riskZoneLabel: string;
  tags: string[];
}

export type AgentSort =
  | "delta_zero_score"
  | "functionality"
  | "data_quality"
  | "lowest_price"
  | "recent_verification";

export interface AgentFilters {
  search: string;
  category: RiskCategory | "all";
  riskStatus: RiskStatus | "all";
  freshness: "all" | "5m" | "30m" | "2h" | "24h";
  maxPrice: "all" | "1" | "5" | "10";
  liveOnly: boolean;
}

export interface VerificationResult {
  status: VerificationStatus;
  checkedAt: string;
  latencyMs: number;
  checks: AgentVerification["checks"];
  message: string;
}
