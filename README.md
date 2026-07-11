# DeltaZero

<div align="center">

**Deterministic risk intelligence for pseudo-delta-neutral DeFi strategies.**

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OKX AI Hackathon](https://img.shields.io/badge/OKX_AI-Hackathon-000000)](https://www.okx.com/)

</div>

DeltaZero helps users evaluate a pseudo-delta-neutral carry strategy built from a yield-generating long position, a perpetual short hedge, and reserve collateral. It turns position and yield assumptions into deterministic metrics, risk notes, strategy health, and an explicit action such as `OPEN`, `WAIT`, `HOLD`, `REBALANCE`, `REDUCE`, or `CLOSE`.

The project combines a focused Next.js interface with a typed FastAPI service and heuristic risk engine. Users can build a proposed neutral-carry allocation, audit an existing long/short position, or apply funding, yield, and price shocks before making a decision. DeltaZero is decision-support software; it does not connect to wallets, execute trades, or consume live protocol data.

## Live Demo

[https://delta-zero-alpha.vercel.app](https://delta-zero-alpha.vercel.app)

## Backend API

[https://deltazero-production.up.railway.app](https://deltazero-production.up.railway.app)

## Features

- **Strategy Builder** — converts capital, risk tolerance, and carry assumptions into a recommended long, short, and collateral structure.
- **Position Auditor** — evaluates an existing position for hedge alignment, carry quality, directional exposure, and collateral support.
- **Scenario Stress Testing** — applies deterministic `funding_worsens`, `yield_drops`, `price_drop`, or `price_rise` shocks.
- **Seven core metrics** — hedge ratio, hedge drift, net delta estimate, estimated net carry APY, carry efficiency, Safety Buffer, and capital-at-risk proxy.
- **Actionable recommendations** — returns a strategy health state, primary recommendation, ordered actions where applicable, and risk notes.
- **Typed API contract** — Pydantic request and response models mirrored by TypeScript interfaces.
- **Responsive dark interface** — dedicated Builder, Auditor, Stress Test, and Demo workflows with loading, error, and raw JSON states.
- **Supported assets** — SOL and ETH.
- **Deterministic behavior** — identical inputs produce identical results; no model inference or external market feed is involved.

## Architecture

```text
Browser
   │
   │  JSON over HTTP
   ▼
Next.js frontend ──────► FastAPI routes ──────► Strategy services
                                                │
                                                ▼
                                      Deterministic risk engine
                                      metrics · health · actions
```

### Frontend

The frontend uses the Next.js App Router, React, TypeScript, and Tailwind CSS. It provides five routes:

- `/` — product overview
- `/builder` — strategy construction workflow
- `/auditor` — existing-position audit workflow
- `/stress-test` — scenario analysis workflow
- `/demo` — preloaded examples for all three services

The browser calls the API base configured through `NEXT_PUBLIC_API_BASE`, defaulting to `http://localhost:8000`.

### Backend

The backend is a FastAPI application with Pydantic validation and separate services for building, auditing, metrics, recommendations, and stress testing. It exposes OpenAPI documentation automatically and includes a health endpoint and pytest coverage for the three strategy workflows.

### API

The API accepts JSON requests and returns a shared strategy response containing the service name, strategy name, asset, health, metrics, recommendation, and risk notes. Builder responses add a recommended structure; Auditor responses add actions; Stress Test responses add actions and a nested scenario result.

### Risk Engine

The risk engine is heuristic and deterministic. It derives hedge and carry measurements from user-provided notionals, collateral, APYs, and fee drag, then maps those metrics to `healthy`, `warning`, or `critical` states using constants defined in `backend/app/config.py`. The engine does not query exchanges, protocols, blockchains, or price feeds.

## Project Structure

```text
DeltaZero/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic API contracts
│   │   ├── routers/
│   │   │   └── strategy.py         # Strategy endpoints
│   │   ├── services/
│   │   │   ├── auditor.py
│   │   │   ├── builder.py
│   │   │   ├── metrics.py
│   │   │   ├── recommendation.py
│   │   │   └── stress_test.py
│   │   ├── config.py               # Supported values and thresholds
│   │   └── main.py                 # FastAPI application
│   ├── tests/                       # Backend test suite
│   ├── pytest.ini
│   └── requirements.txt
├── docs/
│   └── PROJECT.md                   # Product scope and MVP constraints
├── frontend/
│   ├── app/
│   │   ├── auditor/
│   │   ├── builder/
│   │   ├── demo/
│   │   ├── stress-test/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── strategy-ui.tsx         # Shared forms and result views
│   ├── lib/
│   │   ├── api.ts                  # Typed API client
│   │   ├── samples.ts              # Demo request payloads
│   │   └── types.ts                # TypeScript API contracts
│   ├── public/
│   ├── .env.example
│   └── package.json
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

Create an isolated Python environment and install the backend dependencies:

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

The service will be available at:

- API: [http://localhost:8000](http://localhost:8000)
- Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

Run the backend tests:

```bash
pytest -v
```

## Frontend Setup

In a second terminal, install the frontend dependencies:

```bash
cd frontend
npm install
```

Create a local environment file from the documented example:

```bash
cp .env.example .env.local
```

The default configuration is:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful frontend checks:

```bash
npm run lint
npm run build
```

## Running Both Services Locally

Run the backend and frontend in separate terminals from the repository root.

**Terminal 1 — API**

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — web application**

```bash
cd frontend
npm run dev
```

The frontend expects the backend on port `8000` and runs on port `3000`. The backend currently permits browser POST requests from `http://localhost:3000` and `http://127.0.0.1:3000`.

## API Overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Confirm that the API is running |
| `POST` | `/strategy/build` | Build a proposed neutral-carry structure |
| `POST` | `/strategy/audit` | Audit an existing long/short position |
| `POST` | `/strategy/stress-test` | Apply a deterministic scenario shock |

### Builder

`POST /strategy/build` accepts capital, risk tolerance, target style, long yield, short funding, and fee drag. It returns a recommended long notional, short notional, collateral allocation, target hedge ratio, metrics, health, recommendation, and risk notes.

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

### Auditor

`POST /strategy/audit` accepts existing long, short, and collateral notionals plus carry assumptions. It returns the shared metrics and recommendation alongside an ordered action list.

### Stress Test

`POST /strategy/stress-test` accepts an existing position and one scenario. Supported scenario types are `funding_worsens`, `yield_drops`, `price_drop`, and `price_rise`. The response includes base metrics and a nested result containing stressed notionals, stressed carry assumptions, stressed metrics, and post-stress health.

Complete request models and interactive examples are available at `/docs` while the backend is running.

## Screenshots

### Homepage

![DeltaZero homepage](docs/images/home.png)

### Strategy Builder

![DeltaZero Strategy Builder](docs/images/builder.png)

### Position Auditor

![DeltaZero Position Auditor](docs/images/auditor.png)

### Stress Test

![DeltaZero Stress Test](docs/images/stress-test.png)

## Deployment

- **Frontend:** Deployed on [Vercel](https://vercel.com/) at [delta-zero-alpha.vercel.app](https://delta-zero-alpha.vercel.app).
- **Backend:** Deployed on [Railway](https://railway.app/) at [deltazero-production.up.railway.app](https://deltazero-production.up.railway.app).
- **Source Control:** Hosted on [GitHub](https://github.com/) at [Teecash96/DeltaZero](https://github.com/Teecash96/DeltaZero).

## Roadmap

The current repository is a focused hackathon MVP. Potential next steps, not implemented today, include:

- [x] Deterministic Builder, Auditor, and Stress Test services
- [x] Responsive web workflows and typed API integration
- [x] Automated backend tests and production frontend build validation
- [ ] Add repository-hosted screenshots and expanded usage documentation
- [ ] Make browser origin configuration environment-specific for hosted environments
- [ ] Define a deployment and operational monitoring plan
- [ ] Evaluate live data integrations only after their trust, failure, and security models are defined

## Known Limitations

- DeltaZero is a hackathon MVP and is not financial advice.
- Metrics, health states, and actions are deterministic heuristics rather than forecasts or guarantees.
- Inputs are supplied manually; there are no live market, exchange, protocol, or blockchain integrations.
- Only SOL and ETH are accepted.
- The only target style is `neutral_yield`.
- Stress tests apply one scenario at a time from four supported scenario types.
- There is no authentication, wallet connection, database, user account, or saved strategy history.
- The application does not execute or simulate real trades.
- There are no charts, trading terminals, chatbot features, or multi-chain infrastructure.
- Backend CORS origins are currently configured for local frontend development.

## Contributing

Contributions that improve the existing MVP are welcome. Before opening a pull request:

1. Create a focused branch from `main`.
2. Keep changes within the documented product scope.
3. Add or update tests when backend behavior changes.
4. Run `pytest -v` in `backend`.
5. Run `npm run lint` and `npm run build` in `frontend`.
6. Describe the problem, approach, and verification steps in the pull request.

For larger product changes, open an issue first so the API contract and MVP constraints can be discussed before implementation.

## License

No open-source license has been added to this repository yet. Until a license is provided, all rights are reserved by the repository owner. See [GitHub's licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) before using, modifying, or distributing the project.

## Acknowledgements

DeltaZero was created for the **OKX AI Hackathon** as an exploration of clear, deterministic risk decision support for pseudo-delta-neutral DeFi strategies.

Built with FastAPI, Next.js, TypeScript, Tailwind CSS, and the broader open-source Python and JavaScript ecosystems.
