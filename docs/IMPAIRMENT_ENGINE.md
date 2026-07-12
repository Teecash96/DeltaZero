# DeltaZero Impairment Engine

## Purpose

DeltaZero's impairment engine is a scenario-based economic impairment model. It is not an accounting standard implementation and it is not intended to represent formal IFRS or tax impairment treatment.

The engine estimates how much portfolio equity is lost under a stressed scenario by comparing pre-stress equity with post-stress equity after deterministic losses and offsets are applied.

## Model

The calculation uses a portfolio-equity approach:

```text
pre_stress_equity_usd =
    long_notional_usd
    + collateral_usd
    + existing_unrealized_pnl_usd
    - liabilities_usd

post_stress_equity_usd =
    stressed_long_value_usd
    + stressed_short_pnl_usd
    + stressed_collateral_value_usd
    + existing_unrealized_pnl_usd
    - stressed_liabilities_usd
    - exit_slippage_usd
    - liquidation_penalty_usd
    - protocol_loss_assumption_usd

estimated_impairment_loss_usd =
    max(0, pre_stress_equity_usd - post_stress_equity_usd)

estimated_impairment_loss_pct =
    estimated_impairment_loss_usd / pre_stress_equity_usd * 100

post_impairment_equity_usd =
    max(0, post_stress_equity_usd)
```

## Breakdown Fields

The response includes an `impairment_breakdown` object with the following deterministic components:

- `asset_value_impact_usd`
- `hedge_pnl_impact_usd`
- `collateral_haircut_usd`
- `exit_slippage_usd`
- `liquidation_penalty_usd`
- `protocol_loss_assumption_usd`

These fields are designed to be additive loss components without double counting the same stress effect in multiple places.

## Scenario Inputs

Stress test requests may optionally provide:

- `asset_price_change_pct`
- `collateral_haircut_pct`
- `exit_slippage_pct`
- `liquidation_penalty_pct`
- `protocol_loss_pct`

If a field is omitted, deterministic defaults are selected from the scenario type.

## Supported Scenario Types

- `funding_worsens`
- `yield_drops`
- `price_drop`
- `price_rise`

## Design Notes

- The engine is deterministic.
- Short exposure offsets long price impairment when present.
- Exit slippage and liquidation penalties increase impairment independently.
- The final impairment percentage is bounded between 0 and 100.

## Limitations

- The engine models economic impairment, not accounting impairment.
- It depends on user-supplied notionals and scenario assumptions.
- It is not a substitute for protocol-specific liquidation analysis or formal accounting treatment.
