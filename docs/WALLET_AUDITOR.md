# DeltaZero Wallet Auditor

## Service Name

Wallet Auditor

## Purpose

The Wallet Auditor is a read-only portfolio analysis service. It inspects supported public wallet and protocol data, normalizes the positions, and returns a deterministic risk report.

It does not request:

- seed phrases
- private keys
- wallet signatures
- transaction approvals

## Request Schema

`POST /wallet/analyze`

```json
{
  "wallet_address": "0x...",
  "networks": ["ethereum", "arbitrum", "hyperliquid"],
  "protocols": ["hyperliquid", "aave", "morpho"],
  "stress_profile": "standard"
}
```

### Validation Rules

- `wallet_address` must be a `0x`-prefixed 40-character hexadecimal address.
- `networks` must contain at least one supported network.
- `protocols` must contain at least one supported protocol.
- Duplicate network values are rejected.
- Duplicate protocol values are rejected.
- Empty requests are rejected.

## Response Schema

The response includes:

- `service`
- `wallet_address`
- `supported_positions_found`
- `unsupported_positions_found`
- `data_timestamp`
- `data_quality`
- `portfolio_summary`
- `risk_metrics`
- `strategy_health`
- `recommendation`
- `risk_notes`
- `corrective_actions`
- `positions`
- `protocol_errors`
- `warnings`

## Supported Networks

- `ethereum`
- `arbitrum`
- `hyperliquid`

## Supported Protocols

- `hyperliquid`
- `aave`
- `morpho`

## Read-Only Security Model

Wallet Auditor only reads public or publicly accessible protocol data. It does not sign messages, submit transactions, or request wallet permissions.

RPC access is used only where public read calls are required. Missing RPC configuration returns a partial-data warning rather than halting the entire report.

## Supported Data Sources

- Hyperliquid public Info API for read-only account and position data.
- Aave read-only RPC patterns using configured RPC endpoints.
- Morpho GraphQL API for market and vault position data.

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
  "supported_positions_found": 2,
  "unsupported_positions_found": 0,
  "data_timestamp": "2026-07-12T00:00:00Z",
  "data_quality": "complete",
  "portfolio_summary": {
    "current_position_value_usd": 8500,
    "gross_long_exposure_usd": 4300,
    "gross_short_exposure_usd": 4200,
    "net_delta_usd": 100,
    "net_delta_pct": 1.18,
    "unrealized_pnl_usd": 400,
    "collateral_value_usd": 1200,
    "debt_value_usd": 0,
    "estimated_funding_exposure_apy": 0.8
  },
  "risk_metrics": {
    "hedge_ratio": 0.9767,
    "hedge_drift_pct": 2.33,
    "collateral_health_score": 100,
    "minimum_health_factor": null,
    "liquidation_proximity_pct": null,
    "safety_buffer_score": 81.2,
    "capital_at_risk_proxy": 100,
    "estimated_impairment_loss_usd": 0,
    "estimated_impairment_loss_pct": 0,
    "post_impairment_equity_usd": 0
  },
  "strategy_health": "healthy",
  "recommendation": {
    "action": "HOLD",
    "summary": "Current public wallet positions appear adequately hedged, collateralized, and resilient.",
    "confidence": 92
  },
  "risk_notes": [],
  "corrective_actions": ["Maintain the current structure and continue monitoring public data quality."],
  "positions": [],
  "protocol_errors": [],
  "warnings": []
}
```

## Error Cases

- Invalid wallet address — rejected with validation error.
- Empty networks or protocols — rejected with validation error.
- Unsupported protocol or network combinations — omitted from analysis and reported through warnings or protocol errors.
- Partial protocol failure — the report remains useful and labels the missing view clearly.
- Insufficient data — the report stays cautious and does not treat missing data as zero risk.

## Limitations

- Coverage is limited to supported public data sources.
- Availability depends on read access to public protocol interfaces.
- Wallet analysis is read-only and does not execute trades.
