export type JobStatus =
  | "DRAFT"
  | "CREATING"
  | "AWAITING_PAYMENT"
  | "PAYMENT_PENDING"
  | "PAID"
  | "RUNNING"
  | "VERIFYING"
  | "MONITORING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "DISPUTED";

export type RiskGuardState = "ALLOW" | "WATCH" | "PAUSE" | "ESCALATE" | "CANCEL" | "COMPLETE";
export type PaymentState = "PENDING" | "SETTLED" | "FAILED" | "SIMULATED";

export interface RiskPolicy {
  safety_buffer_min: number;
  decision_confidence_min: number;
  data_freshness_max_minutes: number;
  require_human_approval_for: string[];
  endpoint_timeout_seconds: number;
}

export interface ERC8183Terms {
  chain_id: number;
  contract_address: string | null;
  job_id: string;
  agent_id: string;
  buyer: string;
  provider: string;
  budget_amount: string;
  budget_currency: string;
  deadline: string;
  risk_policy_hash: string;
  expected_schema_hash: string;
  mode: "erc8183_live" | "simulation";
  transaction_hash: string | null;
}

export interface PaymentReceipt {
  status: PaymentState;
  network: string;
  amount: string;
  currency: string;
  payer: string | null;
  recipient: string | null;
  transaction_hash: string | null;
  resource: string | null;
  payment_response_header?: string | null;
  settlement_source?: "x402" | "simulation" | "manual";
  verified_at: string;
  replay_key: string | null;
}

export interface RiskGuardSnapshot {
  state: RiskGuardState;
  safety_buffer: number | null;
  decision_confidence: number | null;
  data_age_minutes: number | null;
  endpoint_available: boolean;
  deadline_ok: boolean;
  action: string | null;
  reasons: string[];
  checked_at: string;
}

export interface ProofEnvelope {
  schema_id: string;
  schema_version: string;
  job_id: string;
  agent_id: string;
  expected_schema_hash: string;
  request_hash: string;
  result_hash: string;
  identity_verified: boolean;
  job_id_verified: boolean;
  timestamps_verified: boolean;
  payment_verified: boolean;
  schema_validated?: boolean;
  deterministic: boolean;
  created_at: string;
}

export interface JobTimelineEvent {
  event: string;
  status: JobStatus;
  message: string;
  at: string;
}

export interface JobRecord {
  id: string;
  status: JobStatus;
  agent_id: string;
  agent_erc8004_id: string;
  agent_name: string;
  provider_address: string;
  buyer_address: string;
  agent_endpoint: string | null;
  category: string;
  objective: string;
  input_data: Record<string, unknown>;
  budget_amount: string;
  budget_currency: string;
  payment_amount: string;
  deadline: string;
  risk_policy: RiskPolicy;
  risk_policy_hash: string;
  expected_schema_hash: string;
  erc8183: ERC8183Terms;
  execution_mode: "erc8183_live" | "simulation";
  payment: PaymentReceipt | null;
  result: Record<string, unknown> | null;
  proof: ProofEnvelope | null;
  risk_guard: RiskGuardSnapshot | null;
  timeline: JobTimelineEvent[];
  created_at: string;
  updated_at: string;
}

export interface JobCreatePayload {
  agent_id: string;
  agent_erc8004_id: string;
  agent_name: string;
  provider_address: string;
  buyer_address: string;
  agent_endpoint: string;
  agent_verified: boolean;
  agent_status: "ACTIVE";
  category: string;
  objective: string;
  input_data: Record<string, unknown>;
  budget_amount: string;
  budget_currency: "USDT";
  payment_amount: string;
  deadline: string;
  risk_policy: RiskPolicy;
  expected_schema_hash: string;
  allow_simulation: boolean;
}

export interface PaymentChallenge {
  job_id: string;
  x402_required: boolean;
  configured: boolean;
  network?: string;
  amount?: string;
  currency?: string;
  recipient?: string;
  resource?: string;
  schemes?: string[];
  message: string;
}

export interface PaymentExecutionResult {
  job: JobRecord;
  paymentResponseHeader?: string;
}
