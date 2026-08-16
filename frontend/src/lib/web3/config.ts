import { createConfig, injected } from "wagmi";
import { bsc, xLayer } from "viem/chains";
import { http } from "viem";

/** Wallet configuration for ERC-8183 job terms on BSC and x402 on X Layer. */
export const deltaZeroWagmiConfig = createConfig({
  connectors: [injected({ shimDisconnect: true })],
  chains: [bsc, xLayer],
  transports: {
    [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL),
    [xLayer.id]: http(process.env.NEXT_PUBLIC_X_LAYER_RPC_URL),
  },
});

export const BSC_CHAIN_ID = bsc.id;
export const X_LAYER_CHAIN_ID = xLayer.id;
export const X_LAYER_NETWORK = "eip155:196" as const;
