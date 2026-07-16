# DeltaZero Current Project Scope

DeltaZero is a live, read-only DeFi risk-intelligence ASP for pseudo-delta-neutral strategies. This document supersedes the original MVP constraint brief.

## Live product capabilities

1. Deterministic Strategy Build.
2. Hedge-Drift Auditing for existing long/short structures.
3. Funding Stress Testing with impairment breakdowns.
4. Correlated, fat-tailed Monte Carlo Sensitivity with collateral-depeg transmission.
5. Read-only wallet analysis for supported Hyperliquid, Morpho, and Aave positions.
6. Live Hyperliquid market context.
7. One coordinated Risk Engine pass returning all four premium strategy reports.
8. Browser OKX Wallet checkout and a production x402 payment boundary on X Layer.
9. A live Streamable HTTP MCP server for agent-native deterministic calculations.
10. An Agent Operator Console and executable agent-in-a-box example with proposal-only safeguards.
11. Responsive charts, liquidation-zone visualization, methodology, report export, and browser-local report history.

## Safety boundary

DeltaZero remains non-custodial and read-only. It does not request seed phrases, private keys, token approvals, or trading authority. Recommendations and execution payloads are decision support; they are not automatically broadcast as trades.

## Current infrastructure boundaries

- Submitted strategy inputs are not stored in a server database.
- Report history is stored locally in the user's browser.
- Email and Telegram actions share completed snapshots; unattended alerts still require durable server storage and a scheduler.
- SDKs are distributed as tested repository source packages and are not yet released through npm or PyPI.
- OKX marketplace registration/review submission does not imply marketplace approval.

## Supported assets and services

The strategy interfaces currently support SOL and ETH. Live public wallet coverage depends on the networks, positions, and data exposed by each supported adapter.

Primary paid endpoint:

```text
POST /risk-engine/analyze
```

Agent-native endpoint:

```text
POST /mcp
```

Public reference surfaces:

```text
GET /health
GET /docs
GET /openapi.json
GET /market/hyperliquid
```
