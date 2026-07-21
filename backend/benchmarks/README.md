# Agent risk benchmark

This benchmark measures DeltaZero's complete four-report risk pass through the
in-process FastAPI application. It records local decision latency, normalized
output repeatability, response-contract validity, and agreement with twelve
reference policy fixtures already covered by the product's test suite.

Run it from `backend/`:

```bash
PYTHONPATH=. .venv-new/bin/python benchmarks/agent_risk_benchmark.py
```

The committed `results.json` is the evidence source for the landing-page
"Why Agents" section. This is not a network benchmark: it excludes deployment
cold starts, network transit, public protocol adapters, and x402 settlement.
The reference fixtures test the configured policy rules; they do not measure
profitability or forecast real-world losses.

## Safety Buffer reference cohort

`safety_buffer_reference.py` reproduces the percentile shown beside the
illustrative homepage gauge. It evaluates 1,001 evenly spaced collateral-to-short
ratios from 10% to 45%. The illustrative 1,500 USD collateral against a 3,950 USD
short produces a 75.95 Safety Buffer, placing it at the 80th percentile of that
bounded reference cohort.

This is deliberately labelled as a DeltaZero reference cohort. It is not a
sample of active Hyperliquid accounts and must not be presented as a live-market
ranking.
