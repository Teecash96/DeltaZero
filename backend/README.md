# DeltaZero Backend

FastAPI backend for pseudo-delta-neutral DeFi risk management.

## Requirements

- Python 3.11+

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/strategy/build` | Build a neutral carry strategy |
| POST | `/strategy/audit` | Audit an existing position |
| POST | `/strategy/stress-test` | Stress test under a scenario |
| GET | `/health` | Health check |

Supported assets: **SOL**, **ETH**

## Tests

```bash
pytest -v
```

## Example requests

### Build

```bash
curl -X POST http://localhost:8000/strategy/build \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1
  }'
```

### Audit

```bash
curl -X POST http://localhost:8000/strategy/audit \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "SOL",
    "long_notional_usd": 3800,
    "short_notional_usd": 3000,
    "collateral_usd": 1200,
    "risk_tolerance": "medium",
    "long_yield_apy": 12,
    "short_funding_apy": 4,
    "fee_drag_apy": 1
  }'
```

### Stress test

```bash
curl -X POST http://localhost:8000/strategy/stress-test \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "SOL",
    "long_notional_usd": 3500,
    "short_notional_usd": 3150,
    "collateral_usd": 1500,
    "risk_tolerance": "medium",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
    "scenario": {
      "type": "funding_worsens",
      "magnitude_pct": 4
    }
  }'
```
