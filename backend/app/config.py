"""Application constants and allocation heuristics."""

from dataclasses import dataclass
from typing import Literal

SUPPORTED_ASSETS = ("SOL", "ETH")
RiskTolerance = Literal["low", "medium", "high"]
TargetStyle = Literal[
    "neutral_yield",
    "conservative_income",
    "aggressive_carry",
    "capital_preservation",
]
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
    impairment_warning_pct: float
    impairment_critical_pct: float
    style_label: str


@dataclass(frozen=True)
class WalletRiskProfile:
    """Deterministic thresholds for the read-only wallet auditor."""

    hedge_drift_warning_pct: float
    hedge_drift_critical_pct: float
    safety_buffer_warning: float
    safety_buffer_critical: float
    capital_risk_warning_pct: float
    capital_risk_critical_pct: float
    impairment_warning_pct: float
    impairment_critical_pct: float
    minimum_health_factor: float

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
        impairment_warning_pct=8.0,
        impairment_critical_pct=16.0,
        style_label="Low Risk",
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
        impairment_warning_pct=10.0,
        impairment_critical_pct=20.0,
        style_label="Medium Risk",
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
        impairment_warning_pct=12.0,
        impairment_critical_pct=24.0,
        style_label="High Risk",
    ),
}

MIN_MARGIN_RATIO = 0.10

BUILDER_STYLE_PROFILES: dict[TargetStyle, DecisionProfile] = {
    "neutral_yield": DecisionProfile(
        target_hedge_ratio=0.96,
        collateral_reserve_pct=0.24,
        hedge_drift_warning_pct=6.0,
        hedge_drift_critical_pct=12.0,
        safety_buffer_warning=60.0,
        safety_buffer_critical=40.0,
        min_net_carry_apy_for_open=2.0,
        capital_risk_warning_pct=18.0,
        capital_risk_critical_pct=28.0,
        impairment_warning_pct=10.0,
        impairment_critical_pct=20.0,
        style_label="Neutral Yield",
    ),
    "conservative_income": DecisionProfile(
        target_hedge_ratio=0.985,
        collateral_reserve_pct=0.34,
        hedge_drift_warning_pct=4.0,
        hedge_drift_critical_pct=8.0,
        safety_buffer_warning=75.0,
        safety_buffer_critical=58.0,
        min_net_carry_apy_for_open=1.0,
        capital_risk_warning_pct=14.0,
        capital_risk_critical_pct=22.0,
        impairment_warning_pct=6.0,
        impairment_critical_pct=14.0,
        style_label="Conservative Income",
    ),
    "aggressive_carry": DecisionProfile(
        target_hedge_ratio=0.94,
        collateral_reserve_pct=0.22,
        hedge_drift_warning_pct=7.0,
        hedge_drift_critical_pct=14.0,
        safety_buffer_warning=55.0,
        safety_buffer_critical=38.0,
        min_net_carry_apy_for_open=3.0,
        capital_risk_warning_pct=24.0,
        capital_risk_critical_pct=34.0,
        impairment_warning_pct=14.0,
        impairment_critical_pct=28.0,
        style_label="Aggressive Carry",
    ),
    "capital_preservation": DecisionProfile(
        target_hedge_ratio=0.99,
        collateral_reserve_pct=0.42,
        hedge_drift_warning_pct=3.0,
        hedge_drift_critical_pct=6.0,
        safety_buffer_warning=82.0,
        safety_buffer_critical=68.0,
        min_net_carry_apy_for_open=0.5,
        capital_risk_warning_pct=10.0,
        capital_risk_critical_pct=18.0,
        impairment_warning_pct=4.0,
        impairment_critical_pct=10.0,
        style_label="Capital Preservation",
    ),
}

TARGET_STYLE_LABELS: dict[TargetStyle, str] = {
    "neutral_yield": "Neutral Yield",
    "conservative_income": "Conservative Income",
    "aggressive_carry": "Aggressive Carry",
    "capital_preservation": "Capital Preservation",
}

WALLET_RISK_PROFILES: dict[str, WalletRiskProfile] = {
    "standard": WalletRiskProfile(
        hedge_drift_warning_pct=6.0,
        hedge_drift_critical_pct=12.0,
        safety_buffer_warning=60.0,
        safety_buffer_critical=40.0,
        capital_risk_warning_pct=18.0,
        capital_risk_critical_pct=30.0,
        impairment_warning_pct=8.0,
        impairment_critical_pct=18.0,
        minimum_health_factor=1.2,
    ),
    "elevated": WalletRiskProfile(
        hedge_drift_warning_pct=5.0,
        hedge_drift_critical_pct=10.0,
        safety_buffer_warning=68.0,
        safety_buffer_critical=48.0,
        capital_risk_warning_pct=14.0,
        capital_risk_critical_pct=24.0,
        impairment_warning_pct=6.0,
        impairment_critical_pct=14.0,
        minimum_health_factor=1.3,
    ),
    "strict": WalletRiskProfile(
        hedge_drift_warning_pct=4.0,
        hedge_drift_critical_pct=8.0,
        safety_buffer_warning=74.0,
        safety_buffer_critical=56.0,
        capital_risk_warning_pct=10.0,
        capital_risk_critical_pct=18.0,
        impairment_warning_pct=4.0,
        impairment_critical_pct=10.0,
        minimum_health_factor=1.4,
    ),
}

IMPAIRMENT_DEFAULTS: dict[str, dict[str, float]] = {
    "funding_worsens": {
        "asset_price_change_pct": 0.0,
        "collateral_haircut_pct": 0.0,
        "exit_slippage_pct": 0.25,
        "liquidation_penalty_pct": 0.5,
        "protocol_loss_pct": 0.1,
    },
    "yield_drops": {
        "asset_price_change_pct": 0.0,
        "collateral_haircut_pct": 0.0,
        "exit_slippage_pct": 0.2,
        "liquidation_penalty_pct": 0.25,
        "protocol_loss_pct": 0.35,
    },
    "price_drop": {
        "asset_price_change_pct": -8.0,
        "collateral_haircut_pct": 4.0,
        "exit_slippage_pct": 0.45,
        "liquidation_penalty_pct": 1.0,
        "protocol_loss_pct": 0.4,
    },
    "price_rise": {
        "asset_price_change_pct": 8.0,
        "collateral_haircut_pct": 1.0,
        "exit_slippage_pct": 0.35,
        "liquidation_penalty_pct": 0.5,
        "protocol_loss_pct": 0.2,
    },
}
