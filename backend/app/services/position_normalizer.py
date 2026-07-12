"""Normalization helpers for wallet portfolio positions."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone

from app.models.wallet import NormalizedPosition, WalletDataQuality


def _coerce_float(value: object | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _timestamp(value: object | None) -> str:
    if isinstance(value, str) and value:
        return value
    return datetime.now(timezone.utc).isoformat()


def _quality_from_fields(values: Iterable[object | None]) -> WalletDataQuality:
    missing = sum(value is None for value in values)
    if missing == 0:
        return "complete"
    if missing <= 2:
        return "partial"
    return "insufficient"


def _position_type(value: object | None, default: str = "unknown") -> str:
    normalized = str(value or default).strip().lower().replace(" ", "_")
    allowed = {
        "spot",
        "lending_supply",
        "lending_borrow",
        "vault_deposit",
        "perpetual_long",
        "perpetual_short",
        "collateral",
        "unknown",
    }
    return normalized if normalized in allowed else default


def normalize_hyperliquid_positions(snapshot: dict[str, object]) -> list[NormalizedPosition]:
    positions: list[NormalizedPosition] = []
    timestamp = _timestamp(snapshot.get("data_timestamp"))

    for raw in snapshot.get("positions", []) or []:
        coin = str(raw.get("asset") or raw.get("coin") or raw.get("symbol") or "UNKNOWN")
        size = _coerce_float(raw.get("quantity") or raw.get("size") or raw.get("position_size"))
        notional = _coerce_float(raw.get("notional_usd") or raw.get("position_value_usd") or raw.get("current_value_usd"))
        entry = _coerce_float(raw.get("entry_value_usd") or raw.get("entry_notional_usd"))
        pnl = _coerce_float(raw.get("unrealized_pnl_usd") or raw.get("pnl"))
        collateral = _coerce_float(raw.get("collateral_usd"))
        liquidation = _coerce_float(raw.get("liquidation_price"))
        funding = _coerce_float(raw.get("funding_apy") or raw.get("funding"))
        side = str(raw.get("side") or "").lower()
        position_type = _position_type(raw.get("position_type"))
        if position_type == "unknown":
            position_type = "perpetual_short" if (side in {"sell", "short"} or (size is not None and size < 0)) else "perpetual_long"
        quality = _quality_from_fields([size, notional])
        positions.append(
            NormalizedPosition(
                protocol="hyperliquid",
                network="hyperliquid",
                position_type=position_type,  # type: ignore[arg-type]
                asset=coin,
                quantity=size,
                notional_usd=abs(notional) if notional is not None else None,
                current_value_usd=abs(notional) if notional is not None else None,
                entry_value_usd=entry,
                unrealized_pnl_usd=pnl,
                collateral_usd=collateral,
                debt_usd=_coerce_float(raw.get("debt_usd")),
                funding_apy=funding,
                liquidation_price=liquidation,
                health_factor=_coerce_float(raw.get("health_factor")),
                data_timestamp=_timestamp(raw.get("data_timestamp") or timestamp),
                data_quality=quality,
                market_context=snapshot.get("market_context") if isinstance(snapshot.get("market_context"), dict) else None,
            )
        )

    for raw in snapshot.get("spot_balances", []) or []:
        coin = str(raw.get("asset") or raw.get("coin") or "UNKNOWN")
        value = _coerce_float(raw.get("current_value_usd") or raw.get("value_usd") or raw.get("balance_usd"))
        positions.append(
            NormalizedPosition(
                protocol="hyperliquid",
                network="hyperliquid",
                position_type="spot",
                asset=coin,
                quantity=_coerce_float(raw.get("quantity") or raw.get("balance")),
                notional_usd=abs(value) if value is not None else None,
                current_value_usd=abs(value) if value is not None else None,
                entry_value_usd=_coerce_float(raw.get("entry_value_usd")),
                unrealized_pnl_usd=_coerce_float(raw.get("unrealized_pnl_usd")),
                collateral_usd=_coerce_float(raw.get("collateral_usd")),
                debt_usd=_coerce_float(raw.get("debt_usd")),
                funding_apy=_coerce_float(raw.get("funding_apy")),
                liquidation_price=_coerce_float(raw.get("liquidation_price")),
                health_factor=_coerce_float(raw.get("health_factor")),
                data_timestamp=_timestamp(raw.get("data_timestamp") or timestamp),
                data_quality=_quality_from_fields([value]),
                market_context=snapshot.get("market_context") if isinstance(snapshot.get("market_context"), dict) else None,
            )
        )

    return positions


def normalize_aave_positions(snapshot: dict[str, object]) -> list[NormalizedPosition]:
    positions: list[NormalizedPosition] = []
    timestamp = _timestamp(snapshot.get("data_timestamp"))
    account_data = snapshot.get("account_data") if isinstance(snapshot.get("account_data"), dict) else {}

    for raw in snapshot.get("reserves", []) or []:
        asset = str(raw.get("asset") or raw.get("symbol") or raw.get("underlying_asset") or "UNKNOWN")
        supplied = _coerce_float(raw.get("supplied_value_usd") or raw.get("current_value_usd") or raw.get("supply_usd"))
        borrowed = _coerce_float(raw.get("borrowed_value_usd") or raw.get("debt_usd") or raw.get("borrow_usd"))
        position_type = "collateral" if raw.get("usage_as_collateral_enabled") else "lending_supply"
        if borrowed and borrowed > 0:
            positions.append(
                NormalizedPosition(
                    protocol="aave",
                    network=str(snapshot.get("network") or raw.get("network") or "ethereum"),  # type: ignore[arg-type]
                    position_type="lending_borrow",
                    asset=asset,
                    quantity=_coerce_float(raw.get("borrow_quantity") or raw.get("borrow_balance")),
                    notional_usd=borrowed,
                    current_value_usd=borrowed,
                    entry_value_usd=_coerce_float(raw.get("borrow_entry_value_usd")),
                    unrealized_pnl_usd=None,
                    collateral_usd=0.0,
                    debt_usd=borrowed,
                    funding_apy=_coerce_float(raw.get("borrow_apy") or raw.get("variable_borrow_apy")),
                    liquidation_price=_coerce_float(raw.get("liquidation_price")),
                    health_factor=_coerce_float(account_data.get("health_factor")),
                    data_timestamp=_timestamp(raw.get("data_timestamp") or timestamp),
                    data_quality=_quality_from_fields([borrowed, account_data.get("health_factor")]),
                    market_context=snapshot.get("market_context") if isinstance(snapshot.get("market_context"), dict) else None,
                )
            )
        if supplied and supplied > 0:
            positions.append(
                NormalizedPosition(
                    protocol="aave",
                    network=str(snapshot.get("network") or raw.get("network") or "ethereum"),  # type: ignore[arg-type]
                    position_type=_position_type(position_type),  # type: ignore[arg-type]
                    asset=asset,
                    quantity=_coerce_float(raw.get("supply_quantity") or raw.get("supply_balance")),
                    notional_usd=supplied,
                    current_value_usd=supplied,
                    entry_value_usd=_coerce_float(raw.get("supply_entry_value_usd")),
                    unrealized_pnl_usd=None,
                    collateral_usd=supplied if raw.get("usage_as_collateral_enabled") else 0.0,
                    debt_usd=0.0,
                    funding_apy=_coerce_float(raw.get("supply_apy") or raw.get("liquidity_apy")),
                    liquidation_price=_coerce_float(raw.get("liquidation_price")),
                    health_factor=_coerce_float(account_data.get("health_factor")),
                    data_timestamp=_timestamp(raw.get("data_timestamp") or timestamp),
                    data_quality=_quality_from_fields([supplied, account_data.get("health_factor")]),
                    market_context=snapshot.get("market_context") if isinstance(snapshot.get("market_context"), dict) else None,
                )
            )

    if not positions and account_data:
        collateral = _coerce_float(account_data.get("total_collateral_usd") or account_data.get("total_collateral_base"))
        debt = _coerce_float(account_data.get("total_debt_usd") or account_data.get("total_debt_base"))
        positions.append(
            NormalizedPosition(
                protocol="aave",
                network=str(snapshot.get("network") or "ethereum"),  # type: ignore[arg-type]
                position_type="unknown",
                asset="UNKNOWN",
                quantity=None,
                notional_usd=collateral,
                current_value_usd=collateral,
                entry_value_usd=None,
                unrealized_pnl_usd=None,
                collateral_usd=collateral or 0.0,
                debt_usd=debt or 0.0,
                funding_apy=None,
                liquidation_price=None,
                health_factor=_coerce_float(account_data.get("health_factor")),
                data_timestamp=timestamp,
                data_quality=_quality_from_fields([collateral, debt, account_data.get("health_factor")]),
                market_context=snapshot.get("market_context") if isinstance(snapshot.get("market_context"), dict) else None,
            )
        )

    return positions


def normalize_morpho_positions(snapshot: dict[str, object]) -> list[NormalizedPosition]:
    positions: list[NormalizedPosition] = []
    timestamp = _timestamp(snapshot.get("data_timestamp"))

    for raw in snapshot.get("positions", []) or []:
        asset = str(raw.get("asset") or raw.get("symbol") or raw.get("market_asset") or "UNKNOWN")
        position_type = _position_type(raw.get("position_type") or raw.get("type"))
        supplied = _coerce_float(raw.get("supplied_value_usd") or raw.get("current_value_usd") or raw.get("supply_usd"))
        borrowed = _coerce_float(raw.get("borrowed_value_usd") or raw.get("debt_usd") or raw.get("borrow_usd"))
        collateral = _coerce_float(raw.get("collateral_usd"))
        if position_type == "unknown":
            position_type = "vault_deposit" if supplied and supplied > 0 and borrowed in (None, 0.0) else "lending_borrow" if borrowed and borrowed > 0 else "lending_supply"
        positions.append(
            NormalizedPosition(
                protocol="morpho",
                network=str(snapshot.get("network") or raw.get("network") or "ethereum"),  # type: ignore[arg-type]
                position_type=_position_type(position_type),  # type: ignore[arg-type]
                asset=asset,
                quantity=_coerce_float(raw.get("quantity") or raw.get("balance")),
                notional_usd=supplied if supplied is not None else borrowed,
                current_value_usd=supplied if supplied is not None else borrowed,
                entry_value_usd=_coerce_float(raw.get("entry_value_usd")),
                unrealized_pnl_usd=_coerce_float(raw.get("unrealized_pnl_usd")),
                collateral_usd=collateral if collateral is not None else (supplied or 0.0 if position_type != "lending_borrow" else 0.0),
                debt_usd=borrowed or 0.0,
                funding_apy=_coerce_float(raw.get("apy") or raw.get("supply_apy") or raw.get("borrow_apy")),
                liquidation_price=_coerce_float(raw.get("liquidation_price")),
                health_factor=_coerce_float(raw.get("health_factor")),
                data_timestamp=_timestamp(raw.get("data_timestamp") or timestamp),
                data_quality=_quality_from_fields([supplied, borrowed, collateral]),
                market_context=snapshot.get("market_context") if isinstance(snapshot.get("market_context"), dict) else None,
            )
        )

    return positions
