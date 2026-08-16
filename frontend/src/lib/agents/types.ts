import type { Address } from "viem";

import type { RiskCategory, RiskReport, RiskStatus } from "../risk/types";

export type AgentLifecycleStatus = "ACTIVE" | "PAUSED" | "DELISTED" | "UNVERIFIED";

export type JobStatus = "DRAFT" | "PENDING_PAYMENT" | "RUNNING" | "COMPLETED" | "FAILED";

export type PaymentStatus = "PENDING" | "AUTHORIZED" | "SETTLED" | "FAILED";

export interface AgentRiskSummary {
  deltaZeroScore: number;
  diversityScore?: number;
  safetyBuffer: number;
  decisionConfidence: number;
  dataQuality: number;
  functionality: number;
  status: RiskStatus;
  verifiedAt: string;
}

export interface AgentMetadata {
  image?: string;
  website?: string;
  version?: string;
  capabilities?: string[];
  raw?: Record<string, unknown>;
}

export interface Agent {
  id: string;
  erc8004AgentId: string;
  chainId: 56;
  registryAddress: Address;
  ownerAddress: Address;
  name: string;
  description: string;
  endpoint: string;
  categories: RiskCategory[];
  supportedProtocols: string[];
  status: AgentLifecycleStatus;
  startingPrice: {
    amount: string;
    currency: "USDT" | "USDC" | "BNB";
    interval: "per_call" | "monthly";
  };
  risk: AgentRiskSummary;
  metadata?: AgentMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  agentId: string;
  buyerAddress: Address;
  category: RiskCategory;
  status: JobStatus;
  prompt?: string;
  riskReportId?: string;
  budgetAmount?: string;
  budgetCurrency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  jobId: string;
  network: "bsc";
  amount: string;
  currency: "USDT" | "USDC" | "BNB";
  recipient: Address;
  payer?: Address;
  txHash?: string;
  status: PaymentStatus;
  createdAt: string;
  settledAt?: string;
}

export interface AgentWithReports extends Agent {
  reports: RiskReport[];
}
