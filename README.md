# Δ DeltaZero

## Deterministic risk intelligence for pseudo delta neutral DeFi strategies

Build strategies, analyze hedge drift, simulate economic impairment, and assess supported public wallet portfolios through one transparent risk engine.

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-84CC16.svg)](LICENSE)
[![OKX AI Hackathon](https://img.shields.io/badge/OKX_AI-Hackathon-000000)](https://www.okx.com/)

[Live Application](https://delta-zero-alpha.vercel.app) ·
[API Documentation](https://deltazero-production.up.railway.app/docs) ·
[Published SDKs](#published-sdks) ·
[X](https://x.com/DeltaZeroASP)

</div>

DeltaZero is an open-source, production-oriented ASP for deterministic DeFi risk analysis. It converts strategy assumptions and supported public wallet data into structured metrics, strategy health, recommended actions, risk notes, and decision confidence without claiming to predict markets. An optional grounded LLM layer explains those computed results in plain language; it cannot change the underlying numbers or recommendation.

## Product screenshots

### Live risk-intelligence interface

![DeltaZero live application showing the deterministic risk dashboard](docs/assets/deltazero-home.jpg)

## Methodology, provenance, and support

The live [Methodology](https://delta-zero-alpha.vercel.app/methodology) page documents DeltaZero's formulas, worked Safety Buffer calculation, threshold provenance, model card, impairment model, Monte Carlo assumptions, reproducibility requirements, validation status, data sources, and limitations. Completed Strategy Build, Funding Stress Testing, and Wallet Auditor reports include a visible provenance panel with the source, source snapshot, report time, and data-quality context when available. DeltaZero does not claim historical validation or empirical threshold calibration until a versioned, time-aligned replay dataset is published.

## Live MCP server

DeltaZero exposes a standards-compliant, stateless Streamable HTTP Model Context Protocol server at:

```text
https://deltazero-production.up.railway.app/mcp
```

MCP initialization, discovery, resources, market context, and deterministic tools are temporarily free during listing review:

- `build_neutral_strategy`
- `audit_hedge_drift`
- `run_funding_stress`
- `run_monte_carlo`
- `run_complete_risk_engine` — all four coordinated reports in one invocation
- `evaluate_risk_envelope` — portable Risk Envelope v1 decision contract
- `explain_risk_recommendation` — grounded natural-language brief over verified Risk Envelope evidence

Agents can also discover `deltazero://schemas/risk-envelope-v1` as an MCP resource. It exposes the same JSON Schema available over REST.

The registered OKX.AI service is an A2MCP API service whose public Streamable
HTTP transport is `/mcp`. OKX.AI supports either free or per-call billing for
that marketplace endpoint. DeltaZero therefore keeps marketplace billing
separate from its direct-customer plan.

For direct HTTP/API customers, `subscription-gateway/` implements an official
**OKX Agent Payments Protocol** subscription: **5 USDT per calendar month** for
all deterministic analysis routes. It uses the official Node.js `period`
scheme, durable Redis state, signed access proofs, and scheduled renewal
charges. The current Python payment SDK does not support subscriptions, so the
deterministic FastAPI engine remains unchanged behind this gateway.

The MCP tools call the same Python service functions used by the REST API; formulas and recommendation logic are not duplicated. Tool inputs and structured outputs are generated from the same Pydantic contracts, so compatible agents do not need endpoint-specific response parsers.

Connect locally with MCP Inspector:

```bash
npx -y @modelcontextprotocol/inspector
```

Then use `http://127.0.0.1:8000/mcp` as the Streamable HTTP server URL.

For product questions, API issues, payment problems, or data-quality reports, use the [Support page](https://delta-zero-alpha.vercel.app/support). Support will never request a seed phrase, private key, wallet approval, admin bypass key, or API secret.

GitHub Actions runs backend tests, frontend lint and production build, and both SDK test suites for pushes to `main` and pull requests. No production credentials are required by CI.

## DeltaZero Risk Zones

DeltaZero classifies completed Strategy Build, Wallet Auditor, Funding Stress Testing, and Monte Carlo reports into five operator-friendly zones: **Optimal**, **Healthy**, **Watch**, **Defensive**, and **Critical**.

Risk zones are deterministic interpretations of existing report metrics. They are not trading instructions and do not predict profitability.

The current product includes Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, read-only Wallet Auditor, Agent Operator Console, an opt-in Strategy Registry, and a no-wallet live strategy comparison. It never requests private keys, seed phrases, trading signatures, approvals, or transaction permissions, and it does not execute trades. The backend payment boundary is staged but temporarily disabled for listing review; payment credentials remain separate from any trading or protocol permission.

## Why DeltaZero?

Pseudo delta-neutral strategies can look attractive while hiding hedge drift, weak collateral, negative carry, liquidation exposure, or severe scenario losses; DeltaZero makes those risks explicit before a user or agent acts.

DeltaZero is differentiated by:

- **Deterministic decisions** — recommendations come from documented rules and evaluated thresholds rather than opaque generated calculations.
- **One risk language** — Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Wallet Auditor consistently report health, action, Safety Buffer, risk notes, and Decision Confidence.
- **Read-only portfolio analysis** — supported public protocol data is analyzed without custody or wallet permissions.
- **Agent-ready contracts** — FastAPI schemas and local TypeScript and Python SDK packages expose structured responses for dashboards and automated workflows.
- **Portable Risk Envelope** — every complete analysis includes a versioned decision artifact that is identical across REST, MCP, and JSON export.
- **Extensible protocol adapters** — Hyperliquid, Aave, and Morpho are resolved through a registry so additional read-only sources can be added without changing the decision engine.

## Why Agents Integrate DeltaZero

Agents are buying a maintained decision contract rather than starting another
risk-engine project. One typed API or MCP request returns four coordinated
views—Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Monte
Carlo Sensitivity—with validated structured output and shared policy rules.

The reproducible local benchmark in [`backend/benchmarks`](backend/benchmarks)
measured the complete four-report FastAPI pass with 1,000 seeded Monte Carlo
paths after five warmups:

| Evidence | Result |
| --- | ---: |
| Median local decision latency | 18.09 ms |
| P95 local decision latency | 19.48 ms |
| Identical normalized outputs | 50 / 50 |
| Schema-valid responses | 50 / 50 |
| Reference-policy fixture agreement | 12 / 12 |

These numbers measure local in-process execution only. They exclude network
transit, cold starts, public-protocol fetches, and payment settlement. Timestamp
fields are removed only for repeatability hashing. Reference-policy agreement
verifies the configured decision rules; it is not a profitability forecast or
a measured real-world loss rate. DeltaZero does not assign invented latency or
error-rate figures to ad-hoc scripts or spreadsheets when no canonical baseline
has been tested.

Reproduce the results from `backend/`:

```bash
PYTHONPATH=. .venv-new/bin/python benchmarks/agent_risk_benchmark.py
```

The illustrative homepage Safety Buffer also has a reproducible reference
cohort. A score of 75.95 (displayed as 76) ranks at the 80th percentile across
1,001 evenly spaced DeltaZero SOL reference configurations spanning 10%–45%
collateral-to-short coverage. It is 15.95 points above the medium-risk warning
threshold of 60. Run `benchmarks/safety_buffer_reference.py` to reproduce it.
This is a bounded product-policy cohort—not a sample or ranking of active
Hyperliquid accounts.

## Feature Overview

| Capability | Status | Description |
| --- | --- | --- |
| Strategy Build | Live | Constructs a deterministic pseudo delta-neutral structure from capital, risk tolerance, target style, and market assumptions. |
| Hedge-Drift Auditing | Live | Evaluates an existing long, short, and collateral structure and recommends corrective action. |
| Funding Stress Testing | Live | Applies deterministic funding shocks and calculates post-stress risk and scenario-based economic impairment. |
| Wallet Auditor | Live · Free Preview | Analyzes supported public wallet positions through read-only protocol adapters. |
| Agent Operator Console | Live · Simulation | Runs a session-only guard loop that detects simulated hedge drift, calls the live audit API, and prepares an approval-gated proposal without claiming trade execution. |
| Strategy Registry | Live · Opt-in | Stores up to 25 decisions locally, lets operators attach observed outcomes, exports portable JSON, and exposes a stateless agent-native evaluation contract without silently retraining thresholds. |
| Risk Envelope v1 | Live | Normalizes action, risk zone, measures, evidence, constraints, and approval requirements into a versioned REST/MCP/JSON contract. |
| Protocol Adapter Registry | Live | Lets additional read-only protocol adapters register behind the common wallet-position interface without rewriting the analysis engine. |
| Decision Engine | Live | Centralizes carry, hedge, Safety Buffer, capital-risk, health, action, and confidence evaluation. |
| Grounded Risk Explanation | Live · Optional | Uses OpenAI Structured Outputs to explain verified Risk Envelope evidence without recalculating metrics, inventing market causes, or changing the deterministic action. Falls back safely when unavailable. |
| Economic Impairment Engine | Live | Estimates impairment loss, post-impairment equity, and a non-overlapping loss breakdown. |
| Marketplace API service | Live · Temporarily Free | The MCP endpoint is reachable at `/mcp` for OKX.AI review. Marketplace A2MCP access is free or paid per call. |
| Monthly API plan | Deployment-ready | The separate official subscription gateway charges 5 USDT per calendar month for all deterministic HTTP analysis routes. |
| Interactive Strategy Preview | Live · Permanently Free | Compares Conservative Income and Aggressive Carry through the production deterministic builder without a wallet or payment. |
| TypeScript SDK | Published · npm | Supplies a typed client through [`deltazero-core`](https://www.npmjs.com/package/deltazero-core). |
| Python SDK | Published · PyPI | Supplies a typed client through [`deltazero-core`](https://pypi.org/project/deltazero-core/). |
| Hyperliquid | Live | Reads supported perpetual positions and account context from public protocol data. |
| Aave | Live with RPC | Reads supported lending and collateral data when an RPC endpoint is configured. |
| Morpho | Live | Reads supported market and vault positions from Morpho's public API. |

## Products

### Composability contracts

DeltaZero is composable at the decision boundary while remaining deliberately read-only. A complete Risk Engine call embeds `risk_envelope`, and clients can request the same portable artifact directly through:

- `POST /risk-envelope/evaluate` over REST;
- `evaluate_risk_envelope` over MCP;
- `GET /standards/risk-envelope/v1` for the public JSON Schema; and
- `deltazero://schemas/risk-envelope-v1` for MCP schema discovery.

Risk Envelope v1 includes a deterministic analysis ID, normalized action, risk zone, core measures, evidence from all four analysis modules, known constraints, and `human_approval_required: true`. It is available in the published TypeScript and Python SDKs.

Protocol ingestion is independently extensible through `ProtocolAdapterRegistry`:

```python
from app.integrations.registry import ProtocolAdapterRegistry

registry = ProtocolAdapterRegistry()
registry.register("example", lambda network: ExampleReadOnlyAdapter(network))
adapters = registry.resolve(["ethereum"], ["example"])
```

DeltaZero does not publish scores on-chain, mint risk attestations, approve tokens, or execute trades. That boundary is intentional: a recommendation remains inspectable decision support and cannot be mistaken for transaction authorization.

### Agent Operator Console

The `/agent` console turns DeltaZero's structured API into a transparent operator workflow. A user selects risk tolerance and strategy mandate, spawns a session-only guard, and watches the guard compare simulated hedge drift against the configured intervention boundary. When the boundary is breached, the console calls live Hedge-Drift Auditing and displays the returned recommendation. Execution authority remains disabled until a separately authorized and compatible venue adapter is configured.

### Strategy Registry

The `/registry` experience is an explicit opt-in memory layer. Once enabled,
completed Risk Engine and Monte Carlo decisions are retained in that browser.
Operators can attach observed outcomes, realized return, maximum drawdown, final
Safety Buffer, and notes before exporting or importing the registry as JSON.

Autonomous clients can call `POST /strategy-registry/evaluate` or the free MCP
tool `evaluate_strategy_memory` with their client-owned history. DeltaZero
returns deterministic coverage, exception, outcome, and refinement signals but
does not persist the request or alter decision thresholds. Observations remain
user-supplied evidence—not verified training labels or profitability proof.

### Agent-in-a-Box example

The executable [`examples/agent-bot/agent-bot.mjs`](examples/agent-bot/agent-bot.mjs)
demonstrates an autonomous monitoring loop: simulated wallet scan, hedge-drift
trigger, live audit request, optional agent payment authorization when paid mode is enabled,
and a proposal-only rebalance payload. See the
[`example guide`](examples/agent-bot/README.md) for safeguards and run commands.

### Strategy Build

The Builder creates a proposed structure from:

- asset and deployable capital;
- risk tolerance;
- target style;
- long-yield assumption;
- short-funding assumption; and
- fee-drag assumption.

It returns recommended long notional, short notional, collateral allocation, target hedge ratio, carry metrics, Safety Buffer, strategy health, Decision Confidence, recommendation, and risk notes.

Supported target styles are:

- `neutral_yield`
- `conservative_income`
- `aggressive_carry`
- `capital_preservation`

Each style uses a distinct deterministic allocation and threshold profile.

### Hedge-Drift Auditing

Hedge-Drift Auditing evaluates a supplied long, short, and collateral structure. It measures hedge alignment, net delta, carry, collateral resilience, Safety Buffer, and capital at risk before returning an action such as `HOLD`, `REBALANCE`, `REDUCE`, or `CLOSE`.

### Funding Stress Testing

Funding Stress Testing evaluates stressed rather than original metrics. It supports deterministic scenario inputs for funding deterioration, yield reduction, price movement, collateral pressure, exit slippage, liquidation penalties, and protocol-loss assumptions.

Its report includes:

- scenario result;
- post-stress metrics;
- post-stress health;
- recommended action;
- Decision Confidence;
- risk notes;
- estimated impairment loss; and
- post-impairment equity.

### Monte Carlo Sensitivity Analysis

Monte Carlo analysis runs 100 to 10,000 bounded stress paths across market movement, funding shifts, exit slippage, collateral haircuts, collateral depeg, and protocol-loss assumptions. Its systemic mode uses a configurable correlated Student-t model: collateral depeg severity can simultaneously amplify funding pressure, slippage, and collateral impairment. It reports impairment and post-stress equity distributions, depeg and breach probabilities, percentile outcomes, observed correlation, and ranked sensitivity drivers. These correlations are transparent scenario assumptions, not empirically calibrated forecasts.

### Report history and notification handoff

Completed Risk Engine and Monte Carlo reports are saved in the user's browser at `/history` (up to 25 reports). Users can export JSON or share a computed risk snapshot through email and Telegram. This is local report history and notification handoff—not continuous background monitoring. Unattended alerts still require a future server-side scheduler, durable storage, and opt-in notification subscriptions.

The engine is deterministic when a seed is supplied and reuses DeltaZero's existing impairment, metric, and threshold logic. It is a sensitivity tool—not a price forecast—and it does not source, infer, or fabricate future market data. Builder results and supported Wallet Auditor exposures can be transferred through short-lived browser session storage for simulation.

Key inputs include the current structure, capital, carry assumptions, simulation count, time horizon, seed, and bounded volatility assumptions. Outputs include P50/P95/P99 impairment, expected post-stress equity, Safety Buffer and hedge-drift breach probabilities, negative-carry probability, sensitivity contributions, and up to 50 sample paths.

## Wallet Auditor

The Wallet Auditor discovers and normalizes positions available through supported read-only integrations. It aggregates exposure, collateral, debt, unrealized PnL where reliable, hedge alignment, liquidation context, Safety Buffer, capital at risk, and estimated impairment.

The wallet report explicitly distinguishes:

- `positions_found`
- `no_supported_positions`
- `partial_data`
- `insufficient_data`

No supported positions and incomplete data are terminal assessment states, not evidence of a healthy portfolio. Missing values remain nullable instead of being silently treated as zero risk.

Open the [Wallet Auditor](https://delta-zero-alpha.vercel.app/wallet) to analyze supported public data.

## Live Read-Only Integrations

### Hyperliquid — LIVE

Read-only perpetual positions, margin data, account value, unrealized PnL, and liquidation context through public protocol data.

### Aave — LIVE WITH RPC

Read-only supply, borrow, collateral, debt, and health-factor analysis when supported RPC access is configured.

Set `ETHEREUM_RPC_URL` and `ARBITRUM_RPC_URL` in the backend environment to enable the configured network access. RPC credentials must never be committed.

### Morpho — LIVE

Read-only market and vault position analysis through Morpho's supported public API.

Live integrations are read-only. DeltaZero does not request signatures, private keys, approvals, or transaction permissions. Unsupported positions and unavailable data sources are reported explicitly and are not treated as zero risk.

## Architecture

```mermaid
flowchart LR
    subgraph Clients
        WEB[Next.js Web App]
        TS[TypeScript SDK]
        PY[Python SDK]
        AGENT[Agent or Dashboard]
    end

    subgraph API[FastAPI Service]
        PAYMENT[x402 Payment Gate]
        ROUTES[Validated API Routes]
        STRATEGY[Strategy Services]
        DECISION[Deterministic Decision Engine]
        IMPAIRMENT[Economic Impairment Engine]
        WALLET[Wallet Analyzer]
        NORMALIZER[Position Normalizer]
    end

    subgraph Sources[Read-Only Data Sources]
        HL[Hyperliquid]
        AAVE[Aave via RPC]
        MORPHO[Morpho Public API]
    end

    subgraph Payments[OKX Agent Payments]
        FACILITATOR[OKX Facilitator]
        XLAYER[X Layer USDT Settlement]
    end

    WEB --> PAYMENT
    TS --> PAYMENT
    PY --> PAYMENT
    AGENT --> TS
    AGENT --> PY
    PAYMENT --> ROUTES
    PAYMENT --> FACILITATOR
    FACILITATOR --> XLAYER
    ROUTES --> STRATEGY
    ROUTES --> WALLET
    STRATEGY --> DECISION
    STRATEGY --> IMPAIRMENT
    WALLET --> NORMALIZER
    NORMALIZER --> DECISION
    WALLET --> IMPAIRMENT
    WALLET --> HL
    WALLET --> AAVE
    WALLET --> MORPHO
```

### Frontend

The web interface uses Next.js App Router, React, TypeScript, and Tailwind CSS. It connects to the backend through `NEXT_PUBLIC_API_BASE` and contains no authentication, wallet connection, transaction flow, server database, or client-side calculation engine. The optional Strategy Registry uses browser-local storage only after explicit consent.

### Backend

FastAPI and Pydantic validate requests and responses. Service modules own strategy construction, position auditing, stress testing, wallet analysis, normalized metrics, recommendations, and impairment calculations.

### Decision Engine

The centralized engine evaluates carry, hedge drift, Safety Buffer, capital risk, and impairment state. Strategy health, action, summary, risk notes, and Decision Confidence originate from the same evaluated context.

Decision Confidence measures how clearly the current metrics support a recommendation. It is not a profitability forecast or a strategy-quality score.

### Economic Impairment

The impairment engine compares pre-stress and post-stress portfolio equity. Short-hedge gains offset long-leg losses where appropriate, while collateral haircuts, exit slippage, liquidation penalties, and protocol-loss assumptions are applied without blindly adding overlapping losses.

This is scenario-based economic impairment analysis, not formal IFRS or accounting impairment.

## How It Works

```text
Input assumptions or public wallet address
                  ↓
Validate and normalize the request
                  ↓
Calculate carry, hedge, collateral, and risk metrics
                  ↓
Evaluate deterministic thresholds and scenario impairment
                  ↓
Return health, action, confidence, notes, and structured JSON
```

The recommendation vocabulary depends on the service:

- Builder: `OPEN`, `REBALANCE`, or `WAIT`
- Auditor: `HOLD`, `REBALANCE`, `REDUCE`, or `CLOSE`
- Wallet Auditor: `HOLD`, `REBALANCE`, `REDUCE`, or `CLOSE` when an assessment is meaningful

## Published SDKs

DeltaZero includes thin, type-safe clients that call the existing deployed API. They do not duplicate backend calculations.

The TypeScript SDK is published on npm and the Python SDK is published on PyPI under the shared package name `deltazero-core`. Both packages are also available from this repository and exercised by CI.

### TypeScript

Package name: [`deltazero-core`](https://www.npmjs.com/package/deltazero-core)

Repository path: [`sdk/typescript`](sdk/typescript)

```bash
npm install deltazero-core
```

```ts
import { DeltaZeroClient } from "deltazero-core";

const client = new DeltaZeroClient({
  baseUrl: "https://deltazero-production.up.railway.app",
  timeoutMs: 10_000,
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

console.log(report.recommendation.action);
```

Available methods:

- `buildStrategy()`
- `auditPosition()`
- `stressTest()`
- `auditWallet()`
- `evaluateRiskEnvelope()`

### Python

Package name: [`deltazero-core`](https://pypi.org/project/deltazero-core/)

Repository path: [`sdk/python`](sdk/python)

```bash
python -m pip install deltazero-core
```

```python
from deltazero import DeltaZeroClient

client = DeltaZeroClient(
    base_url="https://deltazero-production.up.railway.app",
    timeout_s=10,
)

report = client.build_strategy({
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
})

print(report["recommendation"]["action"])
```

Available methods:

- `build_strategy()`
- `audit_position()`
- `stress_test()`
- `audit_wallet()`
- `evaluate_risk_envelope()`

Agent and dashboard use cases include deterministic pre-trade checks, portfolio review workflows, scenario-risk gates, report generation, and structured inputs to broader orchestration systems. DeltaZero does not execute the resulting action.

## API Reference

### Live Hyperliquid market context

`GET /market/hyperliquid?asset=ETH&lookback_hours=24` returns normalized mark and oracle prices, signed current hourly funding and APY, open interest, 24-hour notional volume, premium when available, and a historical funding summary. The service uses Hyperliquid's public Info API only, with short-lived in-memory caching.

Positive funding means longs pay shorts; negative funding means shorts pay longs. DeltaZero preserves that sign. Funding rates are variable and may change after analysis.

### Manual and live Builder modes

The Builder defaults to manual assumptions. Live Hyperliquid mode retrieves public market context while keeping long-yield and fee-drag inputs manual. Because the existing Builder field represents a short-side funding cost, signed market funding is converted centrally: positive market funding becomes income to the short hedge, while negative market funding becomes a cost.

### Wallet hedge workflow

Successful Wallet Auditor reports can pass a normalized, non-sensitive exposure snapshot to the Builder through short-lived browser session storage. The Builder calculates a proposed short adjustment for long-dominant portfolios using the configured style and risk target, and the proposed structure can then be handed to Stress Test. These are read-only analytical recommendations: DeltaZero does not request signatures, submit transactions, or execute hedges.

### Base URLs

| Environment | URL |
| --- | --- |
| Local | `http://localhost:8000` |
| Production | `https://deltazero-production.up.railway.app` |
| Swagger UI | [Production API documentation](https://deltazero-production.up.railway.app/docs) |
| OpenAPI schema | `https://deltazero-production.up.railway.app/openapi.json` |

### Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Check the public service root. Free. |
| `GET` | `/health` | Check backend availability. |
| `GET` | `/docs` | Open Swagger UI. Free. |
| `GET` | `/openapi.json` | Read the OpenAPI contract. Free. |
| `GET` | `/standards/risk-envelope/v1` | Discover the public Risk Envelope v1 JSON Schema. Free. |
| `POST` | `/strategy/build` | Build and evaluate a proposed strategy. Temporarily free. |
| `POST` | `/strategy/audit` | Audit an existing position structure. |
| `POST` | `/stress-test/run` | Apply a deterministic stress scenario and impairment model. |
| `POST` | `/strategy/stress-test` | Legacy alias retained for SDK compatibility. Temporarily free. |
| `POST` | `/wallet/analyze` | Read supported public Hyperliquid, Aave, and Morpho positions and generate a read-only hedge-intelligence report. Permanently free. |
| `POST` | `/strategy-registry/evaluate` | Evaluate a client-owned recommendation and observed-outcome registry without server persistence or silent retraining. Free. |
| `POST` | `/preview/compare` | Compare Conservative Income and Aggressive Carry through the production strategy engine. Permanently free. |
| `POST` | `/monte-carlo/run` | Run seeded Monte Carlo sensitivity analysis. Temporarily free. |
| `POST` | `/risk-engine/analyze` | Run Strategy Build, Hedge-Drift Auditing, Funding Stress Testing, and Monte Carlo Sensitivity as one coordinated free-preview analysis. |
| `POST` | `/risk-envelope/evaluate` | Return the portable Risk Envelope v1 decision artifact for one coordinated analysis. Temporarily free. |
| `POST` | `/` | OKX.AI-compatible alias for the complete coordinated Risk Engine analysis. A bare review probe returns the documented SOL reference scenario; callers can submit their own full request body. |

### A2MCP marketplace access and direct subscriptions

DeltaZero currently defaults to `DELTAZERO_ACCESS_MODE=free`. In this mode every REST analysis route and every MCP tool is available without payment so OKX.AI reviewers can exercise the live product end to end. The marketplace endpoint that must be registered is:

```text
https://deltazero-production.up.railway.app/mcp
```

It is a stateless Streamable HTTP MCP transport, not the base API URL.

The production payment implementation remains in the codebase. After listing and demo completion, set:

```bash
export DELTAZERO_ACCESS_MODE="paid"
```

Paid mode uses the official OKX seller middleware. An unpaid request to a protected route returns `HTTP 402 Payment Required` with a base64-encoded `PAYMENT-REQUIRED` header. The header is the authoritative payment quote and identifies the network, stablecoin contract, atomic amount, receiver, and supported payment schemes.

The legacy per-call price is configured with `PAYMENT_PRICE_USDT`. When that mode is restored, the primary product flow calls `/risk-engine/analyze`: one payment returns all four coordinated Risk Engine reports for one submitted strategy. A new analysis is a new paid call. Agent Console, all read-only Hyperliquid/Aave/Morpho public-position data, health, documentation, and OpenAPI remain free.

The direct-customer monthly plan is implemented separately in
`subscription-gateway/`. It protects Strategy Build, Hedge-Drift Auditing,
Funding Stress Testing, Monte Carlo Sensitivity, and the combined Risk Engine
for **5 USDT per calendar month**. An OKX-compatible buyer authorizes once;
active requests carry signed access proof and the seller scheduler triggers
each due monthly charge. Deploy the gateway with Redis and the documented OKX
developer credentials before advertising its URL as live.

In paid mode, only the three `PAYMENT_*` variables produce challenge-only behavior: the server returns the quote but never releases a protected resource. Once all three official OKX facilitator credentials are configured, the submitted payment credential is verified and settled synchronously before the handler runs, and a successful response includes `PAYMENT-RESPONSE`.

### Agent-native payment

DeltaZero does not collect payment or connect wallets in the website. During the temporary free preview, autonomous clients can invoke the API without payment. When paid mode is restored, the **OKX Agent Payments Protocol** handles the quote, authorization, paid replay, and machine-readable settlement receipt before the backend releases the requested report.

The website remains a read-only product, methodology, and API-discovery surface. Agent clients can inspect the OpenAPI and MCP contracts and run the live analysis tools freely during review.

### Grounded natural-language explanations

Set `include_ai_explanation` to `true` on `POST /risk-engine/analyze` to receive `narrative_explanation` in the same response. This keeps the product to one coordinated call: the deterministic Risk Engine computes the metrics and action first, then the language model explains only the resulting Risk Envelope evidence.

```json
{
  "asset": "SOL",
  "capital_usd": 5000,
  "risk_tolerance": "medium",
  "target_style": "neutral_yield",
  "long_yield_apy": 14,
  "short_funding_apy": 3,
  "fee_drag_apy": 1,
  "simulation_count": 1000,
  "seed": 42,
  "include_ai_explanation": true
}
```

The provider receives the normalized analysis subject, decision, measures, evidence, constraints, and an allowlist of supplied facts—not wallet credentials or private keys. Structured output is validated before display. Any invented number, unsupported time estimate, altered fact, provider error, or missing API key fails closed to a deterministic explanation that explicitly states the evidence limitations.

Configure the backend only; never expose these values through `NEXT_PUBLIC_*` variables:

```bash
export OPENAI_API_KEY="your-server-side-key"
export OPENAI_EXPLANATION_MODEL="gpt-5.6"
export OPENAI_EXPLANATION_TIMEOUT_SECONDS="15"
```

The model is configurable. If `OPENAI_API_KEY` is absent, the API remains fully operational and returns `source: "deterministic_fallback"` instead of failing the risk analysis. Agents can request the same bounded output through the `explain_risk_recommendation` MCP tool.

Unpaid challenge:

```bash
curl --include \
  --request POST \
  --url https://deltazero-production.up.railway.app/strategy/build \
  --header 'Content-Type: application/json' \
  --data @builder-request.json
```

Paid replay after an x402-compatible wallet signs the returned challenge:

```bash
curl --include \
  --request POST \
  --url https://deltazero-production.up.railway.app/strategy/build \
  --header 'Content-Type: application/json' \
  --header "PAYMENT-SIGNATURE: ${PAYMENT_SIGNATURE}" \
  --data @builder-request.json
```

Never construct a payment credential by hand or treat the presence of a header as proof of payment. In challenge-only mode all paid replays fail closed. In settlement mode DeltaZero forwards credentials to the OKX facilitator for cryptographic verification and settlement before returning the protected resource.

### Admin Testing

The admin bypass is for owner and developer testing only. Set `DELTAZERO_ADMIN_KEY` in the backend environment, then send the value in the `X-DeltaZero-Admin-Key` request header from curl, Postman, or an agent. A correct key bypasses x402 for protected endpoints; a missing or incorrect key follows the normal payment flow.

Never commit this key, place it in a `NEXT_PUBLIC_*` variable, or expose it in browser code. DeltaZero logs only `admin_bypass_used=true` when the bypass is used and never logs or returns the key itself.

```bash
curl --request POST \
  --url https://deltazero-production.up.railway.app/strategy/build \
  --header 'Content-Type: application/json' \
  --header "X-DeltaZero-Admin-Key: ${DELTAZERO_ADMIN_KEY}" \
  --data @builder-request.json
```

### Builder request body

```json
{
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1
}
```

### Wallet example

```json
{
  "wallet_address": "0x0000000000000000000000000000000000000000",
  "networks": ["ethereum", "arbitrum", "hyperliquid"],
  "protocols": ["hyperliquid", "aave", "morpho"],
  "stress_profile": "standard"
}
```

Wallet analysis is read-only. Protocol failures are isolated and returned as warnings or errors so unavailable data is never represented as confirmed zero exposure.

Detailed service documentation:

- [Wallet Auditor](docs/WALLET_AUDITOR.md)
- [Hyperliquid Market Data](docs/HYPERLIQUID_MARKET_DATA.md)
- [Economic Impairment Engine](docs/IMPAIRMENT_ENGINE.md)
- [OKX ASP Service](docs/OKX_ASP_SERVICE.md)
- [Project specification](docs/PROJECT.md)

## Installation

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- npm

### Clone the repository

```bash
git clone https://github.com/Teecash96/DeltaZero.git
cd DeltaZero
```

### Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Optional Aave RPC configuration:

```bash
export ETHEREUM_RPC_URL="your-ethereum-rpc-url"
export ARBITRUM_RPC_URL="your-arbitrum-rpc-url"
```

Do not commit RPC URLs containing provider credentials.

The application defaults to the temporary free preview. Set this explicitly in deployment environments for clarity:

```bash
export DELTAZERO_ACCESS_MODE="free"
```

To restore paid mode later, set `DELTAZERO_ACCESS_MODE="paid"` and configure the receiving address, per-call price, and X Layer network identifier:

```bash
export PAYMENT_RECEIVER="0xYourReceivingAddress"
export PAYMENT_PRICE_USDT="1"
export PAYMENT_NETWORK="eip155:196"
export PUBLIC_API_BASE_URL="https://deltazero-production.up.railway.app"
```

To enable paid verification and settlement, additionally configure the complete official facilitator credential group:

```bash
export OKX_API_KEY="your-okx-developer-api-key"
export OKX_SECRET_KEY="your-okx-developer-secret"
export OKX_PASSPHRASE="your-okx-developer-passphrase"
```

In free mode, payment configuration is not loaded and every analysis route is released without a challenge. In paid mode, all three `PAYMENT_*` variables are required. Facilitator credentials are optional only as a complete group: none enables challenge-only mode, all three enable settlement, and a partial credential group stops startup. Protected resources are never released in challenge-only mode.

### Start the frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The example frontend environment points to the local backend at `http://localhost:8000`.

### Run tests

Backend:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

SDK commands are documented in the [Published SDKs](#published-sdks) section.

## Deployment

| Component | Platform | Address |
| --- | --- | --- |
| Frontend | Vercel | [delta-zero-alpha.vercel.app](https://delta-zero-alpha.vercel.app) |
| Backend | Railway | [deltazero-production.up.railway.app](https://deltazero-production.up.railway.app) |
| Source control | GitHub | [Teecash96/DeltaZero](https://github.com/Teecash96/DeltaZero) |

Production CORS permits the deployed frontend plus local Next.js development origins and exposes the x402 response headers to approved browser origins. The frontend API origin is configured through `NEXT_PUBLIC_API_BASE`.

## Security Model

- DeltaZero never asks for a seed phrase or private key.
- Wallet analysis does not request trading signatures, approvals, or transaction permissions.
- Free-preview mode releases analysis without payment; setting `DELTAZERO_ACCESS_MODE=paid` restores the fail-closed payment boundary.
- In paid mode, challenge-only operation never releases a protected resource; settlement requires facilitator-verified payment credentials before protected business logic runs.
- Facilitator API credentials and payment configuration belong in deployment environment variables and must never be committed.
- Hyperliquid access uses read-only public information endpoints.
- Aave access uses configured read-only RPC calls.
- Morpho access uses its supported public API.
- External-protocol failures are isolated and returned to the caller.
- Short-lived in-memory caching is used; the current MVP has no server database. The opt-in Strategy Registry remains browser-local unless an agent exports and stores its JSON elsewhere.
- Recommendations are analytical outputs, not trade instructions or execution.

## FAQ

### Is DeltaZero non-custodial?

Yes. The current product does not hold funds, connect wallets for signing, or execute transactions.

### Does DeltaZero execute trades?

No. DeltaZero provides deterministic risk analysis and structured recommendations only.

### Which assets does the strategy interface support?

The current Builder, Auditor, and Stress Test interfaces support SOL and ETH.

### Which target styles are available?

Neutral Yield, Conservative Income, Aggressive Carry, and Capital Preservation.

### How is a recommendation generated?

The backend evaluates carry, hedge alignment, Safety Buffer, capital risk, service-specific thresholds, and impairment where relevant through deterministic rules.

### What is Decision Confidence?

Decision Confidence measures how clearly the evaluated metrics support the recommendation. It does not measure expected profitability or guarantee strategy quality.

### Which wallet integrations are live?

Hyperliquid and Morpho are live read-only integrations. Aave is live with configured RPC access. Coverage is limited to the positions and networks supported by the current adapters.

### What happens when no wallet positions are found?

The Wallet Auditor returns `no_supported_positions` when all selected sources succeed but no supported positions are detected. It does not generate a risk recommendation for a nonexistent portfolio.

### What happens when a data source fails?

With no retrieved positions, the report is marked `insufficient_data`. If positions are retrieved from other sources, it is marked `partial_data`, warnings remain visible, and confidence is reduced.

### Is submitted data stored?

Submitted strategy and wallet inputs are not retained by the backend. If a user explicitly enables Strategy Registry, completed decision records and any user-entered outcome observations are stored in that browser until cleared or exported.

### Can agents use DeltaZero?

Yes. Agents, dashboards, and automated workflows can consume the structured API directly or use the repository-local SDK packages. DeltaZero does not autonomously execute the resulting recommendation.

### How are the SDK packages distributed?

The TypeScript SDK is published to [npm](https://www.npmjs.com/package/deltazero-core) and the Python SDK is published to [PyPI](https://pypi.org/project/deltazero-core/), both as `deltazero-core` version `0.1.0`.

## Roadmap

Planned integrations:

- **Pendle** — fixed-yield, PT, YT, and maturity-risk analysis.
- **Ethena** — synthetic-dollar and hedged-yield strategy analysis.
- **Continuous Funding Monitoring** — persistent alerts and multi-venue funding inputs beyond the current on-demand Hyperliquid snapshot.

Additional planned product capabilities include broader read-only network and protocol coverage, multi-wallet monitoring, continuous risk alerts, funding alerts, Safety Buffer alerts, saved reports, and expanded ASP API access.

Roadmap items are not presented as currently connected or available.

## Contributing

Contributions are welcome through GitHub issues and pull requests.

Before submitting a change:

1. Keep calculations deterministic and centralized.
2. Preserve existing route and response contracts unless a versioned change is agreed.
3. Add or update regression tests for decision behavior.
4. Run backend tests, frontend lint, and the production frontend build where relevant.
5. Do not commit secrets, private RPC URLs, build artifacts, or local environment files.

## License

DeltaZero is released under the [MIT License](LICENSE).

Copyright (c) 2026 Akanbi Labs.

## Built by Akanbi Labs

DeltaZero is designed and built by **Akanbi Labs** for the OKX AI Hackathon.

Follow product updates on [X](https://x.com/DeltaZeroASP).
