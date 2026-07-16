# DeltaZero Python SDK

Typed SDK package for the live DeltaZero API.

This package is a thin client around the deployed DeltaZero API. It does not duplicate backend logic and does not add authentication.

## Installation

```bash
python -m pip install deltazero-core
```

## Development from the repository

From the repository root:

```bash
cd sdk/python
python -m pytest
```

To use the package in another local project, point your Python environment at this folder while the repository is checked out locally.

## API

```python
from deltazero import DeltaZeroClient

client = DeltaZeroClient(base_url="https://deltazero-production.up.railway.app")

report = client.build_strategy({
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
})
```

Supported methods:

- `build_strategy()`
- `audit_position()`
- `stress_test()`
- `audit_wallet()`
