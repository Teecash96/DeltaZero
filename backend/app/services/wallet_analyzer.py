"""Read-only wallet portfolio analysis service."""

from __future__ import annotations

from collections import defaultdict, deque
import os
from threading import Lock
from time import time

from app.config import DecisionProfile, WalletRiskProfile, WALLET_RISK_PROFILES
from app.integrations.base import WalletAdapter
from app.integrations.registry import DEFAULT_ADAPTER_REGISTRY
from app.models.impairment import ImpairmentBreakdown, ImpairmentResult
from app.models.schemas import Metrics
from app.models.wallet import (
    NormalizedPosition,
    ProtocolError,
    WalletAnalyzeRequest,
    WalletAllocationItem,
    WalletAssessmentStatus,
    WalletExecutiveSummary,
    WalletExposureAnalysis,
    WalletPlanStep,
    WalletPortfolioResponse,
    WalletPortfolioSummary,
    WalletPrimaryDriver,
    WalletRiskContributor,
    WalletRiskTimelineItem,
    WalletRecommendation,
    WalletRiskMetrics,
    WalletStrategyHealth,
    WalletStressSummary,
)
from app.services.impairment import calculate_impairment
from app.services.position_normalizer import _coerce_float  # type: ignore[attr-defined]
from app.services.recommendation import (
    DecisionContext,
    calculate_decision_confidence,
    evaluate_decision_context,
)
from app.services.wallet_report import build_wallet_intelligence_report

WALLET_CACHE_TTL_SECONDS = 120.0
WALLET_RATE_LIMIT_PER_MINUTE = 6
WALLET_REQUEST_CACHE: dict[str, tuple[float, WalletPortfolioResponse]] = {}
WALLET_REQUEST_LOG: dict[str, deque[float]] = defaultdict(deque)
WALLET_LOCK = Lock()
def _cache_key(request: WalletAnalyzeRequest) -> str:
    return "|".join(
        [
            request.wallet_address.lower(),
            ",".join(request.networks),
            ",".join(request.protocols),
            request.stress_profile,
            str(_wallet_debug_enabled()),
        ]
    )


def _wallet_debug_enabled() -> bool:
    return os.getenv("WALLET_DEBUG_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}


def _normalise_profile(stress_profile: str) -> DecisionProfile:
    profile = WALLET_RISK_PROFILES[stress_profile]
    return DecisionProfile(
        target_hedge_ratio=0.97,
        collateral_reserve_pct=0.30,
        hedge_drift_warning_pct=profile.hedge_drift_warning_pct,
        hedge_drift_critical_pct=profile.hedge_drift_critical_pct,
        safety_buffer_warning=profile.safety_buffer_warning,
        safety_buffer_critical=profile.safety_buffer_critical,
        min_net_carry_apy_for_open=0.0,
        capital_risk_warning_pct=profile.capital_risk_warning_pct,
        capital_risk_critical_pct=profile.capital_risk_critical_pct,
        impairment_warning_pct=profile.impairment_warning_pct,
        impairment_critical_pct=profile.impairment_critical_pct,
        style_label=stress_profile.title(),
    )


def _wallet_profile(stress_profile: str) -> WalletRiskProfile:
    return WALLET_RISK_PROFILES[stress_profile]


def _select_adapters(networks: list[str], protocols: list[str]) -> list[WalletAdapter]:
    return DEFAULT_ADAPTER_REGISTRY.resolve(networks, protocols)


def _positions_by_asset(positions: list[NormalizedPosition]) -> dict[str, list[NormalizedPosition]]:
    clusters: dict[str, list[NormalizedPosition]] = defaultdict(list)
    for position in positions:
        clusters[position.asset].append(position)
    return clusters


def _sum(values: list[float | None]) -> float:
    return round(sum(value for value in values if value is not None), 2)


def _mean_weighted(values: list[tuple[float, float | None]]) -> float | None:
    weighted_total = 0.0
    weights = 0.0
    for weight, value in values:
        if value is None or weight <= 0:
            continue
        weighted_total += weight * value
        weights += weight
    if weights <= 0:
        return None
    return round(weighted_total / weights, 2)


def _asset_shock(profile: str, net_delta_usd: float) -> float:
    magnitude = {"standard": 8.0, "elevated": 12.0, "strict": 16.0}[profile]
    return -magnitude if net_delta_usd >= 0 else magnitude


def _impairment_for_cluster(asset: str, cluster: list[NormalizedPosition], stress_profile: str) -> ImpairmentResult:
    long_notional = _sum([p.current_value_usd for p in cluster if p.position_type in {"spot", "lending_supply", "vault_deposit", "perpetual_long", "collateral"}])
    short_notional = _sum([p.notional_usd for p in cluster if p.position_type in {"perpetual_short", "lending_borrow"}])
    collateral = _sum([p.collateral_usd for p in cluster])
    pnl = _sum([p.unrealized_pnl_usd for p in cluster])
    liabilities = _sum([p.debt_usd for p in cluster])
    net_delta = long_notional - short_notional
    asset_price_change_pct = _asset_shock(stress_profile, net_delta)
    defaults = {"standard": (4.0, 0.4, 0.5, 0.25), "elevated": (6.0, 0.6, 0.8, 0.4), "strict": (8.0, 0.9, 1.2, 0.6)}[stress_profile]
    collateral_haircut_pct, exit_slippage_pct, liquidation_penalty_pct, protocol_loss_pct = defaults
    return calculate_impairment(
        long_notional_usd=long_notional,
        short_notional_usd=short_notional,
        collateral_usd=collateral,
        existing_unrealized_pnl_usd=pnl,
        liabilities_usd=liabilities,
        asset_price_change_pct=asset_price_change_pct,
        collateral_haircut_pct=collateral_haircut_pct,
        exit_slippage_pct=exit_slippage_pct,
        liquidation_penalty_pct=liquidation_penalty_pct,
        protocol_loss_pct=protocol_loss_pct,
    )


def _wallet_safety_buffer_score(
    collateral_value_usd: float,
    debt_value_usd: float,
    impairment_pct: float,
    hedge_drift_pct: float | None,
) -> float:
    if collateral_value_usd <= 0 and debt_value_usd <= 0:
        return 0.0
    coverage = 100.0 if debt_value_usd <= 0 else min(100.0, (collateral_value_usd / max(debt_value_usd, 1.0)) * 100.0)
    drift_penalty = min(30.0, (hedge_drift_pct or 0.0) * 2.5)
    impairment_penalty = min(40.0, impairment_pct * 1.5)
    return round(max(0.0, coverage - drift_penalty - impairment_penalty), 2)


def _wallet_capital_at_risk_proxy(net_delta_usd: float, debt_value_usd: float, impairment_loss_usd: float, unsupported_positions_found: int) -> float:
    return round(max(0.0, abs(net_delta_usd)) + debt_value_usd + impairment_loss_usd + (unsupported_positions_found * 50.0), 2)


def _wallet_health(
    *,
    data_quality: str,
    hedge_state: str,
    safety_state: str,
    capital_state: str,
    impairment_state: str,
    supported_positions_found: int,
) -> WalletStrategyHealth:
    if data_quality == "insufficient" or supported_positions_found == 0:
        return "critical"
    if impairment_state == "severe" or (hedge_state == "severe" and safety_state == "weak") or capital_state == "severe":
        return "critical"
    if data_quality == "partial" or impairment_state == "material" or safety_state == "watch" or capital_state == "elevated":
        return "fragile" if impairment_state == "material" or data_quality == "partial" else "warning"
    if hedge_state == "watch":
        return "warning"
    return "healthy"


def _wallet_recommendation(
    *,
    health: WalletStrategyHealth,
    synthetic_context: DecisionContext,
    impairment_state: str,
    data_quality: str,
    supported_positions_found: int,
    gross_short_exposure_usd: float,
) -> tuple[str, str]:
    if data_quality == "insufficient" or supported_positions_found == 0:
        return (
            "REDUCE",
            "The wallet assessment is incomplete. Reduce reliance on unsupported or missing position data before taking further action.",
        )
    if impairment_state == "severe" or health == "critical":
        if (
            synthetic_context.capital_risk_state == "severe"
            and (impairment_state == "severe" or synthetic_context.hedge_state == "severe")
            and gross_short_exposure_usd > 0
        ):
            return ("CLOSE", "Severe impairment and capital risk are present. Close or materially de-risk the wallet position.")
        return (
            "REDUCE",
            "Impairment risk is materially elevated. Reduce exposure or strengthen collateral before continuing.",
        )
    if impairment_state == "material":
        if synthetic_context.hedge_state != "aligned":
            return (
                "REBALANCE",
                "Impairment risk is material and hedge drift is contributing to the exposure. Rebalance before increasing size.",
            )
        return (
            "REDUCE",
            "Impairment risk is material. Reduce exposure or add support before continuing.",
        )
    if synthetic_context.hedge_state != "aligned":
        return (
            "REBALANCE",
            "Hedge drift is outside tolerance. Rebalance the wallet before increasing exposure.",
        )
    return (
        "HOLD",
        "Current public wallet positions appear adequately hedged, collateralized, and resilient.",
    )


def _wallet_confidence(synthetic_context: DecisionContext, action: str, data_quality: str, impairment_state: str) -> int:
    recommendation = type("WalletRecommendationProxy", (), {"action": action})()
    confidence = calculate_decision_confidence(synthetic_context, recommendation)  # type: ignore[arg-type]
    if data_quality == "partial":
        confidence = max(0, confidence - 12)
    elif data_quality == "insufficient":
        confidence = max(0, confidence - 25)
    if impairment_state == "severe":
        confidence = min(100, confidence + 8)
    return confidence


def _empty_risk_metrics() -> WalletRiskMetrics:
    return WalletRiskMetrics()


def _build_wallet_response(
    *,
    assessment_status: WalletAssessmentStatus,
    request: WalletAnalyzeRequest,
    supported_positions_found: int,
    unsupported_positions_found: int,
    data_timestamp: str | None,
    data_quality: str,
    portfolio_summary: WalletPortfolioSummary,
    risk_metrics: WalletRiskMetrics,
    strategy_health: WalletStrategyHealth | None,
    recommendation: WalletRecommendation | None,
    decision_confidence: int | None,
    risk_notes: list[str],
    corrective_actions: list[str],
    positions: list[NormalizedPosition],
    protocol_errors: list[ProtocolError],
    warnings: list[str],
    debug: dict[str, object] | None = None,
    executive_summary: WalletExecutiveSummary | None = None,
    primary_drivers: list[WalletPrimaryDriver] | None = None,
    recommended_plan: list[WalletPlanStep] | None = None,
    exposure_analysis: WalletExposureAnalysis | None = None,
    portfolio_allocation: list[WalletAllocationItem] | None = None,
    stress_summary: WalletStressSummary | None = None,
    largest_risk_contributors: list[WalletRiskContributor] | None = None,
    portfolio_observations: list[str] | None = None,
    risk_timeline: list[WalletRiskTimelineItem] | None = None,
) -> WalletPortfolioResponse:
    return WalletPortfolioResponse(
        service="wallet_portfolio_auditor",
        wallet_address=request.wallet_address,
        assessment_status=assessment_status,
        supported_positions_found=supported_positions_found,
        unsupported_positions_found=unsupported_positions_found,
        data_timestamp=data_timestamp,
        data_quality=data_quality,  # type: ignore[arg-type]
        portfolio_summary=portfolio_summary,
        risk_metrics=risk_metrics,
        strategy_health=strategy_health,
        decision_confidence=decision_confidence,
        recommendation=recommendation,
        risk_notes=risk_notes,
        corrective_actions=corrective_actions,
        positions=positions,
        protocol_errors=protocol_errors,
        warnings=warnings,
        debug=debug,
        executive_summary=executive_summary,
        primary_drivers=primary_drivers or [],
        recommended_plan=recommended_plan or [],
        exposure_analysis=exposure_analysis,
        portfolio_allocation=portfolio_allocation or [],
        stress_summary=stress_summary,
        largest_risk_contributors=largest_risk_contributors or [],
        portfolio_observations=portfolio_observations or [],
        risk_timeline=risk_timeline or [],
    )


def _portfolio_summary(
    positions: list[NormalizedPosition],
) -> tuple[WalletPortfolioSummary, list[str], float | None]:
    current_position_value_usd = _sum([p.current_value_usd for p in positions])
    gross_long_exposure_usd = _sum(
        [
            p.current_value_usd
            for p in positions
            if p.position_type in {"spot", "lending_supply", "vault_deposit", "perpetual_long", "collateral"}
        ]
    )
    gross_short_exposure_usd = _sum(
        [p.notional_usd for p in positions if p.position_type in {"perpetual_short", "lending_borrow"}]
    )
    net_delta_usd = round(gross_long_exposure_usd - gross_short_exposure_usd, 2)
    net_delta_pct = round((net_delta_usd / current_position_value_usd) * 100.0, 2) if current_position_value_usd > 0 else 0.0

    pnl_values = [p.unrealized_pnl_usd for p in positions if p.unrealized_pnl_usd is not None]
    unrealized_pnl_usd = round(sum(pnl_values), 2) if len(pnl_values) == len(positions) and positions else None
    collateral_value_usd = _sum([p.collateral_usd for p in positions])
    debt_value_usd = _sum([p.debt_usd for p in positions])

    funding_terms: list[tuple[float, float | None]] = []
    for position in positions:
        if position.funding_apy is None or position.notional_usd is None:
            continue
        sign = 1.0 if position.position_type in {"spot", "lending_supply", "vault_deposit", "collateral"} else -1.0
        funding_terms.append((position.notional_usd, sign * position.funding_apy))
    estimated_funding_exposure_apy = _mean_weighted(funding_terms)

    return (
        WalletPortfolioSummary(
            current_position_value_usd=current_position_value_usd,
            gross_long_exposure_usd=gross_long_exposure_usd,
            gross_short_exposure_usd=gross_short_exposure_usd,
            net_delta_usd=net_delta_usd,
            net_delta_pct=net_delta_pct,
            unrealized_pnl_usd=unrealized_pnl_usd,
            collateral_value_usd=collateral_value_usd,
            debt_value_usd=debt_value_usd,
            estimated_funding_exposure_apy=estimated_funding_exposure_apy,
        ),
        [f"{position.protocol.title()} returned partial data." for position in positions if position.data_quality != "complete"],
        estimated_funding_exposure_apy,
    )


def _build_synthetic_metrics(summary: WalletPortfolioSummary, risk_metrics: WalletRiskMetrics) -> Metrics:
    hedge_ratio = (
        round(summary.gross_short_exposure_usd / summary.gross_long_exposure_usd, 4)
        if summary.gross_long_exposure_usd > 0
        else 0.0
    )
    hedge_drift_pct = round(abs(1.0 - hedge_ratio) * 100.0, 2)
    net_delta_estimate = summary.net_delta_pct
    estimated_net_carry_apy = round(summary.estimated_funding_exposure_apy or 0.0, 2)
    carry_efficiency_score = round(max(0.0, min(100.0, (estimated_net_carry_apy / 20.0) * 100.0)), 2)
    return Metrics(
        hedge_ratio=hedge_ratio,
        hedge_drift_pct=hedge_drift_pct,
        net_delta_estimate=net_delta_estimate,
        estimated_net_carry_apy=estimated_net_carry_apy,
        carry_efficiency_score=carry_efficiency_score,
        safety_buffer_score=risk_metrics.safety_buffer_score,
        capital_at_risk_proxy=risk_metrics.capital_at_risk_proxy,
    )


def analyze_wallet(request: WalletAnalyzeRequest) -> WalletPortfolioResponse:
    """Analyze public wallet positions across supported protocols."""
    cache_key = _cache_key(request)
    now = time()
    with WALLET_LOCK:
        cached = WALLET_REQUEST_CACHE.get(cache_key)
        if cached and now - cached[0] < WALLET_CACHE_TTL_SECONDS:
            return cached[1]
        request_history = WALLET_REQUEST_LOG[request.wallet_address.lower()]
        while request_history and now - request_history[0] > 60.0:
            request_history.popleft()
        if len(request_history) >= WALLET_RATE_LIMIT_PER_MINUTE:
            raise ValueError("Wallet analysis rate limit exceeded. Please retry shortly.")
        request_history.append(now)

    adapters = _select_adapters(request.networks, request.protocols)
    positions: list[NormalizedPosition] = []
    protocol_errors: list[ProtocolError] = []
    warnings: list[str] = []
    data_timestamps: list[str] = []
    discovery_debug: dict[str, object] = {}

    selected_adapter_protocols = {adapter.protocol for adapter in adapters}
    for protocol in request.protocols:
        if protocol not in selected_adapter_protocols:
            protocol_errors.append(
                ProtocolError(
                    protocol=protocol,
                    network=request.networks[0],
                    message=f"{protocol.title()} is not supported on the selected networks.",
                    error_type="UnsupportedProtocolNetwork",
                    retryable=False,
                )
            )

    for adapter in adapters:
        try:
            snapshot = adapter.fetch_wallet_data(request.wallet_address)
            data_timestamps.append(snapshot.data_timestamp)
            warnings.extend(snapshot.warnings)
            if snapshot.discovery_metadata:
                discovery_debug[f"{adapter.protocol}:{adapter.network}"] = snapshot.discovery_metadata
            if not snapshot.discovery_complete:
                protocol_errors.append(
                    ProtocolError(
                        protocol=adapter.protocol,  # type: ignore[arg-type]
                        network=adapter.network,  # type: ignore[arg-type]
                        message=f"{adapter.protocol.title()} discovery was incomplete.",
                        error_type="DiscoveryIncomplete",
                        retryable=True,
                    )
                )
            normalized = adapter.normalize_positions(snapshot)
            positions.extend(normalized)
        except Exception as exc:
            protocol_errors.append(
                ProtocolError(
                    protocol=adapter.protocol,  # type: ignore[arg-type]
                    network=adapter.network,  # type: ignore[arg-type]
                    message=f"{adapter.protocol.title()} data unavailable: {exc.__class__.__name__}",
                    error_type=exc.__class__.__name__,
                    retryable=True,
                )
            )
            warnings.append(f"{adapter.protocol.title()} on {adapter.network} returned no readable wallet data.")

    supported_positions_found = sum(1 for position in positions if position.position_type != "unknown")
    unsupported_positions_found = sum(1 for position in positions if position.position_type == "unknown")

    portfolio_summary, extra_warnings, estimated_funding_exposure_apy = _portfolio_summary(positions)
    warnings.extend(extra_warnings)

    all_position_warnings = [position for position in positions if position.data_quality != "complete"]
    data_quality: str
    if supported_positions_found == 0:
        data_quality = "insufficient"
    elif protocol_errors or all_position_warnings:
        data_quality = "partial"
    else:
        data_quality = "complete"

    data_timestamp = max(data_timestamps) if data_timestamps else None
    if supported_positions_found == 0:
        assessment_status: WalletAssessmentStatus = (
            "insufficient_data" if protocol_errors else "no_supported_positions"
        )
        no_position_warning = (
            "DeltaZero could not complete the wallet assessment because one or more selected data sources were unavailable."
            if protocol_errors
            else "DeltaZero checked the selected networks and protocols but found no supported open positions for this wallet."
        )
        warnings.insert(0, no_position_warning)
        risk_notes = [no_position_warning]
        corrective_actions = [
            "Try another wallet or select different networks and protocols."
        ]
        if protocol_errors:
            assessment_warning = "Assessment is incomplete because one or more selected data sources were unavailable."
        else:
            assessment_warning = "No supported positions were detected for the selected networks and protocols."
        warnings.append(assessment_warning)
        return _build_wallet_response(
            assessment_status=assessment_status,
            request=request,
            supported_positions_found=supported_positions_found,
            unsupported_positions_found=unsupported_positions_found,
            data_timestamp=data_timestamp,
            data_quality=data_quality,  # type: ignore[arg-type]
            portfolio_summary=portfolio_summary,
            risk_metrics=_empty_risk_metrics(),
            strategy_health=None,
            recommendation=None,
            decision_confidence=None,
            risk_notes=risk_notes,
            corrective_actions=corrective_actions,
            positions=positions,
            protocol_errors=protocol_errors,
            warnings=warnings,
            debug=discovery_debug if _wallet_debug_enabled() else None,
        )

    impairment_total = ImpairmentResult(
        pre_stress_equity_usd=0.0,
        post_stress_equity_usd=0.0,
        estimated_impairment_loss_usd=0.0,
        estimated_impairment_loss_pct=0.0,
        post_impairment_equity_usd=0.0,
        impairment_breakdown=ImpairmentBreakdown(
            asset_value_impact_usd=0.0,
            hedge_pnl_impact_usd=0.0,
            collateral_haircut_usd=0.0,
            exit_slippage_usd=0.0,
            liquidation_penalty_usd=0.0,
            protocol_loss_assumption_usd=0.0,
        ),
    )
    impairment_by_asset: dict[str, float] = {}
    if positions:
        for asset, cluster in _positions_by_asset(positions).items():
            cluster_result = _impairment_for_cluster(asset, cluster, request.stress_profile)
            impairment_by_asset[asset] = cluster_result.estimated_impairment_loss_usd
            impairment_total = ImpairmentResult(
                pre_stress_equity_usd=round(impairment_total.pre_stress_equity_usd + cluster_result.pre_stress_equity_usd, 2),
                post_stress_equity_usd=round(impairment_total.post_stress_equity_usd + cluster_result.post_stress_equity_usd, 2),
                estimated_impairment_loss_usd=round(
                    impairment_total.estimated_impairment_loss_usd + cluster_result.estimated_impairment_loss_usd, 2
                ),
                estimated_impairment_loss_pct=0.0,
                post_impairment_equity_usd=round(
                    impairment_total.post_impairment_equity_usd + cluster_result.post_impairment_equity_usd, 2
                ),
                impairment_breakdown=ImpairmentBreakdown(
                    asset_value_impact_usd=round(
                        impairment_total.impairment_breakdown.asset_value_impact_usd + cluster_result.impairment_breakdown.asset_value_impact_usd, 2
                    ),
                    hedge_pnl_impact_usd=round(
                        impairment_total.impairment_breakdown.hedge_pnl_impact_usd + cluster_result.impairment_breakdown.hedge_pnl_impact_usd, 2
                    ),
                    collateral_haircut_usd=round(
                        impairment_total.impairment_breakdown.collateral_haircut_usd + cluster_result.impairment_breakdown.collateral_haircut_usd, 2
                    ),
                    exit_slippage_usd=round(
                        impairment_total.impairment_breakdown.exit_slippage_usd + cluster_result.impairment_breakdown.exit_slippage_usd, 2
                    ),
                    liquidation_penalty_usd=round(
                        impairment_total.impairment_breakdown.liquidation_penalty_usd + cluster_result.impairment_breakdown.liquidation_penalty_usd, 2
                    ),
                    protocol_loss_assumption_usd=round(
                        impairment_total.impairment_breakdown.protocol_loss_assumption_usd + cluster_result.impairment_breakdown.protocol_loss_assumption_usd, 2
                    ),
                ),
            )
        impairment_total = impairment_total.model_copy(
            update={
                "estimated_impairment_loss_pct": round(
                    min(
                        100.0,
                        (impairment_total.estimated_impairment_loss_usd / impairment_total.pre_stress_equity_usd) * 100.0,
                    )
                    if impairment_total.pre_stress_equity_usd > 0
                    else 100.0 if impairment_total.estimated_impairment_loss_usd > 0 else 0.0,
                    2,
                )
            }
        )

    net_delta = portfolio_summary.net_delta_usd
    hedge_ratio = (
        round(portfolio_summary.gross_short_exposure_usd / portfolio_summary.gross_long_exposure_usd, 4)
        if portfolio_summary.gross_long_exposure_usd > 0
        else None
    )
    hedge_drift_pct = round(abs(1.0 - hedge_ratio) * 100.0, 2) if hedge_ratio is not None else None
    collateral_health_score = (
        round(min(100.0, (portfolio_summary.collateral_value_usd / max(portfolio_summary.debt_value_usd, 1.0)) * 100.0), 2)
        if portfolio_summary.debt_value_usd > 0
        else (100.0 if portfolio_summary.collateral_value_usd > 0 else None)
    )
    minimum_health_factor = None
    if positions:
        factors = [position.health_factor for position in positions if position.health_factor is not None]
        minimum_health_factor = round(min(factors), 2) if factors else None

    liquidation_proximity_pct = None
    if minimum_health_factor is not None:
        liquidation_proximity_pct = round(max(0.0, min(100.0, (1.5 - minimum_health_factor) / 1.5 * 100.0)), 2)

    hedge_ratio_for_engine = hedge_ratio if hedge_ratio is not None else 0.0
    hedge_drift_for_engine = hedge_drift_pct if hedge_drift_pct is not None else 100.0
    safety_buffer_score = _wallet_safety_buffer_score(
        portfolio_summary.collateral_value_usd,
        portfolio_summary.debt_value_usd,
        impairment_total.estimated_impairment_loss_pct,
        hedge_drift_for_engine,
    )
    capital_at_risk_proxy = _wallet_capital_at_risk_proxy(
        portfolio_summary.net_delta_usd,
        portfolio_summary.debt_value_usd,
        impairment_total.estimated_impairment_loss_usd,
        unsupported_positions_found,
    )

    risk_metrics = WalletRiskMetrics(
        hedge_ratio=hedge_ratio if positions else None,
        hedge_drift_pct=hedge_drift_pct if positions else None,
        collateral_health_score=collateral_health_score if positions else None,
        minimum_health_factor=minimum_health_factor,
        liquidation_proximity_pct=liquidation_proximity_pct,
        safety_buffer_score=safety_buffer_score,
        capital_at_risk_proxy=capital_at_risk_proxy,
        estimated_impairment_loss_usd=impairment_total.estimated_impairment_loss_usd,
        estimated_impairment_loss_pct=impairment_total.estimated_impairment_loss_pct,
        post_impairment_equity_usd=impairment_total.post_impairment_equity_usd,
    )

    synthetic_metrics = _build_synthetic_metrics(portfolio_summary, risk_metrics)
    profile = _normalise_profile(request.stress_profile)
    wallet_profile = _wallet_profile(request.stress_profile)
    synthetic_context = evaluate_decision_context(
        metrics=synthetic_metrics,
        risk_tolerance="medium",
        capital_base_usd=max(portfolio_summary.current_position_value_usd, 1.0),
        profile=profile,
    )

    hedge_state = (
        "severe"
        if hedge_drift_for_engine >= profile.hedge_drift_critical_pct
        else "watch"
        if hedge_drift_for_engine >= profile.hedge_drift_warning_pct
        else "aligned"
    )
    safety_state = (
        "weak"
        if risk_metrics.safety_buffer_score <= profile.safety_buffer_critical
        else "watch"
        if risk_metrics.safety_buffer_score <= profile.safety_buffer_warning
        else "strong"
    )
    capital_pct = (
        (risk_metrics.capital_at_risk_proxy / max(portfolio_summary.current_position_value_usd, 1.0)) * 100.0
        if portfolio_summary.current_position_value_usd > 0
        else 0.0
    )
    capital_state = (
        "severe"
        if capital_pct >= profile.capital_risk_critical_pct
        else "elevated"
        if capital_pct >= profile.capital_risk_warning_pct
        else "manageable"
    )
    impairment_state = (
        "severe"
        if (risk_metrics.estimated_impairment_loss_pct or 0.0) >= wallet_profile.impairment_critical_pct or (risk_metrics.post_impairment_equity_usd or 0.0) <= 0
        else "material"
        if (risk_metrics.estimated_impairment_loss_pct or 0.0) >= wallet_profile.impairment_warning_pct
        else "light"
    )

    data_quality_for_health = data_quality
    health = _wallet_health(
        data_quality=data_quality_for_health,
        hedge_state=hedge_state,
        safety_state=safety_state,
        capital_state=capital_state,
        impairment_state=impairment_state,
        supported_positions_found=supported_positions_found,
    )
    action, summary = _wallet_recommendation(
        health=health,
        synthetic_context=synthetic_context,
        impairment_state=impairment_state,
        data_quality=data_quality_for_health,
        supported_positions_found=supported_positions_found,
        gross_short_exposure_usd=portfolio_summary.gross_short_exposure_usd,
    )
    confidence = _wallet_confidence(
        synthetic_context=synthetic_context,
        action=action,
        data_quality=data_quality_for_health,
        impairment_state=impairment_state,
    )
    if data_quality == "partial":
        confidence = max(0, confidence - 12)
    risk_notes = []
    if data_quality == "insufficient":
        risk_notes.append("Assessment is incomplete because no supported wallet positions were found.")
    elif data_quality == "partial":
        risk_notes.append("This assessment includes only the supported positions successfully retrieved.")
    if impairment_state != "light":
        risk_notes.append(
            f"Estimated impairment loss is {risk_metrics.estimated_impairment_loss_pct:.1f}% of pre-stress equity."
        )
    if hedge_state != "aligned":
        risk_notes.append(f"Hedge drift is {hedge_drift_for_engine:.1f}% against the current exposure mix.")
    if safety_state != "strong":
        risk_notes.append(f"Safety Buffer score is {risk_metrics.safety_buffer_score:.1f}.")
    if capital_state != "manageable":
        risk_notes.append(
            f"Capital at risk proxy is {risk_metrics.capital_at_risk_proxy:.1f} on {portfolio_summary.current_position_value_usd:.1f} of current position value."
        )
    if not risk_notes:
        risk_notes.append("Current public wallet positions appear adequately hedged, collateralized, and resilient.")

    if data_quality == "partial":
        summary = f"{summary} Coverage is incomplete because one or more selected data sources were unavailable."

    corrective_actions: list[str] = []
    if action == "HOLD":
        corrective_actions.append("Maintain the current structure and continue monitoring public data quality.")
    elif action == "REBALANCE":
        corrective_actions.append("Rebalance the hedge to reduce net delta and drift.")
    elif action == "REDUCE":
        corrective_actions.append("Reduce exposure or strengthen collateral before adding risk.")
    elif action == "CLOSE":
        corrective_actions.append("Close or materially de-risk the wallet position.")

    if data_quality != "complete":
        corrective_actions.append("Resolve missing protocol data before treating the assessment as final.")

    assessment_status = "partial_data" if data_quality == "partial" else "positions_found"
    intelligence = build_wallet_intelligence_report(
        positions=positions,
        summary=portfolio_summary,
        risk=risk_metrics,
        health=health,
        action=action,
        data_quality=data_quality,
        stress_profile=request.stress_profile,
        profile=profile,
        wallet_profile=wallet_profile,
        hedge_state=hedge_state,
        safety_state=safety_state,
        capital_state=capital_state,
        impairment_state=impairment_state,
        impairment_by_asset=impairment_by_asset,
    )
    result = _build_wallet_response(
        assessment_status=assessment_status,  # type: ignore[arg-type]
        request=request,
        supported_positions_found=supported_positions_found,
        unsupported_positions_found=unsupported_positions_found,
        data_timestamp=data_timestamp,
        data_quality=data_quality,  # type: ignore[arg-type]
        portfolio_summary=portfolio_summary,
        risk_metrics=risk_metrics,
        strategy_health=health,
        recommendation=WalletRecommendation(action=action, summary=summary, confidence=confidence),
        decision_confidence=confidence,
        risk_notes=risk_notes,
        corrective_actions=corrective_actions,
        positions=positions,
        protocol_errors=protocol_errors,
        warnings=warnings,
        debug=discovery_debug if _wallet_debug_enabled() else None,
        executive_summary=intelligence.executive_summary,
        primary_drivers=intelligence.primary_drivers,
        recommended_plan=intelligence.recommended_plan,
        exposure_analysis=intelligence.exposure_analysis,
        portfolio_allocation=intelligence.portfolio_allocation,
        stress_summary=intelligence.stress_summary,
        largest_risk_contributors=intelligence.largest_risk_contributors,
        portfolio_observations=intelligence.portfolio_observations,
        risk_timeline=intelligence.risk_timeline,
    )

    with WALLET_LOCK:
        WALLET_REQUEST_CACHE[cache_key] = (time(), result)
    return result
