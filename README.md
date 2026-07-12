# DeltaZero

<div align="center">

**Deterministic risk intelligence for pseudo delta-neutral DeFi strategies.**

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OKX AI Hackathon](https://img.shields.io/badge/OKX_AI-Hackathon-000000)](https://www.okx.com/)

</div>

DeltaZero is a deterministic DeFi risk analyst for pseudo delta-neutral strategies. It helps users assess a proposed carry setup, audit an existing position, and stress test the structure under deterministic scenario shocks. The output is explicit and operational: strategy health, decision confidence, risk notes, and a clear action such as `OPEN`, `WAIT`, `HOLD`, `REBALANCE`, `REDUCE`, or `CLOSE`.

The product pairs a Next.js App Router frontend with a FastAPI backend and a rule-based risk engine. It is designed for hackathon-grade decision support, not trade execution. DeltaZero does not connect wallets for transaction approval, does not request private keys, does not place orders, and does not claim live protocol intelligence.

## Live Demo

https://delta-zero-alpha.vercel.app

## Products

- Strategy Builder — proposes a pseudo delta-neutral structure from capital, assumptions, risk tolerance, and target style.
- Position Auditor — evaluates an existing long, short, and collateral structure for hedge drift, capital risk, and corrective action.
- Stress Test — applies deterministic shocks to model post-stress metrics, health, decision confidence, and impairment.
- Wallet Auditor — read-only public wallet portfolio analysis for supported protocol data sources.

## Features

- Deterministic strategy construction for SOL and ETH.
- Strategy health and recommendation outputs from a centralized risk engine.
- Decision Confidence from 0 to 100 to show how clearly the metrics support the recommendation.
- Readable Safety Buffer and capital-at-risk analysis.
- Scenario-based impairment analysis in the stress test flow.
- Read-only wallet portfolio analysis for supported public positions.
- Responsive dark green interface with loading, error, and raw JSON states.
- Typed request and response contracts mirrored between backend and frontend.
- No authentication, no wallet signing, no trade execution, and no database.

## How It Works

1. Input — users provide asset, capital, risk tolerance, target style, yield assumptions, funding assumptions, fees, or existing position data.
2. Analyze — DeltaZero calculates carry, hedge ratio, hedge drift, net delta, collateral resilience, capital at risk, Safety Buffer, and impairment where relevant.
3. Assess — the deterministic engine compares metrics against thresholds based on risk tolerance, target style, service type, and stress scenario.
4. Decide — DeltaZero returns strategy health, recommended action, Decision Confidence, risk notes, and recommended structure or corrective actions.
5. Act — the result can be used to `OPEN`, `WAIT`, `HOLD`, `REBALANCE`, `REDUCE`, or `CLOSE`.

## Supported Target Styles

DeltaZero supports these deterministic builder target styles:

- `neutral_yield`
- `conservative_income`
- `aggressive_carry`
- `capital_preservation`

## Where These Strategies Can Be Used

- Neutral Yield Carry — hold or earn yield on the long leg while shorting perpetual futures to reduce directional exposure.
  - Relevant platforms: Hyperliquid, OKX, Drift, GMX, Aave, Morpho, Kamino
- Conservative Income — lower leverage, larger collateral reserve, tighter hedge, and lower capital risk.
  - Relevant platforms: Aave, Morpho, Spark, Compound, Silo
- Aggressive Carry — higher capital deployment, higher expected carry, wider risk tolerance, and smaller collateral reserve.
  - Relevant platforms: Hyperliquid, OKX, Drift, GMX, Ethena
- Capital Preservation — principal protection, tight hedge alignment, large collateral reserve, and low capital at risk.
  - Relevant platforms: Aave, Morpho, Pendle fixed yield, Spark, Ethena hedged products

DeltaZero currently analyzes user supplied assumptions and does not execute trades or connect directly to these protocols.

## Planned Integrations

These are roadmap integrations, not currently live integrations.

- Hyperliquid — perpetual short hedges, funding rate monitoring, and position data.
- Morpho — lending vault yield, collateral, and borrowing analysis.
- Aave — lending, borrowing, collateral health, and stablecoin carry.
- Pendle — fixed yield, PT and YT positions, and yield maturity analysis.
- Ethena — synthetic dollar and hedged yield strategy analysis.
- Live Funding Rates — real time perpetual funding inputs from supported venues.
- Wallet Position Import — read only wallet based position discovery and portfolio auditing.

## FAQ Summary

- Is DeltaZero non custodial? Yes. The current MVP does not hold funds, connect wallets, or execute transactions.
- Does DeltaZero execute trades? No. It provides deterministic risk analysis and recommendations only.
- Which assets are supported? SOL and ETH.
- Which target styles are supported? Neutral Yield, Conservative Income, Aggressive Carry, and Capital Preservation.
- How is the recommendation generated? The backend evaluates carry, hedge alignment, Safety Buffer, capital risk, impairment, and service specific thresholds using deterministic rules.
- What is Decision Confidence? It measures how clearly the current metrics support the recommendation. It is not a measure of profitability or strategy quality.
- Are protocol integrations live? No. Hyperliquid, Morpho, Aave, Pendle, Ethena, live funding data, and wallet import are planned roadmap integrations.
- Is my data stored? No. The current MVP has no database and does not retain submitted strategy inputs.
- Can autonomous agents use DeltaZero? Yes. The services expose structured API responses that can be consumed by agents, dashboards, or trading workflows.

## Architecture

### Frontend

The frontend uses the Next.js App Router, React, TypeScript, and Tailwind CSS. It provides:

- `/` — product overview
- `/builder` — strategy construction workflow
- `/auditor` — existing-position audit workflow
- `/stress-test` — scenario analysis workflow
- `/demo` — preloaded examples for the core services
- `/wallet` — read-only wallet portfolio auditor

The browser calls the API base configured through `NEXT_PUBLIC_API_BASE`, defaulting to `http://localhost:8000`.

### Backend

The backend is a FastAPI application with Pydantic validation and dedicated services for strategy building, auditing, metrics, recommendations, stress testing, impairment analysis, and wallet portfolio analysis. It exposes OpenAPI documentation automatically and includes pytest coverage for the strategy workflows and wallet auditor.

### API

The API accepts JSON requests and returns deterministic strategy responses.

- Builder: `POST /strategy/build` — proposes a long, short, and collateral structure plus metrics, health, recommendation, and risk notes.
- Auditor: `POST /strategy/audit` — evaluates an existing structure and returns health, recommendation, actions, and risk notes.
- Stress Test: `POST /strategy/stress-test` — applies deterministic scenario shocks and returns stressed metrics, actions, and impairment analysis.
- Wallet Auditor: `POST /wallet/analyze` — analyzes supported public wallet positions and returns a read-only portfolio risk report.

### Risk Engine

The risk engine is heuristic and deterministic. It derives carry, hedge, Safety Buffer, capital risk, and impairment outcomes from user-provided inputs and cached public protocol data. It does not query price feeds for the core strategy flows and does not make autonomous trading decisions.

## Screenshots

Replace these placeholders with project screenshots when available.

![Home](docs/images/home.png)
![Builder](docs/images/builder.png)
![Auditor](docs/images/auditor.png)
![Stress Test](docs/images/stress-test.png)

## Project Structure

```text
DeltaZero/
├── backend/
│   ├── app/
│   │   ├── integrations/
│   │   │   ├── aave.py
│   │   │   ├── hyperliquid.py
│   │   │   └── morpho.py
│   │   ├── models/
│   │   │   ├── impairment.py
│   │   │   ├── schemas.py
│   │   │   └── wallet.py
│   │   ├── routers/
│   │   │   └── wallet.py
│   │   ├── services/
│   │   │   ├── builder.py
│   │   │   ├── impairment.py
│   │   │   ├── metrics.py
│   │   │   ├── recommendation.py
│   │   │   ├── stress_test.py
│   │   │   ├── wallet_analyzer.py
│   │   │   └── position_normalizer.py
│   │   ├── config.py
│   │   └── main.py
│   └── tests/
├── docs/
│   ├── IMPAIRMENT_ENGINE.md
│   ├── OKX_ASP_SERVICE.md
│   ├── PROJECT.md
│   └── WALLET_AUDITOR.md
├── frontend/
│   ├── app/
│   │   ├── auditor/
│   │   ├── builder/
│   │   ├── demo/
│   │   ├── stress-test/
│   │   ├── wallet/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   └── lib/
├── .gitignore
└── README.md
```

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend framework | Next.js 16, React 19 |
| Frontend language | TypeScript 5 |
| Styling | Tailwind CSS 4, PostCSS |
| Backend framework | FastAPI |
| Backend language | Python 3.11+ |
| Validation | Pydantic 2 |
| Application server | Uvicorn |
| Backend testing | pytest, HTTPX |
| API format | JSON over HTTP, OpenAPI |

## Installation

### Prerequisites

- Python 3.11 or newer
- Node.js 20.9 or newer
- npm
- Git

Clone the repository:

```bash
git clone https://github.com/Teecash96/DeltaZero.git
cd DeltaZero
```

## Backend Setup

Create an isolated Python environment and install backend dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Available endpoints:

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Run the backend tests:

```bash
pytest -v
```

## Frontend Setup

In a second terminal, install frontend dependencies:

```bash
cd frontend
npm install
```

Set the backend base URL if needed:

```bash
export NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Frontend URL:

- App: http://localhost:3000

## How to Run Both Services Locally

1. Start the backend on port 8000.
2. Start the frontend with `NEXT_PUBLIC_API_BASE` pointing to the backend.
3. Open `http://localhost:3000` in your browser.

## API Overview

### Builder

`POST /strategy/build`

Builds a proposed pseudo delta-neutral strategy from capital, assumptions, risk tolerance, and target style.

### Auditor

`POST /strategy/audit`

Audits an existing position and returns current health, recommendation, corrective actions, and risk notes.

### Stress Test

`POST /strategy/stress-test`

Applies a deterministic scenario to evaluate post-stress metrics, impairment, health, and recommendation.

### Wallet Auditor

`POST /wallet/analyze`

Analyzes supported public wallet positions in read-only mode and returns a portfolio risk report.

## Future Monetization Note

Planned Pro capabilities:

- wallet portfolio import
- multi-wallet monitoring
- continuous risk alerts
- funding alerts
- Safety Buffer alerts
- saved reports
- ASP API access

## Roadmap

- Expand deterministic strategy heuristics as more supported style profiles are added.
- Broaden supported read-only protocol data sources where public interfaces are stable.
- Improve wallet coverage and partial-data reporting for supported venues.
- Add exportable report formats for risk review workflows.

## Known Limitations

- DeltaZero does not execute trades or manage custody.
- The core strategy flows rely on user-supplied assumptions, not live market feeds.
- Wallet coverage is limited to the supported public data sources currently wired into the backend.
- Some protocol data may be partial or unavailable depending on the public interface and RPC access.
- The current MVP has no persistent database.

## License

No license has been declared yet. Add one before public redistribution.

## Acknowledgements

Built for the OKX AI Hackathon.

Built by Akanbi Labs.

## Contributing

Issues and pull requests are welcome. Please keep contributions aligned with the deterministic, read-only MVP scope:

- preserve the existing API contracts
- avoid adding trade execution or wallet signing
- update tests when behavior changes intentionally
- keep the UI clean, responsive, and professional

Before opening a pull request, run:

```bash
cd backend && pytest -v
cd frontend && npm run lint
cd frontend && npm run build
```
