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
