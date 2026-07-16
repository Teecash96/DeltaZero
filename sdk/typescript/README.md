# DeltaZero TypeScript SDK

Typed SDK package for the live DeltaZero API.

This package is a thin client around the deployed DeltaZero API. It does not duplicate backend logic and does not add authentication.

## Installation

```bash
npm install deltazero-core
```

## Development from the repository

From the repository root:

```bash
cd sdk/typescript
npm test
```

To use the package in another local project, point your package manager at this folder while the repository is checked out locally.

## API

```ts
import { DeltaZeroClient } from "deltazero-core";

const client = new DeltaZeroClient({
  baseUrl: "https://deltazero-production.up.railway.app",
});

const report = await client.buildStrategy({
  asset: "SOL",
  capital_usd: 5000,
  risk_tolerance: "medium",
  target_style: "neutral_yield",
  long_yield_apy: 14,
  short_funding_apy: 3,
  fee_drag_apy: 1,
});
```

Supported methods:

- `buildStrategy()`
- `auditPosition()`
- `stressTest()`
- `auditWallet()`
