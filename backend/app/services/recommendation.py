"""Strategy health, recommendations, and action selection."""

from app.config import (
    HEDGE_DRIFT_CRITICAL_PCT,
    HEDGE_DRIFT_WARNING_PCT,
    MIN_NET_CARRY_APY_FOR_OPEN,
    SAFETY_BUFFER_CRITICAL,
    SAFETY_BUFFER_WARNING,
    StrategyAction,
    StrategyHealth,
)
from app.models.schemas import Metrics, Recommendation


def assess_strategy_health(metrics: Metrics) -> StrategyHealth:
    """Map metrics to a discrete health state."""
    if (
        metrics.hedge_drift_pct >= HEDGE_DRIFT_CRITICAL_PCT
        or metrics.safety_buffer_score <= SAFETY_BUFFER_CRITICAL
        or metrics.estimated_net_carry_apy < 0
    ):
        return "critical"

    if (
        metrics.hedge_drift_pct >= HEDGE_DRIFT_WARNING_PCT
        or metrics.safety_buffer_score <= SAFETY_BUFFER_WARNING
        or metrics.estimated_net_carry_apy < MIN_NET_CARRY_APY_FOR_OPEN
    ):
        return "warning"

    return "healthy"


def build_risk_notes(metrics: Metrics, health: StrategyHealth) -> list[str]:
    """Generate deterministic risk notes from metrics."""
    notes: list[str] = []

    if metrics.hedge_drift_pct >= HEDGE_DRIFT_WARNING_PCT:
        notes.append(
            f"Hedge drift is {metrics.hedge_drift_pct:.1f}% — rebalance short leg toward neutral."
        )

    if metrics.safety_buffer_score <= SAFETY_BUFFER_WARNING:
        notes.append(
            f"Safety Buffer score is {metrics.safety_buffer_score:.1f} — add collateral to support the hedge."
        )

    if metrics.estimated_net_carry_apy < MIN_NET_CARRY_APY_FOR_OPEN:
        notes.append(
            f"Estimated net carry ({metrics.estimated_net_carry_apy:.1f}% APY) is below target threshold."
        )

    if metrics.net_delta_estimate > 5:
        notes.append(
            f"Net delta estimate is +{metrics.net_delta_estimate:.1f}% — long exposure dominates."
        )
    elif metrics.net_delta_estimate < -5:
        notes.append(
            f"Net delta estimate is {metrics.net_delta_estimate:.1f}% — short exposure dominates."
        )

    if not notes:
        if health == "healthy":
            notes.append("Hedge alignment and Safety Buffer are within acceptable ranges.")
        else:
            notes.append("Monitor carry efficiency and hedge drift on a regular cadence.")

    return notes


def recommend_for_build(metrics: Metrics, health: StrategyHealth) -> Recommendation:
    """Recommend OPEN or WAIT for a new strategy build."""
    if (
        health == "healthy"
        and metrics.estimated_net_carry_apy >= MIN_NET_CARRY_APY_FOR_OPEN
        and metrics.safety_buffer_score > SAFETY_BUFFER_WARNING
    ):
        return Recommendation(
            action="OPEN",
            summary=(
                "Deploy the neutral carry structure. Net carry and Safety Buffer "
                "meet medium-risk entry criteria."
            ),
        )

    if health == "critical" or metrics.estimated_net_carry_apy < 0:
        return Recommendation(
            action="WAIT",
            summary=(
                "Do not open yet. Carry is negative or Safety Buffer is insufficient "
                "for the proposed structure."
            ),
        )

    return Recommendation(
        action="WAIT",
        summary=(
            "Hold off on deployment until carry improves or allocation is adjusted "
            "to strengthen the Safety Buffer."
        ),
    )


def recommend_for_audit(metrics: Metrics, health: StrategyHealth) -> Recommendation:
    """Recommend position management action for an existing strategy."""
    if health == "critical":
        if metrics.safety_buffer_score <= SAFETY_BUFFER_CRITICAL:
            return Recommendation(
                action="REDUCE",
                summary=(
                    "Reduce short exposure or add collateral immediately. "
                    "Safety Buffer is critically low."
                ),
            )
        return Recommendation(
            action="CLOSE",
            summary=(
                "Close or materially de-risk the position. Hedge drift or carry "
                "has reached critical levels."
            ),
        )

    if metrics.hedge_drift_pct >= HEDGE_DRIFT_WARNING_PCT:
        return Recommendation(
            action="REBALANCE",
            summary=(
                "Rebalance the short hedge toward the long notional to restore "
                "pseudo-delta-neutral alignment."
            ),
        )

    if health == "warning":
        return Recommendation(
            action="HOLD",
            summary=(
                "Hold the position but monitor Safety Buffer and carry efficiency closely."
            ),
        )

    return Recommendation(
        action="HOLD",
        summary="Maintain the current structure. Metrics are within healthy ranges.",
    )


def actions_for_recommendation(
    recommendation: Recommendation,
    health: StrategyHealth,
) -> list[StrategyAction]:
    """Derive ordered action list from primary recommendation."""
    actions: list[StrategyAction] = [recommendation.action]

    if recommendation.action == "REBALANCE" and health != "healthy":
        actions.append("REDUCE")

    if recommendation.action == "HOLD" and health == "warning":
        actions.append("REBALANCE")

    return actions


def strategy_name_for(asset: str, target_style: str = "neutral_yield") -> str:
    """Generate a deterministic strategy name."""
    style_label = "Neutral Yield Carry" if target_style == "neutral_yield" else target_style
    return f"{asset} {style_label}"
