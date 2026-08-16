import type { Address, PublicClient } from "viem";

export const ERC8004_REGISTRY_ABI = [
  {
    name: "agentURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "uri", type: "string" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "uri", type: "string" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
] as const;

export interface Erc8004RegistryConfig {
  /** BSC mainnet is chain 56. Keep the deployment address configurable. */
  registryAddress: Address;
  publicClient: PublicClient;
  fetchImpl?: typeof fetch;
}

export interface AgentIdentity {
  agentId: string;
  chainId: 56;
  registryAddress: Address;
  ownerAddress: Address;
  agentURI: string;
  metadata: Record<string, unknown> | null;
}

export interface Erc8004Verification {
  agentId: string;
  chainId: 56;
  registryAddress: Address;
  ownerAddress: Address;
  reachable: boolean;
  metadataLoaded: boolean;
  reason?: string;
}

export interface Erc8004RegistryAdapter {
  getAgent(agentId: bigint | number | string): Promise<AgentIdentity>;
  verifyAgent(agentId: bigint | number | string): Promise<Erc8004Verification>;
}

function normalizeAgentId(agentId: bigint | number | string): bigint {
  if (typeof agentId === "bigint") return agentId;
  if (typeof agentId === "number") {
    if (!Number.isSafeInteger(agentId) || agentId < 0) throw new Error("Invalid ERC-8004 agent ID");
    return BigInt(agentId);
  }

  if (!/^\d+$/.test(agentId)) throw new Error("Invalid ERC-8004 agent ID");
  return BigInt(agentId);
}

async function readAgentUri(publicClient: PublicClient, registryAddress: Address, agentId: bigint) {
  try {
    return await publicClient.readContract({
      address: registryAddress,
      abi: ERC8004_REGISTRY_ABI,
      functionName: "agentURI",
      args: [agentId],
    });
  } catch {
    return publicClient.readContract({
      address: registryAddress,
      abi: ERC8004_REGISTRY_ABI,
      functionName: "tokenURI",
      args: [agentId],
    });
  }
}

function decodeDataUri(uri: string): Record<string, unknown> | null {
  if (!uri.startsWith("data:")) return null;
  const commaIndex = uri.indexOf(",");
  if (commaIndex < 0) return null;

  const header = uri.slice(5, commaIndex);
  const payload = uri.slice(commaIndex + 1);
  const decoded = header.includes(";base64")
    ? Buffer.from(payload, "base64").toString("utf8")
    : decodeURIComponent(payload);

  try {
    const parsed: unknown = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function loadMetadata(
  uri: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown> | null> {
  const inlineMetadata = decodeDataUri(uri);
  if (inlineMetadata) return inlineMetadata;
  if (!/^https?:\/\//i.test(uri)) return null;

  try {
    const response = await fetchImpl(uri, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const parsed: unknown = await response.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function createErc8004RegistryAdapter(
  config: Erc8004RegistryConfig,
): Erc8004RegistryAdapter {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async getAgent(agentIdInput) {
      const agentId = normalizeAgentId(agentIdInput);
      const [ownerAddress, agentURI] = await Promise.all([
        config.publicClient.readContract({
          address: config.registryAddress,
          abi: ERC8004_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [agentId],
        }),
        readAgentUri(config.publicClient, config.registryAddress, agentId),
      ]);

      return {
        agentId: agentId.toString(),
        chainId: 56,
        registryAddress: config.registryAddress,
        ownerAddress,
        agentURI,
        metadata: await loadMetadata(agentURI, fetchImpl),
      };
    },

    async verifyAgent(agentIdInput) {
      const agentId = normalizeAgentId(agentIdInput);
      try {
        const identity = await this.getAgent(agentId);
        return {
          agentId: identity.agentId,
          chainId: 56,
          registryAddress: identity.registryAddress,
          ownerAddress: identity.ownerAddress,
          reachable: true,
          metadataLoaded: identity.metadata !== null,
        };
      } catch (error) {
        return {
          agentId: agentId.toString(),
          chainId: 56,
          registryAddress: config.registryAddress,
          ownerAddress: "0x0000000000000000000000000000000000000000",
          reachable: false,
          metadataLoaded: false,
          reason: error instanceof Error ? error.message : "Registry read failed",
        };
      }
    },
  };
}
