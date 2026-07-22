# DeltaZero monthly subscription gateway

This service implements the official **OKX Agent Payments Protocol** HTTP
subscription flow for DeltaZero's direct API customers. It charges **5 USDT per
calendar month**, grants active subscribers access to all five deterministic
analysis routes, and proxies successful calls to the existing FastAPI engine.

It is deliberately separate from the OKX.AI A2MCP listing endpoint. OKX.AI
A2MCP services are free or paid per call; their registered MCP transport is:

```text
https://deltazero-production.up.railway.app/mcp
```

The monthly gateway uses the official Node.js subscription SDK because the
current Python SDK does not support the recurring `period` flow.

## Protected routes

- `POST /risk-engine/analyze`
- `POST /strategy/build`
- `POST /strategy/audit`
- `POST /stress-test/run`
- `POST /monte-carlo/run`

`GET /health` and `GET /plans` are free.

## Production requirements

- OKX developer API credentials
- X Layer receiving address
- Redis for durable subscription state
- The free/internal FastAPI engine URL as `UPSTREAM_API_BASE_URL`

Never expose the OKX credentials in frontend variables or browser code.

## Run

```bash
npm install
npm run build
npm start
```

An unsubscribed request returns the standard 402 subscription challenge. The
buyer authorizes the plan once through an OKX-compatible agent. Active access
uses the protocol's signed access proof; the seller scheduler triggers each due
calendar-month charge. The SDK obtains facilitator and contract addresses from
the supported-networks response rather than hard-coding them.
