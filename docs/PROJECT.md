# DeltaZero

DeltaZero is an OKX.AI Agent Service Provider for pseudo-delta-neutral DeFi risk management.

It helps users and autonomous agents:

1. Build a neutral carry strategy
2. Audit an existing long and short position
3. Stress test the strategy under price, funding, and yield changes

The strategy consists of:

1. A spot or yield-generating long leg
2. A perpetual short hedge
3. Reserve margin supporting the hedge

The product returns deterministic metrics and an action such as OPEN, WAIT, HOLD, REBALANCE, REDUCE, or CLOSE.

## MVP limitations

This is a hackathon MVP.

Do not add:

1. Authentication
2. Wallet connection
3. Database
4. Real trading
5. Live protocol integrations
6. Multi-chain infrastructure
7. Charts or trading terminals
8. Chatbot features

Supported assets:

1. SOL
2. ETH

Supported services:

1. POST /strategy/build
2. POST /strategy/audit
3. POST /strategy/stress-test
