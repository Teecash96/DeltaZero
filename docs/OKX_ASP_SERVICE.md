# DeltaZero OKX ASP Service Preparation

## Service Name

DeltaZero Wallet Auditor

## Purpose

This document prepares the Wallet Auditor as a callable ASP capability. It is intended to help structure the service for future review and eventual publication in the OKX ecosystem.

This service is not claimed to be listed until it has passed the required review process.

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

## Future Packaging Notes

If this service is ever submitted into an OKX-reviewed ASP catalog, the documentation should be expanded with:

- service registration metadata
- ownership and contact details
- SLA and support scope
- access policy and rate-limit policy
- operational monitoring notes
