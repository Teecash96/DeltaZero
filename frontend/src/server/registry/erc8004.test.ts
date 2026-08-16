import { describe, expect, it } from "vitest";
import type { Address, PublicClient } from "viem";

import { createErc8004RegistryAdapter } from "./erc8004";

const registryAddress = "0x0000000000000000000000000000000000000800" as Address;
const ownerAddress = "0x0000000000000000000000000000000000000001" as Address;

describe("ERC-8004 registry adapter", () => {
  it("reads identity and decodes inline JSON metadata without a signer", async () => {
    const publicClient = {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "ownerOf") return ownerAddress;
        if (functionName === "agentURI") {
          return "data:application/json,%7B%22name%22%3A%22Risk%20Agent%22%7D";
        }
        throw new Error("unexpected function");
      },
    } as unknown as PublicClient;

    const adapter = createErc8004RegistryAdapter({
      registryAddress,
      publicClient,
    });
    const identity = await adapter.getAgent(5739);

    expect(identity).toMatchObject({
      agentId: "5739",
      chainId: 56,
      registryAddress,
      ownerAddress,
      agentURI: "data:application/json,%7B%22name%22%3A%22Risk%20Agent%22%7D",
      metadata: { name: "Risk Agent" },
    });
  });

  it("returns a non-throwing verification result for an unavailable registry read", async () => {
    const publicClient = {
      readContract: async () => {
        throw new Error("RPC unavailable");
      },
    } as unknown as PublicClient;

    const adapter = createErc8004RegistryAdapter({
      registryAddress,
      publicClient,
    });
    const verification = await adapter.verifyAgent("5739");

    expect(verification).toMatchObject({
      agentId: "5739",
      chainId: 56,
      reachable: false,
      metadataLoaded: false,
      reason: "RPC unavailable",
    });
  });
});
