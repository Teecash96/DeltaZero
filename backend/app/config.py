"""Application constants and allocation heuristics."""

from dataclasses import dataclass
from typing import Literal

SUPPORTED_ASSETS = ("SOL", "ETH")
RiskTolerance = Literal["low", "medium", "high"]
TargetStyle = Literal["neutral_yield"]
StrategyAction = Literal["OPEN", "WAIT", "HOLD", "REBALANCE", "REDUCE", "CLOSE"]
StrategyHealth = Literal["healthy", "warning", "critical"]
ScenarioType = Literal["funding_worsens", "price_drop", "price_rise", "yield_drops"]


@dataclass(frozen=True)
class DecisionProfile:
    """Deterministic thresholds and allocation targets for a risk tolerance band."""

    target_hedge_ratio: float
    collateral_reserve_pct: float
    hedge_drift_warning_pct: float
    hedge_drift_critical_pct: float
    safety_buffer_warning: float
    safety_buffer_critical: float
    min_net_carry_apy_for_open: float
    capital_risk_warning_pct: float
    capital_risk_critical_pct: float

SERVICE_NAME = "deltazero"

# Capital allocation and decision thresholds by risk tolerance.
#
# The builder reserves a fixed capital slice for collateral, then sizes the
# short hedge from the long notional and a target hedge ratio. Thresholds are
# deliberately tighter for low risk and looser for high risk, but the builder
# still expects a near-neutral hedge for all profiles.
DECISION_PROFILES: dict[str, DecisionProfile] = {
    "low": DecisionProfile(
        target_hedge_ratio=0.92,
        collateral_reserve_pct=0.30,
        hedge_drift_warning_pct=4.0,
        hedge_drift_critical_pct=8.0,
        safety_buffer_warning=70.0,
        safety_buffer_critical=50.0,
        min_net_carry_apy_for_open=3.0,
        capital_risk_warning_pct=12.0,
        capital_risk_critical_pct=20.0,
    ),
    "medium": DecisionProfile(
        target_hedge_ratio=0.96,
        collateral_reserve_pct=0.24,
        hedge_drift_warning_pct=6.0,
        hedge_drift_critical_pct=12.0,
        safety_buffer_warning=60.0,
        safety_buffer_critical=40.0,
        min_net_carry_apy_for_open=2.0,
        capital_risk_warning_pct=18.0,
        capital_risk_critical_pct=28.0,
    ),
    "high": DecisionProfile(
        target_hedge_ratio=0.98,
        collateral_reserve_pct=0.18,
        hedge_drift_warning_pct=8.0,
        hedge_drift_critical_pct=16.0,
        safety_buffer_warning=50.0,
        safety_buffer_critical=35.0,
        min_net_carry_apy_for_open=1.0,
        capital_risk_warning_pct=22.0,
        capital_risk_critical_pct=32.0,
    ),
}

MIN_MARGIN_RATIO = 0.10
