"""Deterministic evaluation of client-owned strategy memory."""

from statistics import fmean

from app.models.registry import RegistryEvaluationRequest, RegistryEvaluationResponse


def _average(values: list[float]) -> float | None:
    return round(fmean(values), 2) if values else None


def evaluate_strategy_registry(request: RegistryEvaluationRequest) -> RegistryEvaluationResponse:
    decisions = request.decisions
    observed = [decision for decision in decisions if decision.outcome_status is not None]
    breakdown = {
        status: sum(decision.outcome_status == status for decision in observed)
        for status in (
            "within_tolerance",
            "avoided_loss",
            "exceeded_risk",
            "not_executed",
            "incomplete",
        )
    }
    exceeded = breakdown["exceeded_risk"]
    coverage = len(observed) / len(decisions) * 100
    exceeded_rate = exceeded / len(observed) * 100 if observed else 0

    signals: list[str] = []
    if coverage < 50:
        signals.append("Outcome coverage is below 50%; collect more observations before revising policy.")
    if exceeded:
        signals.append(
            f"{exceeded} observed outcome(s) exceeded expected risk; review their shared asset, recommendation, and stress assumptions."
        )
    if breakdown["not_executed"]:
        signals.append("Separate non-executed recommendations from performance evaluation to avoid selection bias.")
    if len(observed) >= 5 and not exceeded:
        signals.append("No observed risk exceptions are recorded, but the sample remains user-supplied and is not external validation.")
    if not signals:
        signals.append("Record additional observed outcomes to produce a meaningful refinement signal.")

    return RegistryEvaluationResponse(
        decision_count=len(decisions),
        observed_count=len(observed),
        outcome_coverage_pct=round(coverage, 2),
        exceeded_risk_count=exceeded,
        exceeded_risk_rate_pct=round(exceeded_rate, 2),
        average_realized_return_pct=_average([
            decision.realized_return_pct for decision in observed if decision.realized_return_pct is not None
        ]),
        average_max_drawdown_pct=_average([
            decision.max_drawdown_pct for decision in observed if decision.max_drawdown_pct is not None
        ]),
        average_final_safety_buffer=_average([
            decision.final_safety_buffer for decision in observed if decision.final_safety_buffer is not None
        ]),
        outcome_breakdown=breakdown,
        refinement_signals=signals,
        limitations=[
            "Registry observations are supplied by the client and are not independently verified.",
            "DeltaZero does not persist this request or silently change decision thresholds.",
            "Registry evaluation is evidence organization, not model training or profitability forecasting.",
        ],
    )
