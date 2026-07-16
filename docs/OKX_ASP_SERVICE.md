# DeltaZero OKX ASP Service Reference

## Closed-loop agent workflow

The executable example in `examples/agent-bot` demonstrates:

1. Detect hedge drift in a simulated position.
2. Call the paid DeltaZero Position Auditor.
3. Authorize and replay an x402 request through Onchain OS.
4. Generate an exact rebalance intent.
5. Simulate the proposed adjustment and require approval.
6. Apply the adjustment to the demo ledger and re-audit the position.

The on-chain broadcast stage is deliberately disabled. DeltaZero requires a
supported perpetual-venue adapter before it can represent a short-perpetual
adjustment as an Agentic Wallet transaction. A generic token swap is not treated
as an equivalent hedge operation.

When a successful paid replay includes `PAYMENT-RESPONSE`, the frontend decodes
the returned settlement receipt and displays it beside the analysis. Challenge-
only deployments do not fabricate a receipt.

## Service Name

DeltaZero Wallet Auditor

## Purpose

This document describes the live Wallet Auditor callable capability. DeltaZero identity `#5739` has been registered and submitted for OKX listing review. Registration and review submission are not represented as marketplace approval until OKX accepts the listing.

## Request Schema

```json
{
  "wallet_address": "0x...",
  "networks": ["ethereum", "arbitrum", "hyperliquid"],
  "protocols": ["hyperliquid", "aave", "morpho"],
  "stress_profile": "standard"
}
```

## Response Schema

The service returns a deterministic JSON report with:

- portfolio summary
- risk metrics
- strategy health
- recommendation
- corrective actions
- detected positions
- protocol warnings
- raw structured notes

## Supported Networks

- ethereum
- arbitrum
- hyperliquid

## Supported Protocols

- hyperliquid
- aave
- morpho

## Limitations

- Read-only only.
- No trade execution.
- On-demand Hyperliquid market context uses the public read-only Info API. Positive funding means longs pay shorts; negative funding means shorts pay longs, and the sign is preserved.
- Wallet exposure can be passed to Builder and then Stress Test through short-lived client session storage for a deterministic proposed hedge workflow.
- Funding is variable and the current snapshot does not predict future funding.
- No wallet signing.
- No private key collection.
- No database persistence.
- Coverage is limited to supported public interfaces.

## Security Model

- Public addresses may be processed for analysis.
- No secret-bearing wallet permissions are requested.
- RPC access is read-only where required.
- Partial protocol failures are surfaced instead of hidden.
- Missing data is treated cautiously rather than as zero risk.

## Example Request

```json
{
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
  "networks": ["ethereum", "hyperliquid"],
  "protocols": ["aave", "hyperliquid"],
  "stress_profile": "standard"
}
```

## Example Response

```json
{
  "service": "wallet_portfolio_auditor",
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
  "data_quality": "partial",
  "strategy_health": "warning",
  "recommendation": {
    "action": "REBALANCE",
    "summary": "Hedge drift is outside tolerance. Rebalance the wallet before increasing exposure.",
    "confidence": 74
  }
}
```

## Error Cases

- invalid wallet address
- duplicate network or protocol values
- empty request arrays
- unsupported network and protocol combinations
- RPC unavailable
- protocol API timeout or partial response

## Listing and Operations Notes

Before marketplace approval and wider production use, maintain:

- service registration metadata
- ownership and contact details
- SLA and support scope
- access policy and rate-limit policy
- operational monitoring notes

## SDK Usage Examples

The SDKs are source-distributed repository packages that call the live DeltaZero API. They are installable from a checkout and tested in CI. Public npm and PyPI registry releases are tracked as a separate distribution milestone.

### TypeScript

```ts
import { DeltaZeroClient } from "@deltazero/core";

const client = new DeltaZeroClient({
  baseUrl: "https://deltazero-production.up.railway.app",
});

const report = await client.auditWallet({
  wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  networks: ["ethereum", "hyperliquid"],
  protocols: ["hyperliquid", "aave"],
  stress_profile: "standard",
});
```

### Python

```python
from deltazero import DeltaZeroClient

client = DeltaZeroClient(base_url="https://deltazero-production.up.railway.app")

report = client.audit_wallet({
    "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
    "networks": ["ethereum", "hyperliquid"],
    "protocols": ["hyperliquid", "aave"],
    "stress_profile": "standard",
})
```
