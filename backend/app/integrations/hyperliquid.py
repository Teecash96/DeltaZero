"""Hyperliquid read-only wallet adapter."""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ProtocolSnapshot, WalletAdapter
from app.models.wallet import NormalizedPosition
from app.services.position_normalizer import normalize_hyperliquid_positions

HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info"


class HyperliquidAdapter(WalletAdapter):
    protocol = "hyperliquid"
    network = "hyperliquid"

    def supports(self, network: str, protocol: str) -> bool:
        return network == self.network and protocol == self.protocol

    def _post_info(self, body: dict[str, object]) -> dict[str, Any]:
        with httpx.Client(timeout=8.0) as client:
            response = client.post(HYPERLIQUID_INFO_URL, json=body)
            response.raise_for_status()
            payload = response.json()
        if isinstance(payload, dict):
            return payload
        return {"result": payload}

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        warnings: list[str] = []
        raw_positions: list[dict[str, object]] = []
        market_context: dict[str, object] = {}

        try:
            user_state = self._post_info({"type": "userState", "user": wallet_address})
            raw_positions = list(user_state.get("assetPositions", []) or [])
            if user_state.get("marginSummary"):
                market_context["margin_summary"] = user_state["marginSummary"]
            if user_state.get("crossMarginSummary"):
                market_context["cross_margin_summary"] = user_state["crossMarginSummary"]
            if user_state.get("withdrawable"):
                market_context["withdrawable_balance"] = user_state["withdrawable"]
        except Exception as exc:  # pragma: no cover - network path
            warnings.append(f"Hyperliquid account lookup failed: {exc.__class__.__name__}")

        try:
            market_context["asset_contexts"] = self._post_info({"type": "metaAndAssetCtxs"})
        except Exception as exc:  # pragma: no cover - network path
            warnings.append(f"Hyperliquid market context unavailable: {exc.__class__.__name__}")

        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            raw_positions=raw_positions,
            market_context=market_context,
            warnings=warnings,
        )

    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]:
        raw = {
            "positions": [
                {
                    "asset": position.get("position", {}).get("coin"),
                    "position_type": "perpetual_short"
                    if float(position.get("position", {}).get("szi", 0) or 0) < 0
                    else "perpetual_long",
                    "quantity": abs(float(position.get("position", {}).get("szi", 0) or 0)),
                    "notional_usd": abs(float(position.get("position", {}).get("positionValue", 0) or 0)),
                    "entry_value_usd": abs(
                        float(position.get("position", {}).get("entryPx", 0) or 0)
                        * abs(float(position.get("position", {}).get("szi", 0) or 0))
                    )
                    if position.get("position", {}).get("entryPx") is not None
                    else None,
                    "unrealized_pnl_usd": float(position.get("position", {}).get("unrealizedPnl", 0) or 0),
                    "liquidation_price": position.get("position", {}).get("liquidationPx"),
                    "funding_apy": position.get("position", {}).get("funding"),
                    "health_factor": None,
                    "data_timestamp": snapshot.data_timestamp,
                }
                for position in snapshot.raw_positions
            ],
            "spot_balances": [
                {
                    "asset": balance.get("coin") or balance.get("asset"),
                    "current_value_usd": balance.get("usd"),
                    "quantity": balance.get("total"),
                    "data_timestamp": snapshot.data_timestamp,
                }
                for balance in (snapshot.market_context.get("spot_balances") or [])  # type: ignore[union-attr]
                if isinstance(balance, dict)
            ],
            "market_context": snapshot.market_context,
            "data_timestamp": snapshot.data_timestamp,
        }
        return normalize_hyperliquid_positions(raw)
