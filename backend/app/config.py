"""Application constants and allocation heuristics."""

from typing import Literal

SUPPORTED_ASSETS = ("SOL", "ETH")
RiskTolerance = Literal["low", "medium", "high"]
TargetStyle = Literal["neutral_yield"]
StrategyAction = Literal["OPEN", "WAIT", "HOLD", "REBALANCE", "REDUCE", "CLOSE"]
StrategyHealth = Literal["healthy", "warning", "critical"]
ScenarioType = Literal["funding_worsens", "price_drop", "price_rise", "yield_drops"]

SERVICE_NAME = "deltazero"

# Capital allocation fractions by risk tolerance (heuristic, sums long+collateral ≈ 1.0).
BUILD_ALLOCATION: dict[str, dict[str, float]] = {
    "low": {"long_pct": 0.72, "short_pct": 0.58, "collateral_pct": 0.28},
    "medium": {"long_pct": 0.76, "short_pct": 0.60, "collateral_pct": 0.24},
    "high": {"long_pct": 0.80, "short_pct": 0.65, "collateral_pct": 0.18},
}

# Thresholds for deterministic health and action logic.
HEDGE_DRIFT_WARNING_PCT = 8.0
HEDGE_DRIFT_CRITICAL_PCT = 15.0
SAFETY_BUFFER_WARNING = 45.0
SAFETY_BUFFER_CRITICAL = 25.0
MIN_NET_CARRY_APY_FOR_OPEN = 2.0
MIN_MARGIN_RATIO = 0.10
