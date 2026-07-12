"""Hyperliquid read-only account discovery and position normalization."""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

from app.integrations.base import ProtocolSnapshot, WalletAdapter
from app.models.wallet import NormalizedPosition
from app.services.position_normalizer import normalize_hyperliquid_positions

HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info"
HYPERLIQUID_TIMEOUT_SECONDS = 8.0

# Positions below this current USD value are ignored as dust. The threshold is
# deliberately small and centralized so position detection remains auditable.
MIN_POSITION_VALUE_USD = 1.00
ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")

logger = logging.getLogger(__name__)
_INFO_CLIENT = httpx.Client(timeout=HYPERLIQUID_TIMEOUT_SECONDS)


class HyperliquidAdapter(WalletAdapter):
    protocol = "hyperliquid"
    network = "hyperliquid"

    def supports(self, network: str, protocol: str) -> bool:
        return network == self.network and protocol == self.protocol

    def _post_info(self, body: dict[str, object]) -> Any:
        # Reuse connections: complete discovery can inspect several DEX states
        # across a master account and its subaccounts.
        response = _INFO_CLIENT.post(HYPERLIQUID_INFO_URL, json=body)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _role(payload: object) -> str:
        value = payload.get("role") if isinstance(payload, dict) else payload
        normalized = str(value or "missing").strip().lower()
        return {
            "subaccount": "subAccount",
            "sub_account": "subAccount",
        }.get(normalized, normalized if normalized in {"user", "agent", "vault", "missing"} else "missing")

    @staticmethod
    def _account_mode(payload: object) -> str:
        value = payload
        if isinstance(payload, dict):
            value = payload.get("mode") or payload.get("accountAbstractionMode") or payload.get("type")
        normalized = str(value or "unknown").strip().lower().replace("-", "_")
        if normalized in {"unifiedaccount", "unified_account", "unified"}:
            return "unified"
        if normalized in {"portfoliomargin", "portfolio_margin"}:
            return "portfolio_margin"
        if normalized in {"disabled", "default", "standard", "dexabstraction", "dex_abstraction"}:
            return "standard"
        return "unknown"

    @staticmethod
    def _dex_names(payload: object) -> list[str]:
        names = [""]
        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict) and isinstance(item.get("name"), str) and item["name"]:
                    names.append(item["name"])
        return list(dict.fromkeys(names))

    @staticmethod
    def _positions_from_state(
        state: object,
        *,
        account_address: str,
        account_name: str | None,
        source: str,
        dex: str,
    ) -> list[dict[str, object]]:
        if not isinstance(state, dict):
            return []
        results: list[dict[str, object]] = []
        for item in state.get("assetPositions", []) or []:
            if not isinstance(item, dict) or not isinstance(item.get("position"), dict):
                continue
            position = dict(item["position"])
            try:
                size = float(position.get("szi", 0) or 0)
            except (TypeError, ValueError):
                continue
            if size == 0:
                continue
            try:
                position_value = abs(float(position.get("positionValue", 0) or 0))
            except (TypeError, ValueError):
                position_value = 0.0
            if position_value < MIN_POSITION_VALUE_USD:
                continue
            results.append(
                {
                    "position": position,
                    "account_address": account_address,
                    "account_name": account_name,
                    "source": source,
                    "dex": dex or "default",
                    "margin_summary": state.get("marginSummary"),
                    "cross_margin_summary": state.get("crossMarginSummary"),
                    "withdrawable": state.get("withdrawable"),
                }
            )
        return results

    @staticmethod
    def _spot_prices(payload: object) -> dict[int, float]:
        if not isinstance(payload, list) or len(payload) < 2:
            return {}
        meta, contexts = payload[0], payload[1]
        if not isinstance(meta, dict) or not isinstance(contexts, list):
            return {}
        prices: dict[int, float] = {}
        universe = meta.get("universe", [])
        for index, market in enumerate(universe if isinstance(universe, list) else []):
            if index >= len(contexts) or not isinstance(market, dict) or not isinstance(contexts[index], dict):
                continue
            tokens = market.get("tokens")
            if not isinstance(tokens, list) or not tokens:
                continue
            mid = contexts[index].get("midPx") or contexts[index].get("markPx") or contexts[index].get("prevDayPx")
            try:
                if mid is not None:
                    prices[int(tokens[0])] = float(mid)
            except (TypeError, ValueError):
                continue
        return prices

    @staticmethod
    def _spot_balances(
        state: object,
        prices: dict[int, float],
        *,
        account_address: str,
        account_name: str | None,
        source: str,
    ) -> list[dict[str, object]]:
        if not isinstance(state, dict):
            return []
        balances = state.get("balances", [])
        results: list[dict[str, object]] = []
        for balance in balances if isinstance(balances, list) else []:
            if not isinstance(balance, dict):
                continue
            try:
                quantity = float(balance.get("total", 0) or 0)
                token = int(balance.get("token", -1))
            except (TypeError, ValueError):
                continue
            if quantity == 0:
                continue
            coin = str(balance.get("coin") or f"TOKEN_{token}")
            price = 1.0 if coin.upper() in {"USDC", "USDT", "USDH"} else prices.get(token)
            value = abs(quantity * price) if price is not None else None
            if value is not None and value < MIN_POSITION_VALUE_USD:
                continue
            results.append(
                {
                    "asset": coin,
                    "quantity": quantity,
                    "current_value_usd": value,
                    "entry_value_usd": balance.get("entryNtl"),
                    "account_address": account_address,
                    "account_name": account_name,
                    "source": source,
                    "token": token,
                    "market_context": {
                        "account_address": account_address,
                        "account_name": account_name,
                        "source": source,
                    },
                }
            )
        return results

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        if not ADDRESS_PATTERN.fullmatch(wallet_address):
            raise ValueError("Hyperliquid address must be a 42-character hexadecimal address.")

        warnings: list[str] = []
        failures: list[str] = []
        raw_positions: list[dict[str, object]] = []
        spot_balances: list[dict[str, object]] = []
        vault_positions: list[dict[str, object]] = []
        state_sources_checked: list[str] = []
        position_sources_found: list[str] = []
        market_context: dict[str, object] = {}
        subaccounts_checked = 0
        vaults_checked = 0
        master_address: str | None = None

        logger.info("hyperliquid discovery started address=%s", wallet_address)

        def request_info(body: dict[str, object], source: str, *, required: bool = True) -> object | None:
            try:
                payload = self._post_info(body)
                state_sources_checked.append(source)
                return payload
            except Exception as exc:  # pragma: no cover - exercised with mocks
                logger.warning(
                    "hyperliquid request failed address=%s source=%s error=%s",
                    wallet_address,
                    source,
                    exc.__class__.__name__,
                )
                if required:
                    failures.append(source)
                return None

        role_payload = request_info({"type": "userRole", "user": wallet_address}, "userRole")
        role = self._role(role_payload)
        logger.info("hyperliquid role address=%s role=%s", wallet_address, role)

        if role == "agent":
            warning = (
                "The supplied address is an agent or API wallet. Hyperliquid account state must be queried "
                "using the actual master account or subaccount address."
            )
            warnings.append(warning)
            failures.append("masterAccountAddress")
            metadata = {
                "role": role,
                "account_mode": "unknown",
                "master_address": None,
                "subaccounts_checked": 0,
                "vaults_checked": 0,
                "state_sources_checked": state_sources_checked,
                "position_sources_found": [],
                "request_failures": failures,
            }
            return ProtocolSnapshot(
                protocol=self.protocol,
                network=self.network,
                wallet_address=wallet_address,
                warnings=warnings,
                discovery_complete=False,
                discovery_metadata=metadata,
            )

        if role_payload is None:
            role = "missing"

        abstraction_payload: object | None = None
        dex_abstraction_payload: object | None = None
        if role in {"user", "subAccount"}:
            abstraction_payload = request_info(
                {"type": "userAbstraction", "user": wallet_address}, "userAbstraction"
            )
            dex_abstraction_payload = request_info(
                {"type": "userDexAbstraction", "user": wallet_address}, "userDexAbstraction"
            )
        account_mode = self._account_mode(abstraction_payload)
        market_context["user_abstraction"] = abstraction_payload
        market_context["user_dex_abstraction"] = dex_abstraction_payload

        perp_dex_payload = request_info({"type": "perpDexs"}, "perpDexs") if role != "missing" else []
        dex_names = self._dex_names(perp_dex_payload)
        market_context["perp_dexes"] = perp_dex_payload

        spot_market_payload = request_info(
            {"type": "spotMetaAndAssetCtxs"}, "spotMetaAndAssetCtxs", required=False
        )
        spot_prices = self._spot_prices(spot_market_payload)

        def inspect_account(
            address: str,
            name: str | None,
            source_prefix: str,
            *,
            account_dex_names: list[str] | None = None,
            include_spot: bool = True,
        ) -> None:
            nonlocal raw_positions, spot_balances
            selected_dex_names = account_dex_names if account_dex_names is not None else dex_names

            def inspect_dex(dex: str) -> tuple[str, list[dict[str, object]]]:
                source = f"{source_prefix}.clearinghouseState:{dex or 'default'}"
                body: dict[str, object] = {"type": "clearinghouseState", "user": address}
                if dex:
                    body["dex"] = dex
                state = request_info(body, source)
                return (
                    source,
                    self._positions_from_state(
                        state,
                        account_address=address,
                        account_name=name,
                        source=source,
                        dex=dex,
                    ),
                )

            # Per-DEX summaries are independent read-only requests. Fetching
            # them concurrently keeps full HIP-3 discovery within API latency
            # budgets while retaining protocol-level failure isolation.
            with ThreadPoolExecutor(max_workers=min(8, max(1, len(selected_dex_names)))) as executor:
                dex_results = list(executor.map(inspect_dex, selected_dex_names))
            for source, found in dex_results:
                if found:
                    position_sources_found.append(source)
                    raw_positions.extend(found)

            if not include_spot:
                return
            spot_source = f"{source_prefix}.spotClearinghouseState"
            spot_state = request_info(
                {"type": "spotClearinghouseState", "user": address}, spot_source
            )
            found_spot = self._spot_balances(
                spot_state,
                spot_prices,
                account_address=address,
                account_name=name,
                source=spot_source,
            )
            if any(item.get("current_value_usd") is None for item in found_spot):
                if "spotMetaAndAssetCtxs" not in failures:
                    failures.append("spotMetaAndAssetCtxs")
                warnings.append(
                    "Hyperliquid spot balances were found but could not be valued because spot market context was unavailable."
                )
            if found_spot:
                position_sources_found.append(spot_source)
                spot_balances.extend(found_spot)

        if role in {"user", "subAccount", "vault"}:
            inspect_account(wallet_address, None, "direct")

        if role == "user":
            subaccounts_payload = request_info(
                {"type": "subAccounts", "user": wallet_address}, "subAccounts"
            )
            valid_subaccounts = [
                subaccount
                for subaccount in (subaccounts_payload if isinstance(subaccounts_payload, list) else [])
                if isinstance(subaccount, dict)
                and isinstance(subaccount.get("subAccountUser"), str)
                and ADDRESS_PATTERN.fullmatch(str(subaccount["subAccountUser"]))
            ]
            subaccounts_checked = len(valid_subaccounts)
            for subaccount in valid_subaccounts:
                master = subaccount.get("master")
                if isinstance(master, str):
                    master_address = master

            def inspect_subaccount(subaccount: dict[str, object]) -> None:
                nonlocal raw_positions, spot_balances
                if not isinstance(subaccount, dict):
                    return
                address = subaccount.get("subAccountUser")
                if not isinstance(address, str) or not ADDRESS_PATTERN.fullmatch(address):
                    return
                name = str(subaccount.get("name") or "") or None
                source_prefix = f"subaccount:{address}"
                embedded_state = subaccount.get("clearinghouseState")
                embedded_spot = subaccount.get("spotState")
                if isinstance(embedded_state, dict):
                    source = f"{source_prefix}.clearinghouseState:default"
                    state_sources_checked.append(source)
                    found = self._positions_from_state(
                        embedded_state,
                        account_address=address,
                        account_name=name,
                        source=source,
                        dex="",
                    )
                    if found:
                        position_sources_found.append(source)
                        raw_positions.extend(found)
                if isinstance(embedded_spot, dict):
                    source = f"{source_prefix}.spotClearinghouseState"
                    state_sources_checked.append(source)
                    found_spot = self._spot_balances(
                        embedded_spot,
                        spot_prices,
                        account_address=address,
                        account_name=name,
                        source=source,
                    )
                    if found_spot:
                        position_sources_found.append(source)
                        spot_balances.extend(found_spot)
                additional_dexes = dex_names[1:]
                if not isinstance(embedded_state, dict):
                    additional_dexes = dex_names
                inspect_account(
                    address,
                    name,
                    source_prefix,
                    account_dex_names=additional_dexes,
                    include_spot=not isinstance(embedded_spot, dict),
                )

            # Subaccount state trees are independent. Bound concurrency to four
            # accounts while each account uses a bounded per-DEX pool.
            with ThreadPoolExecutor(max_workers=min(4, max(1, len(valid_subaccounts)))) as executor:
                list(executor.map(inspect_subaccount, valid_subaccounts))

            vault_equities = request_info(
                {"type": "userVaultEquities", "user": wallet_address}, "userVaultEquities"
            )
            for item in vault_equities if isinstance(vault_equities, list) else []:
                if not isinstance(item, dict):
                    continue
                try:
                    equity = float(item.get("equity", 0) or 0)
                except (TypeError, ValueError):
                    continue
                if abs(equity) < MIN_POSITION_VALUE_USD:
                    continue
                vaults_checked += 1
                source = "userVaultEquities"
                position_sources_found.append(source)
                vault_positions.append(
                    {
                        "asset": "USD",
                        "position_type": "vault_deposit",
                        "quantity": None,
                        "notional_usd": abs(equity),
                        "current_value_usd": abs(equity),
                        "vault_address": item.get("vaultAddress"),
                        "source": source,
                        "market_context": {
                            "vault_address": item.get("vaultAddress"),
                            "source": source,
                            "account_mode": account_mode,
                        },
                    }
                )

        if role == "vault":
            vaults_checked = 1
            vault_details = request_info(
                {"type": "vaultDetails", "vaultAddress": wallet_address}, "vaultDetails"
            )
            market_context["vault_details"] = vault_details

        market_context["spot_balances"] = spot_balances
        market_context["vault_positions"] = vault_positions
        market_context["account_mode"] = account_mode

        metadata = {
            "role": role,
            "account_mode": account_mode,
            "master_address": master_address,
            "subaccounts_checked": subaccounts_checked,
            "vaults_checked": vaults_checked,
            "state_sources_checked": state_sources_checked,
            "position_sources_found": list(dict.fromkeys(position_sources_found)),
            "request_failures": failures,
        }
        discovery_complete = not failures
        if failures:
            warnings.append(
                "Hyperliquid discovery was incomplete because required account state sources were unavailable."
            )

        logger.info(
            "hyperliquid discovery completed address=%s role=%s mode=%s subaccounts=%d direct_positions=%d "
            "subaccount_positions=%d vault_positions=%d spot_balances=%d failures=%d",
            wallet_address,
            role,
            account_mode,
            subaccounts_checked,
            sum(1 for p in raw_positions if str(p.get("source", "")).startswith("direct")),
            sum(1 for p in raw_positions if str(p.get("source", "")).startswith("subaccount")),
            len(vault_positions),
            len(spot_balances),
            len(failures),
        )

        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            raw_positions=raw_positions + vault_positions,
            market_context=market_context,
            warnings=warnings,
            discovery_complete=discovery_complete,
            discovery_metadata=metadata,
        )

    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]:
        positions: list[dict[str, object]] = []
        for raw in snapshot.raw_positions:
            if raw.get("position_type") == "vault_deposit":
                positions.append(dict(raw))
                continue
            position = raw.get("position") if isinstance(raw.get("position"), dict) else {}
            size = float(position.get("szi", 0) or 0)
            margin = position.get("marginUsed")
            positions.append(
                {
                    "asset": position.get("coin"),
                    "position_type": "perpetual_short" if size < 0 else "perpetual_long",
                    "quantity": abs(size),
                    "notional_usd": abs(float(position.get("positionValue", 0) or 0)),
                    "entry_value_usd": (
                        abs(float(position["entryPx"]) * size) if position.get("entryPx") is not None else None
                    ),
                    "unrealized_pnl_usd": float(position.get("unrealizedPnl", 0) or 0),
                    "collateral_usd": float(margin) if margin is not None else None,
                    "liquidation_price": position.get("liquidationPx"),
                    "funding_apy": position.get("funding"),
                    "data_timestamp": snapshot.data_timestamp,
                    "market_context": {
                        "account_address": raw.get("account_address"),
                        "account_name": raw.get("account_name"),
                        "source": raw.get("source"),
                        "dex": raw.get("dex"),
                        "account_mode": snapshot.discovery_metadata.get("account_mode"),
                    },
                }
            )
        raw = {
            "positions": positions,
            "spot_balances": snapshot.market_context.get("spot_balances", []),
            "market_context": snapshot.market_context,
            "data_timestamp": snapshot.data_timestamp,
        }
        return normalize_hyperliquid_positions(raw)
