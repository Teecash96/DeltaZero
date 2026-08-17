import type { Address } from "viem";

import {
  calculateDataQuality,
  calculateDecisionConfidence,
  calculateFunctionalityScore,
  calculateDeltaZeroScore,
  mapRiskStatus,
} from "../../lib/risk/scoring";
import type {
  DataQualityInput,
  DecisionConfidenceInput,
  FunctionalityScoreInput,
  RiskCategory,
  RiskEvidence,
  RiskStatus,
} from "../../lib/risk/types";
import type { CategoryMetricValue, MarketplaceAgent, MarketplaceDiscovery, MarketplaceExclusion, AgentVerification } from "../../lib/marketplace/types";
import { MARKETPLACE_AGENTS } from "../../lib/marketplace/fixtures";

/**
 * Server-side discovery for BSC ERC-8004 agents.
 *
 * This module deliberately does not use the old fixture registry. An agent is
 * listed only when 8004scan has a BSC identity, a machine endpoint, x402
 * support, and a successful live schema check at the time of discovery.
 */

export const BSC_CHAIN_ID = 56 as const;
export const ERC8004_BSC_REGISTRY = "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432" as Address;
export const EIGHTH_HUNDRED_FOUR_SCAN = "https://8004scan.io/api/v1";

const REQUEST_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 60_000;
const VERIFICATION_CACHE_TTL_MS = 30_000;
const USER_AGENT = "DeltaZero-BSC-Marketplace/1.0";

const CANDIDATE_IDS = [
  266933, // BNB Lending Guardian
  45381,  // Aave powered by HeyAnon
  43129,  // Venus powered by HeyAnon
  45422,  // Beefy powered by HeyAnon
  45650,  // V3 Pools powered by HeyAnon
  85400,  // Aster powered by HeyAnon
  265375, // BNB LP Range Rebalancer
  259574, // RangeKeeper
  259573, // HealthGuard
  265876, // BNB Yield Optimizer
  267697, // GridMaster Ops, intentionally excluded when no endpoint is present
] as const;

type JsonObject = Record<string, unknown>;

export interface ServiceDescriptor {
  kind: "mcp" | "a2a";
  endpoint: string;
}

export interface ServiceCheck {
  ok: boolean;
  kind?: "mcp" | "a2a";
  endpoint: string;
  latencyMs: number;
  schemaVersion: string;
  toolCount: number;
  toolNames?: string[];
  message: string;
}

interface ScanAgentDetail extends JsonObject {
  token_id?: number | string;
  agent_id?: number | string;
  name?: string;
  description?: string;
  image?: string;
  image_url?: string;
  website?: string;
  owner_address?: string;
  owner?: string;
  active?: boolean;
  is_active?: boolean;
  chain_id?: number | string;
  categories?: unknown;
  category?: string;
  services?: unknown;
  supported_protocols?: unknown;
  x402_supported?: boolean;
  created_at?: string;
  updated_at?: string;
  endpoint_last_checked_at?: string;
  metadata_uri?: string;
  metadata?: unknown;
  raw_metadata?: unknown;
}

let discoveryCache: { expiresAt: number; value: MarketplaceDiscovery } | null = null;
const verificationCache = new Map<string, { expiresAt: number; checkedAt: string; check: ServiceCheck }>();

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => text(item) ? [text(item)!] : []);
  if (typeof value === "string") return value.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function nowIso(): string {
  return new Date().toISOString();
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  return !value.includes("{agentId}") && !value.includes("<agentId>");
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function boundedAgeMinutes(checkedAt: string): number {
  const parsed = Date.parse(checkedAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round((Date.now() - parsed) / 60_000));
}

function shortAddress(value: unknown): Address {
  const candidate = text(value);
  return /^0x[a-fA-F0-9]{40}$/.test(candidate ?? "")
    ? candidate as Address
    : "0x0000000000000000000000000000000000000000";
}

function unwrapDetail(payload: unknown): ScanAgentDetail | null {
  if (!isObject(payload)) return null;
  const nested = payload.data;
  if (isObject(nested)) return nested as ScanAgentDetail;
  return payload as ScanAgentDetail;
}

function extractTokenId(detail: ScanAgentDetail, fallback: number): string {
  return String(detail.token_id ?? detail.agent_id ?? fallback);
}

function extractService(detail: ScanAgentDetail): ServiceDescriptor | null {
  const services = detail.services;
  if (isObject(services)) {
    const mcp = services.mcp;
    const a2a = services.a2a;
    const mcpEndpoint = isObject(mcp) ? mcp.endpoint : mcp;
    const a2aEndpoint = isObject(a2a) ? a2a.endpoint : a2a;
    if (validEndpoint(mcpEndpoint)) return { kind: "mcp", endpoint: mcpEndpoint };
    if (validEndpoint(a2aEndpoint)) return { kind: "a2a", endpoint: a2aEndpoint };
  }

  const directMcp = detail.mcp_endpoint ?? detail.mcpEndpoint;
  const directA2a = detail.a2a_endpoint ?? detail.a2aEndpoint;
  if (validEndpoint(directMcp)) return { kind: "mcp", endpoint: directMcp };
  if (validEndpoint(directA2a)) return { kind: "a2a", endpoint: directA2a };
  return null;
}

function parseRpcPayload(raw: string): JsonObject | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isObject(parsed) ? parsed : null;
  } catch {
    for (const line of trimmed.split(/\r?\n/)) {
      const candidate = line.trim().startsWith("data:") ? line.trim().slice(5).trim() : line.trim();
      if (!candidate || candidate === "[DONE]") continue;
      try {
        const parsed: unknown = JSON.parse(candidate);
        if (isObject(parsed)) return parsed;
      } catch {
        // SSE may contain comments or multiple non JSON lines.
      }
    }
  }
  return null;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json, text/event-stream",
        "user-agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDetail(tokenId: number): Promise<ScanAgentDetail | null> {
  try {
    const response = await fetchWithTimeout(`${EIGHTH_HUNDRED_FOUR_SCAN}/agents/${BSC_CHAIN_ID}/${tokenId}`);
    if (!response.ok) return null;
    return unwrapDetail(await response.json());
  } catch {
    return null;
  }
}

async function verifyMcp(endpoint: string, startedAt: number): Promise<ServiceCheck> {
  const rpc = async (method: string, id: number, sessionId?: string) => fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: method === "initialize"
        ? { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "deltazero-verifier", version: "1.0" } }
        : {},
    }),
  });

  try {
    const initialized = await rpc("initialize", 1);
    const rawInitialize = await initialized.text();
    if (!initialized.ok) return { ok: false, kind: "mcp", endpoint, latencyMs: Date.now() - startedAt, schemaVersion: "unknown", toolCount: 0, message: `MCP initialize returned HTTP ${initialized.status}` };
    const sessionId = initialized.headers.get("mcp-session-id") ?? undefined;
    const initializePayload = parseRpcPayload(rawInitialize);
    const schemaVersion = text(isObject(initializePayload?.result) ? (initializePayload.result as JsonObject).protocolVersion : undefined) ?? "json-rpc";

    const listed = await rpc("tools/list", 2, sessionId);
    const rawTools = await listed.text();
    if (!listed.ok) return { ok: false, kind: "mcp", endpoint, latencyMs: Date.now() - startedAt, schemaVersion, toolCount: 0, message: `MCP tools/list returned HTTP ${listed.status}` };
    const toolsPayload = parseRpcPayload(rawTools);
    const result = isObject(toolsPayload?.result) ? toolsPayload.result as JsonObject : null;
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    const toolNames = tools.flatMap((tool) => isObject(tool) && text(tool.name) ? [text(tool.name)!] : typeof tool === "string" ? [tool] : []);
    if (!toolsPayload || !result || tools.length === 0) return { ok: false, kind: "mcp", endpoint, latencyMs: Date.now() - startedAt, schemaVersion, toolCount: 0, toolNames: [], message: "MCP endpoint returned no tools" };
    return { ok: true, kind: "mcp", endpoint, latencyMs: Date.now() - startedAt, schemaVersion, toolCount: tools.length, toolNames, message: `MCP initialize and tools/list passed with ${tools.length} tools` };
  } catch (error) {
    return { ok: false, kind: "mcp", endpoint, latencyMs: Date.now() - startedAt, schemaVersion: "unknown", toolCount: 0, message: error instanceof Error ? error.message : "MCP verification failed" };
  }
}

async function verifyA2a(endpoint: string, startedAt: number): Promise<ServiceCheck> {
  try {
    const response = await fetchWithTimeout(endpoint, { method: "GET" });
    const raw = await response.text();
    const payload = parseRpcPayload(raw);
    const hasAgentCard = Boolean(payload && (text(payload.name) || text(payload.description) || Array.isArray(payload.skills)));
    if (!response.ok || !hasAgentCard) return { ok: false, kind: "a2a", endpoint, latencyMs: Date.now() - startedAt, schemaVersion: "unknown", toolCount: 0, message: `A2A card check failed (HTTP ${response.status})` };
    const skills = Array.isArray(payload?.skills) ? payload.skills.length : 0;
    const skillNames = Array.isArray(payload?.skills) ? payload.skills.flatMap((skill) => isObject(skill) && text(skill.name) ? [text(skill.name)!] : typeof skill === "string" ? [skill] : []) : [];
    return { ok: true, kind: "a2a", endpoint, latencyMs: Date.now() - startedAt, schemaVersion: text(payload?.version) ?? "a2a-card", toolCount: skills, toolNames: skillNames, message: "A2A agent card check passed" };
  } catch (error) {
    return { ok: false, kind: "a2a", endpoint, latencyMs: Date.now() - startedAt, schemaVersion: "unknown", toolCount: 0, message: error instanceof Error ? error.message : "A2A verification failed" };
  }
}

export async function verifyRegisteredService(service: ServiceDescriptor): Promise<ServiceCheck> {
  const startedAt = Date.now();
  return service.kind === "mcp" ? verifyMcp(service.endpoint, startedAt) : verifyA2a(service.endpoint, startedAt);
}

/**
 * Short lived cache for repeated detail page checks.
 * Discovery still performs fresh checks when its snapshot expires. This cache
 * only prevents repeated clicks from hammering a third party endpoint and
 * never turns a failed check into a verified agent.
 */
export async function getCachedRegisteredServiceVerification(
  service: ServiceDescriptor,
  options: { force?: boolean } = {},
): Promise<{ check: ServiceCheck; checkedAt: string; cacheHit: boolean }> {
  const key = `${service.kind}:${service.endpoint}`;
  const cached = verificationCache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return { check: cached.check, checkedAt: cached.checkedAt, cacheHit: true };
  }

  const check = await verifyRegisteredService(service);
  const checkedAt = nowIso();
  verificationCache.set(key, {
    check,
    checkedAt,
    expiresAt: Date.now() + VERIFICATION_CACHE_TTL_MS,
  });
  return { check, checkedAt, cacheHit: false };
}

export function clearMarketplaceVerificationCacheForTest(): void {
  verificationCache.clear();
}

function inferCategory(detail: ScanAgentDetail, service: ServiceDescriptor, toolNames: string[]): { category: RiskCategory; basis: string } | null {
  const raw = [detail.category, ...toList(detail.categories), text(detail.name), text(detail.description), ...toolNames].filter(Boolean).join(" ").toLowerCase();
  if (/yield|vault|apr|apy|optimizer|liquidity allocation/.test(raw) && !/health factor|liquidat|collateral ratio|borrow limit/.test(raw)) {
    return { category: "yield_optimisation", basis: "yield, vault, APR, or liquidity allocation capability" };
  }
  if (/health|liquidat|collateral|borrow|lending|loan|aave|venus/.test(raw)) return { category: "health_factor", basis: "health, collateral, lending, or liquidation capability" };
  if (/yield|vault|apr|apy|beefy|optimizer|liquidity allocation/.test(raw)) return { category: "yield_optimisation", basis: "yield, vault, APR, or liquidity allocation capability" };
  if (/rebalance|range|lp position|liquidity position|v3 pool/.test(raw)) return { category: "rebalancing", basis: "range, LP, or position rebalancing capability" };
  if (/grid|order|trading|perp|aster/.test(raw) && service.kind === "mcp") return { category: "grid_trading", basis: "order and position management capability; confirm native grid support before hire" };
  return null;
}

function protocolNames(detail: ScanAgentDetail): string[] {
  const declared = toList(detail.supported_protocols).filter((protocol) => !/^(mcp|a2a|web|rest)$/i.test(protocol));
  const raw = [text(detail.name), text(detail.description), ...toList(detail.categories)].filter(Boolean).join(" ").toLowerCase();
  const known = [
    ["aave", "Aave"],
    ["venus", "Venus"],
    ["beefy", "Beefy"],
    ["pancakeswap|pancake swap", "PancakeSwap"],
    ["morpho", "Morpho"],
    ["hylo", "Hylo"],
    ["aster", "Aster"],
  ] as const;
  return [...new Set([...declared, ...known.filter(([pattern]) => new RegExp(pattern).test(raw)).map(([, label]) => label)])];
}

function categoryMetrics(category: RiskCategory, detail: ScanAgentDetail, service: ServiceDescriptor, check: ServiceCheck, basis: string): CategoryMetricValue[] {
  const protocols = protocolNames(detail);
  const toolNames = check.toolNames ?? [];
  const advertised = toolNames.join(" ").toLowerCase();
  const categoryMetric = category === "health_factor"
    ? { key: "healthFactorCoverage", label: "Health factor coverage", value: /health|liquidat|collateral|borrow|loan/.test(advertised) ? "Advertised and schema-checked" : "Not advertised", description: "The live service schema advertises lending health or liquidation capabilities." }
    : category === "yield_optimisation"
      ? { key: "yieldCoverage", label: "Yield optimisation coverage", value: /yield|vault|apr|apy|deposit|withdraw|portfolio/.test(advertised) ? "Advertised and schema-checked" : "Not advertised", description: "The live service schema advertises vault, yield, or allocation capabilities." }
      : category === "rebalancing"
        ? { key: "rangeCoverage", label: "Rebalancing coverage", value: /range|position|liquidity|rebalance|tick/.test(advertised) ? "Advertised and schema-checked" : "Not advertised", description: "The live service schema advertises position, range, or liquidity management capabilities." }
        : { key: "gridCoverage", label: "Grid trading coverage", value: /grid|order|market|position|funding|trade/.test(advertised) ? "Advertised and schema-checked" : "Not advertised", description: "The live service schema advertises order or position management capabilities. Native grid support must still be confirmed before hire." };
  return [
    categoryMetric,
    { key: "serviceKind", label: "Service transport", value: service.kind.toUpperCase(), description: "Machine-readable transport verified against the registered endpoint." },
    { key: "toolCount", label: "Advertised capabilities", value: check.toolCount, description: "Tools or skills returned by the live schema check." },
    { key: "x402", label: "x402 support", value: detail.x402_supported === true ? "Declared" : "Not declared", description: "Payment support is read from the ERC-8004 listing and must be rechecked before hire." },
    { key: "protocols", label: "Protocols", value: protocols.length > 0 ? protocols.join(", ") : "Not specified", description: "Protocols declared by the registered agent metadata." },
    { key: "categoryBasis", label: "Category evidence", value: basis, description: "Deterministic category mapping from registered metadata and verified capability names." },
  ];
}

function makeSources(detail: ScanAgentDetail, service: ServiceDescriptor, checkedAt: string): { sources: MarketplaceAgent["sources"]; evidence: RiskEvidence[] } {
  const observedAt = checkedAt;
  const scanSource = `${EIGHTH_HUNDRED_FOUR_SCAN}/agents/${BSC_CHAIN_ID}/${extractTokenId(detail, 0)}`;
  const sources = [
    { label: "8004scan BSC registry", source: scanSource, observedAt, freshnessMinutes: 0, trust: "verified_indexer" as const },
    { label: `${service.kind.toUpperCase()} endpoint`, source: service.endpoint, observedAt, freshnessMinutes: 0, trust: "endpoint" as const },
  ];
  const evidence = sources.map((source) => ({ metric: `registry.${source.label.toLowerCase().replaceAll(" ", "_")}`, value: "reachable", source: source.source, observedAt }));
  return { sources, evidence };
}

function makeVerification(service: ServiceDescriptor, check: ServiceCheck, checkedAt: string, paymentDeclared: boolean): AgentVerification {
  return {
    status: check.ok ? "passed" : "failed",
    mode: "live",
    lastVerifiedAt: checkedAt,
    checkedAt,
    latencyMs: check.latencyMs,
    schemaVersion: check.schemaVersion,
    endpoint: service.endpoint,
    serviceKind: service.kind,
    toolCount: check.toolCount,
    verificationMessage: check.message,
    checks: {
      health: check.ok,
      schema: check.ok,
      erc8004: true,
      categoryCoverage: check.ok,
      serviceEndpoint: check.ok,
      paymentFlow: paymentDeclared,
    },
  };
}

function makeAgent(detail: ScanAgentDetail, tokenIdFallback: number, service: ServiceDescriptor, check: ServiceCheck, checkedAt: string, category: RiskCategory, basis: string, toolNames: string[]): MarketplaceAgent {
  const tokenId = extractTokenId(detail, tokenIdFallback);
  const protocols = protocolNames(detail);
  const name = text(detail.name) ?? `BSC ERC-8004 Agent ${tokenId}`;
  const endpointScore = check.ok ? 100 : 0;
  const schemaScore = check.ok ? 100 : 0;
  const paymentScore = detail.x402_supported === true ? 100 : 0;
  const registryScore = 100;
  const safetyBuffer = clamp(0.4 * endpointScore + 0.25 * schemaScore + 0.2 * paymentScore + 0.15 * registryScore);
  const sources = makeSources(detail, service, checkedAt);
  const sourceTrust = "verified_indexer_or_reputable_rpc" as const;
  const dataQualityInput: DataQualityInput = {
    category: true,
    lastSuccessfulExecution: check.ok,
    supportedProtocols: protocols.length > 0,
    categoryCoreMetric: check.toolCount > 0,
    ageMinutes: boundedAgeMinutes(checkedAt),
    sourceTrust,
    matchingReplays: check.ok ? 1 : 0,
    totalReplays: 1,
  };
  const dataQuality = calculateDataQuality(dataQualityInput).score;
  const decisionInput: DecisionConfidenceInput = {
    inputCompleteness: clamp((protocols.length > 0 ? 25 : 0) + (name ? 25 : 0) + (text(detail.description) ? 25 : 0) + (check.toolCount > 0 ? 25 : 0)),
    dataQuality,
    deterministicReplayScore: check.ok ? 100 : 0,
    endpointReliability: endpointScore,
  };
  const decisionConfidence = calculateDecisionConfidence(decisionInput).score;
  const functionality = calculateFunctionalityScore({ endpointAvailability: endpointScore, latencyP95Seconds: Math.max(0.001, check.latencyMs / 1000), schemaValidity: schemaScore, paymentFlowValidity: paymentScore } satisfies FunctionalityScoreInput).score;
  const scores = calculateDeltaZeroScore({ categorySafetyBuffer: safetyBuffer, decisionConfidence, dataQuality, functionality });
  const status: RiskStatus = mapRiskStatus({ dzs: scores.score, safetyBuffer, decisionConfidence, dataQuality, criticalDataMissing: false, staleData: false, invalidData: !check.ok });
  const verification = makeVerification(service, check, checkedAt, detail.x402_supported === true);
  const metrics = categoryMetrics(category, detail, service, check, basis);
  const data = detail.data;
  const metadata = isObject(data) ? data : isObject(detail.metadata) ? detail.metadata as JsonObject : isObject(detail.raw_metadata) ? detail.raw_metadata as JsonObject : {};
  const description = text(detail.description) ?? "A live BSC ERC-8004 service with a registered machine endpoint.";
  const riskEvidence = [...sources.evidence, { metric: `${category}.verification`, value: check.message, source: service.endpoint, observedAt: checkedAt }];
  const risk = {
    deltaZeroScore: scores.score,
    diversityScore: Math.min(100, 55 + protocols.length * 10),
    safetyBuffer,
    decisionConfidence,
    dataQuality,
    functionality,
    status,
    verifiedAt: checkedAt,
  };

  return {
    id: `bsc-erc8004-${tokenId}`,
    erc8004AgentId: tokenId,
    chainId: BSC_CHAIN_ID,
    registryAddress: ERC8004_BSC_REGISTRY,
    ownerAddress: shortAddress(detail.owner_address ?? detail.owner),
    name,
    description,
    endpoint: service.endpoint,
    categories: [category],
    supportedProtocols: protocols,
    status: detail.active === false || detail.is_active === false ? "PAUSED" : "ACTIVE",
    startingPrice: { amount: "Not listed", currency: "USDT", interval: "per_call" },
    risk,
    metadata: { image: text(detail.image ?? detail.image_url), website: text(detail.website), version: check.schemaVersion, capabilities: (check.toolNames ?? toolNames).length > 0 ? (check.toolNames ?? toolNames) : undefined, raw: metadata },
    createdAt: text(detail.created_at) ?? checkedAt,
    updatedAt: text(detail.updated_at) ?? checkedAt,
    dataMode: "live",
    verification,
    registryProof: {
      registryAddress: ERC8004_BSC_REGISTRY,
      agentId: tokenId,
      ownerAddress: shortAddress(detail.owner_address ?? detail.owner),
      chainId: BSC_CHAIN_ID,
      identitySource: "erc8004_indexer",
      metadataUri: text(detail.metadata_uri) ?? `${EIGHTH_HUNDRED_FOUR_SCAN}/agents/${BSC_CHAIN_ID}/${tokenId}`,
    },
    sources: sources.sources,
    evidence: riskEvidence,
    categoryMetrics: {
      health_factor: category === "health_factor" ? metrics : [],
      yield_optimisation: category === "yield_optimisation" ? metrics : [],
      rebalancing: category === "rebalancing" ? metrics : [],
      grid_trading: category === "grid_trading" ? metrics : [],
    },
    riskZoneLabel: "Service verification zone, not a user position score",
    riskBasis: "service_verification",
    riskDisclaimer: "This score describes endpoint, schema, payment, and registry evidence. It is not a health score for a user's position and is not a profit forecast.",
    tags: [...new Set([category.replaceAll("_", " "), service.kind.toUpperCase(), ...protocols, ...toolNames.slice(0, 3)])],
  };
}

export function inferRiskCategoryForTest(detail: ScanAgentDetail, service: ServiceDescriptor, toolNames: string[] = []) {
  return inferCategory(detail, service, toolNames);
}

export function parseRpcPayloadForTest(raw: string): JsonObject | null {
  return parseRpcPayload(raw);
}

async function discover(): Promise<MarketplaceDiscovery> {
  const checkedAt = nowIso();
  // Playwright uses an explicit test-only process flag so browser tests do not
  // depend on third party registry availability. This branch is never enabled
  // by the production deployment and is labelled as fixture data in the UI.
  if (process.env.DELTAZERO_E2E === "true") {
    const agents = MARKETPLACE_AGENTS.map((agent) => ({
      ...agent,
      updatedAt: checkedAt,
      verification: { ...agent.verification, checkedAt, lastVerifiedAt: checkedAt },
      dataMode: "verified_fixture" as const,
    }));
    return {
      agents,
      exclusions: [],
      categoryCounts: {
        health_factor: agents.filter((agent) => agent.categories.includes("health_factor")).length,
        yield_optimisation: agents.filter((agent) => agent.categories.includes("yield_optimisation")).length,
        rebalancing: agents.filter((agent) => agent.categories.includes("rebalancing")).length,
        grid_trading: agents.filter((agent) => agent.categories.includes("grid_trading")).length,
      },
      checkedAt,
      source: "Playwright-only verified fixture data",
    };
  }
  const details = await Promise.all(CANDIDATE_IDS.map(async (id) => ({ id, detail: await fetchDetail(id) })));

  type DiscoveryResult = { agent?: MarketplaceAgent; exclusion?: MarketplaceExclusion };
  const results = await Promise.all(details.map(async ({ id, detail }): Promise<DiscoveryResult> => {
    if (!detail) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name: `ERC-8004 agent ${id}`, reason: "8004scan detail could not be fetched during this verification window.", checkedAt } };
    }
    const name = text(detail.name) ?? `ERC-8004 agent ${id}`;
    const service = extractService(detail);
    const categoryHint = inferCategory(detail, service ?? { kind: "a2a", endpoint: "" }, []);
    const category = categoryHint?.category;
    if (detail.active === false || detail.is_active === false) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name, category, reason: "Registry identity is not active.", checkedAt } };
    }
    if (number(detail.chain_id) !== undefined && number(detail.chain_id) !== BSC_CHAIN_ID) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name, category, reason: "Agent is not registered on BSC chain 56.", checkedAt } };
    }
    if (detail.x402_supported !== true) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name, category, reason: "x402 support is not declared in the registry metadata.", checkedAt } };
    }
    if (!service) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name, category, reason: "No machine-readable MCP or A2A service endpoint is registered.", checkedAt } };
    }
    const check = await verifyRegisteredService(service);
    if (!check.ok) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name, category, endpoint: service.endpoint, reason: check.message, checkedAt } };
    }
    const categoryResult = inferCategory(detail, service, []);
    if (!categoryResult) {
      return { exclusion: { id: `bsc-erc8004-${id}`, name, endpoint: service.endpoint, reason: "The registered capabilities do not map cleanly to one of the four BNB categories.", checkedAt } };
    }
    const agent = makeAgent(detail, id, service, check, checkedAt, categoryResult.category, categoryResult.basis, check.toolNames ?? []);
    if (agent.risk.status === "AVOID" || agent.verification.status !== "passed") {
      return { exclusion: { id: agent.id, name: agent.name, category: categoryResult.category, endpoint: service.endpoint, reason: `Excluded because live verification scored ${agent.risk.status}.`, checkedAt } };
    }
    return { agent };
  }));

  const agents = results.flatMap(({ agent }) => agent ? [agent] : []);
  const exclusions = results.flatMap(({ exclusion }) => exclusion ? [exclusion] : []);

  const categoryCounts: MarketplaceDiscovery["categoryCounts"] = {
    health_factor: agents.filter((agent) => agent.categories.includes("health_factor")).length,
    yield_optimisation: agents.filter((agent) => agent.categories.includes("yield_optimisation")).length,
    rebalancing: agents.filter((agent) => agent.categories.includes("rebalancing")).length,
    grid_trading: agents.filter((agent) => agent.categories.includes("grid_trading")).length,
  };

  return { agents, exclusions, categoryCounts, checkedAt, source: `${EIGHTH_HUNDRED_FOUR_SCAN} + live endpoint checks` };
}

export async function getLiveMarketplaceDiscovery(options: { force?: boolean } = {}): Promise<MarketplaceDiscovery> {
  if (!options.force && discoveryCache && discoveryCache.expiresAt > Date.now()) return discoveryCache.value;
  const value = await discover();
  discoveryCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getLiveMarketplaceAgents(): Promise<MarketplaceAgent[]> {
  return (await getLiveMarketplaceDiscovery()).agents;
}

export async function getLiveMarketplaceAgent(agentId: string): Promise<MarketplaceAgent | undefined> {
  return (await getLiveMarketplaceDiscovery()).agents.find((agent) => agent.id === agentId);
}
