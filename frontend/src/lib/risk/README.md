# Deterministic risk core

The functions in this directory implement the improved Risk Score System as
pure TypeScript. They do not call a protocol, wallet, model, database, or
payment service.

The common scores are:

* `DQ`: data quality from completeness, freshness, source trust, and replay consistency.
* `DC`: decision confidence from input completeness, DQ, deterministic replay, and endpoint reliability.
* `FS`: functionality from availability, p95 latency, schema validity, and payment validity.
* `DZS`: `0.50 * category safety buffer + 0.25 * DC + 0.15 * DQ + 0.10 * FS`.

Category calculators implement the Health Factor, Yield Optimisation,
Rebalancing, and Grid Trading formulas. All outputs are clipped to `0..100`.
Missing grid inputs withhold their formula weight and expose a
`dataQualityPenalty` instead of silently inventing a value.

Use `mapRiskStatus` only after the score envelope is complete. Missing, stale,
or invalid critical data maps to `AVOID`.
