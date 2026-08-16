# ERC-8004 read-only adapter

`createErc8004RegistryAdapter` reads an agent owner and URI from a configured
BSC ERC-8004 registry address. It supports inline JSON metadata and HTTP(S)
metadata URIs.

The adapter has no signer and cannot write to the registry. The registry
deployment address and RPC transport must be supplied by the caller because
the address and final ABI deployment are network configuration, not constants
to guess in application code.

Example:

```ts
const adapter = createErc8004RegistryAdapter({
  registryAddress: "0x...",
  publicClient,
});

const identity = await adapter.getAgent(5739);
```
