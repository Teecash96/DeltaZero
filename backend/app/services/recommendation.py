"""Strategy health, recommendations, and action selection."""

from dataclasses import dataclass
from typing import Literal

from app.config import DECISION_PROFILES, DecisionProfile, StrategyAction, StrategyHealth
from app.models.schemas import Metrics, Recommendation

CarryState = Literal["negative", "insufficient", "positive"]
HedgeState = Literal["aligned", "watch", "severe"]
SafetyBufferState = Literal["strong", "watch", "weak"]
CapitalRiskState = Literal["manageable", "elevated", "severe"]


@dataclass(frozen=True)
class DecisionContext:
    """Single evaluated view of the metrics and risk thresholds."""

    metrics: Metrics
    risk_tolerance: str
    profile: DecisionProfile
    capital_base_usd: float
    carry_state: CarryState
    hedge_state: HedgeState
    safety_buffer_state: SafetyBufferState
    capital_risk_state: CapitalRiskState


def evaluate_decision_context(
    metrics: Metrics,
    risk_tolerance: str,
    capital_base_usd: float,
) -> DecisionContext:
    """Evaluate all decision states once and reuse them everywhere."""
    profile = DECISION_PROFILES[risk_tolerance]

    if metrics.estimated_net_carry_apy < 0:
        carry_state: CarryState = "negative"
    elif metrics.estimated_net_carry_apy < profile.min_net_carry_apy_for_open:
        carry_state = "insufficient"
    else:
        carry_state = "positive"

    if metrics.hedge_drift_pct >= profile.hedge_drift_critical_pct:
        hedge_state: HedgeState = "severe"
    elif metrics.hedge_drift_pct >= profile.hedge_drift_warning_pct:
        hedge_state = "watch"
    else:
        hedge_state = "aligned"

    if metrics.safety_buffer_score <= profile.safety_buffer_critical:
        safety_buffer_state: SafetyBufferState = "weak"
    elif metrics.safety_buffer_score <= profile.safety_buffer_warning:
        safety_buffer_state = "watch"
    else:
        safety_buffer_state = "strong"

    capital_risk_pct = (
        (metrics.capital_at_risk_proxy / capital_base_usd) * 100.0
        if capital_base_usd > 0
        else 0.0
    )
    if capital_risk_pct >= profile.capital_risk_critical_pct:
        capital_risk_state: CapitalRiskState = "severe"
    elif capital_risk_pct >= profile.capital_risk_warning_pct:
        capital_risk_state = "elevated"
    else:
        capital_risk_state = "manageable"

    return DecisionContext(
        metrics=metrics,
        risk_tolerance=risk_tolerance,
        profile=profile,
        capital_base_usd=capital_base_usd,
        carry_state=carry_state,
        hedge_state=hedge_state,
        safety_buffer_state=safety_buffer_state,
        capital_risk_state=capital_risk_state,
    )


def assess_strategy_health(context: DecisionContext) -> StrategyHealth:
    """Map the evaluated decision context to a discrete health state."""
    if (
        context.carry_state == "negative"
        or context.hedge_state == "severe"
        or context.safety_buffer_state == "weak"
        or context.capital_risk_state == "severe"
    ):
        return "critical"

    if (
        context.carry_state == "insufficient"
        or context.hedge_state == "watch"
        or context.safety_buffer_state == "watch"
        or context.capital_risk_state == "elevated"
    ):
        return "warning"

    return "healthy"


def _severe_condition_count(context: DecisionContext) -> int:
    return sum(
        [
            context.carry_state == "negative",
            context.hedge_state == "severe",
            context.safety_buffer_state == "weak",
            context.capital_risk_state == "severe",
        ]
    )


def _carry_summary(context: DecisionContext) -> str:
    carry = context.metrics.estimated_net_carry_apy
    if context.carry_state == "negative":
        return f"Estimated net carry ({carry:.1f}% APY) is negative."
    if context.carry_state == "insufficient":
        return f"Estimated net carry ({carry:.1f}% APY) is below the opening threshold."
    return f"Estimated net carry ({carry:.1f}% APY) meets the opening threshold."


def _hedge_summary(context: DecisionContext) -> str:
    drift = context.metrics.hedge_drift_pct
    if context.hedge_state == "severe":
        return f"Hedge drift is {drift:.1f}% — rebalance the short leg toward neutral."
    if context.hedge_state == "watch":
        return f"Hedge drift is {drift:.1f}% — keep the hedge under close review."
    return f"Hedge drift is {drift:.1f}% — alignment is within tolerance."


def _safety_buffer_summary(context: DecisionContext) -> str:
    buffer_score = context.metrics.safety_buffer_score
    if context.safety_buffer_state == "weak":
        return f"Safety Buffer score is {buffer_score:.1f} — add collateral to support the hedge."
    if context.safety_buffer_state == "watch":
        return f"Safety Buffer score is {buffer_score:.1f} — the reserve is getting tight."
    return f"Safety Buffer score is {buffer_score:.1f} — collateral support is acceptable."


def _capital_risk_summary(context: DecisionContext) -> str:
    capital_risk = context.metrics.capital_at_risk_proxy
    capital_pct = (
        (capital_risk / context.capital_base_usd) * 100.0
        if context.capital_base_usd > 0
        else 0.0
    )
    if context.capital_risk_state == "severe":
        return f"Capital at risk proxy is {capital_risk:.1f} ({capital_pct:.1f}% of deployed capital) — reduce size or add collateral."
    if context.capital_risk_state == "elevated":
        return f"Capital at risk proxy is {capital_risk:.1f} ({capital_pct:.1f}% of deployed capital) — monitor exposure carefully."
    return f"Capital at risk proxy is {capital_risk:.1f} ({capital_pct:.1f}% of deployed capital) — exposure remains manageable."


def build_risk_notes(context: DecisionContext) -> list[str]:
    """Generate deterministic risk notes from the evaluated context."""
    notes: list[str] = []

    if context.capital_risk_state in {"severe", "elevated"}:
        notes.append(_capital_risk_summary(context))

    if context.safety_buffer_state in {"weak", "watch"}:
        notes.append(_safety_buffer_summary(context))

    if context.hedge_state in {"severe", "watch"}:
        notes.append(_hedge_summary(context))

    if context.carry_state in {"negative", "insufficient"}:
        notes.append(_carry_summary(context))

    if not notes:
        notes.append(
            "Carry, hedge alignment, Safety Buffer, and capital risk are within acceptable ranges."
        )

    return notes


def recommend_for_build(context: DecisionContext) -> Recommendation:
    """Recommend OPEN, WAIT, or REBALANCE for a new strategy build."""
    if context.carry_state != "positive":
        return Recommendation(
            action="WAIT",
            summary=_carry_summary(context) + " Do not open yet.",
        )

    if context.safety_buffer_state != "strong":
        return Recommendation(
            action="WAIT",
            summary=_safety_buffer_summary(context) + " Do not open yet.",
        )

    if context.capital_risk_state != "manageable":
        return Recommendation(
            action="WAIT",
            summary=_capital_risk_summary(context) + " Do not open yet.",
        )

    if context.hedge_state != "aligned":
        return Recommendation(
            action="REBALANCE",
            summary=(
                "Carry is acceptable, but hedge drift is outside tolerance. "
                "Rebalance the short leg before opening."
            ),
        )

    return Recommendation(
        action="OPEN",
        summary=(
            "Deploy the neutral carry structure. Net carry, hedge alignment, "
            "Safety Buffer, and capital risk meet the entry criteria."
        ),
    )


def recommend_for_audit(context: DecisionContext) -> Recommendation:
    """Recommend a management action for an existing strategy."""
    severe_count = _severe_condition_count(context)

    if severe_count >= 2:
        return Recommendation(
            action="CLOSE",
            summary=(
                "Multiple severe conditions are present. Close or materially de-risk the position."
            ),
        )

    if context.capital_risk_state == "severe" or context.safety_buffer_state == "weak":
        return Recommendation(
            action="REDUCE",
            summary=(
                "Reduce size or add collateral. Safety Buffer and capital risk are too strained."
            ),
        )

    if context.hedge_state != "aligned":
        return Recommendation(
            action="REBALANCE",
            summary=(
                f"Hedge drift is {context.metrics.hedge_drift_pct:.1f}% — rebalance the short hedge toward the long notional."
            ),
        )

    if context.carry_state == "negative":
        return Recommendation(
            action="REDUCE",
            summary=(
                "Estimated net carry is negative. Reduce exposure or improve the carry profile."
            ),
        )

    if context.carry_state == "insufficient":
        return Recommendation(
            action="HOLD",
            summary=(
                "Carry is positive but below the preferred threshold. Hold the position and monitor."
            ),
        )

    if context.capital_risk_state == "elevated":
        return Recommendation(
            action="HOLD",
            summary=(
                "Hold the position, but keep an eye on capital risk and Safety Buffer levels."
            ),
        )

    if context.safety_buffer_state == "watch":
        return Recommendation(
            action="HOLD",
            summary=(
                "Hold the position, but keep an eye on capital risk and Safety Buffer levels."
            ),
        )

    return Recommendation(
        action="HOLD",
        summary="Maintain the current structure. Metrics are within healthy ranges.",
    )


def actions_for_recommendation(
    recommendation: Recommendation,
    context: DecisionContext,
) -> list[StrategyAction]:
    """Derive an ordered action list from the primary recommendation."""
    actions: list[StrategyAction] = [recommendation.action]

    if recommendation.action == "REBALANCE" and context.capital_risk_state != "manageable":
        actions.append("REDUCE")

    if recommendation.action == "HOLD" and context.carry_state == "insufficient":
        actions.append("REBALANCE")

    if recommendation.action == "REDUCE" and context.capital_risk_state == "severe" and "CLOSE" not in actions:
        actions.append("CLOSE")

    return actions


def strategy_name_for(asset: str, target_style: str = "neutral_yield") -> str:
    """Generate a deterministic strategy name."""
    style_label = "Neutral Yield Carry" if target_style == "neutral_yield" else target_style
    return f"{asset} {style_label}"
