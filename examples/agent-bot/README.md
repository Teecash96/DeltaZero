# DeltaZero Agent-in-a-Box

A single executable Node.js example that simulates a drifting SOL hedge, calls
DeltaZero's live Position Auditor, handles an x402 payment challenge through the
Onchain OS CLI, and prints an exact rebalance payload. It never executes a trade.

## Requirements

- Node.js 20 or newer
- `onchainos` installed and logged in when using paid mode
- A funded wallet on the payment network

## Run

Review the payment cap, then explicitly enable automatic payment for this demo:

```bash
DELTAZERO_AUTO_PAY=1 \
DELTAZERO_MAX_PAYMENT_BASE_UNITS=10000 \
node examples/agent-bot/agent-bot.mjs
```

The default maximum is `10000` base units, matching the current DeltaZero
challenge. The script stops instead of signing if a server requests more.

For owner-only testing, `DELTAZERO_ADMIN_KEY` can be supplied in the shell. Never
commit that key or expose it in browser code.

Useful controls:

```bash
DELTAZERO_POLL_MS=1000
DELTAZERO_MAX_ITERATIONS=6
DELTAZERO_API_BASE=https://deltazero-production.up.railway.app
```

## Safety model

- Payment requires the explicit `DELTAZERO_AUTO_PAY=1` opt-in.
- The payment amount is capped before signing.
- Authorization is produced by `onchainos payment pay`; this script does not
  assemble payment proofs itself.
- The final execution object is printed with `mode: "PROPOSAL_ONLY"` and is not
  broadcast to a venue.
