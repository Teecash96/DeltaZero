"""Morpho GraphQL wallet adapter."""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ProtocolSnapshot, WalletAdapter
from app.models.wallet import NormalizedPosition
from app.services.position_normalizer import normalize_morpho_positions

MORPHO_GRAPHQL_URL = "https://api.morpho.org/graphql"


class MorphoAdapter(WalletAdapter):
    protocol = "morpho"
    network = "ethereum"

    def supports(self, network: str, protocol: str) -> bool:
        return protocol == self.protocol and network in {"ethereum", "arbitrum"}

    def _graphql(self, query: str, variables: dict[str, object]) -> dict[str, Any]:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(MORPHO_GRAPHQL_URL, json={"query": query, "variables": variables})
            response.raise_for_status()
            payload = response.json()
        if "errors" in payload:
            raise RuntimeError(payload["errors"][0].get("message", "Morpho GraphQL error"))
        return payload.get("data", {})

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        warnings: list[str] = []
        raw_positions: list[dict[str, object]] = []
        market_context: dict[str, object] = {}

        query = """
        query WalletPositions($address: String!, $first: Int!, $skip: Int!) {
          positions(where: { user: $address }, first: $first, skip: $skip) {
            asset
            network
            type
            suppliedValueUsd
            borrowedValueUsd
            collateralValueUsd
            apy
            healthFactor
            marketId
            dataTimestamp
          }
          markets(first: 25) {
            id
            network
            borrowApy
            supplyApy
          }
        }
        """

        try:
            cursor = 0
            first = 100
            while True:
                data = self._graphql(query, {"address": wallet_address.lower(), "first": first, "skip": cursor})
                batch = data.get("positions", []) or []
                raw_positions.extend(batch)
                if len(batch) < first:
                    market_context["markets"] = data.get("markets", []) or []
                    break
                cursor += first
        except Exception as exc:  # pragma: no cover - network path
            warnings.append(f"Morpho GraphQL lookup failed: {exc.__class__.__name__}")

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
                    "asset": position.get("asset"),
                    "network": position.get("network") or snapshot.network,
                    "position_type": position.get("type"),
                    "supplied_value_usd": position.get("suppliedValueUsd"),
                    "borrowed_value_usd": position.get("borrowedValueUsd"),
                    "collateral_usd": position.get("collateralValueUsd"),
                    "apy": position.get("apy"),
                    "health_factor": position.get("healthFactor"),
                    "data_timestamp": position.get("dataTimestamp") or snapshot.data_timestamp,
                }
                for position in snapshot.raw_positions
                if isinstance(position, dict)
            ],
            "network": snapshot.network,
            "market_context": snapshot.market_context,
            "data_timestamp": snapshot.data_timestamp,
        }
        return normalize_morpho_positions(raw)
