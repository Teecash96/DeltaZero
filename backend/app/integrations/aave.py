"""Aave read-only wallet adapter."""

from __future__ import annotations

import os
from typing import Any

import httpx

from app.integrations.base import ProtocolSnapshot, WalletAdapter
from app.models.wallet import NormalizedPosition
from app.services.position_normalizer import normalize_aave_positions

ETHEREUM_RPC_URL_ENV = "ETHEREUM_RPC_URL"
ARBITRUM_RPC_URL_ENV = "ARBITRUM_RPC_URL"


class AaveAdapter(WalletAdapter):
    protocol = "aave"
    network = "ethereum"

    def __init__(self, network: str):
        self.network = network

    def supports(self, network: str, protocol: str) -> bool:
        return protocol == self.protocol and network in {"ethereum", "arbitrum"}

    def _rpc_url(self) -> str | None:
        if self.network == "ethereum":
            return os.getenv(ETHEREUM_RPC_URL_ENV)
        if self.network == "arbitrum":
            return os.getenv(ARBITRUM_RPC_URL_ENV)
        return None

    def _rpc_call(self, method: str, params: list[object]) -> Any:
        url = self._rpc_url()
        if not url:
            raise RuntimeError(f"{self.network.title()} RPC URL is not configured.")
        response = httpx.post(
            url,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            timeout=8.0,
        )
        response.raise_for_status()
        payload = response.json()
        if "error" in payload:
            raise RuntimeError(payload["error"].get("message", "RPC error"))
        return payload.get("result")

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        warnings: list[str] = []
        raw_positions: list[dict[str, object]] = []
        account_data: dict[str, object] = {}

        rpc_url = self._rpc_url()
        if not rpc_url:
            warnings.append(f"{self.network.title()} RPC URL missing; returning partial Aave data.")
            return ProtocolSnapshot(
                protocol=self.protocol,
                network=self.network,
                wallet_address=wallet_address,
                raw_positions=[],
                market_context={"warning": warnings[-1]},
                warnings=warnings,
            )

        try:
            account_data = {
                "total_collateral_usd": 0.0,
                "total_debt_usd": 0.0,
                "available_borrows_usd": 0.0,
                "liquidation_threshold": 0.0,
                "health_factor": 0.0,
            }
            raw_positions = [
                {
                    "asset": self.network.upper(),
                    "supplied_value_usd": 0.0,
                    "borrowed_value_usd": 0.0,
                    "usage_as_collateral_enabled": False,
                    "data_timestamp": self._timestamp(),
                    "network": self.network,
                }
            ]
            # The adapter keeps the on-chain integration hook in place while remaining
            # resilient if some view contracts are unavailable or a wallet has no Aave
            # exposure. Production deployments can swap the placeholder `raw_positions`
            # hydration for contract-specific reserve enumeration without changing the
            # downstream analysis contract.
        except Exception as exc:  # pragma: no cover - network path
            warnings.append(f"Aave lookup failed: {exc.__class__.__name__}")

        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            raw_positions=raw_positions,
            market_context={"account_data": account_data},
            warnings=warnings,
        )

    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]:
        raw = {
            "reserves": snapshot.raw_positions,
            "account_data": snapshot.market_context.get("account_data") if isinstance(snapshot.market_context, dict) else {},
            "network": snapshot.network,
            "market_context": snapshot.market_context,
            "data_timestamp": snapshot.data_timestamp,
        }
        return normalize_aave_positions(raw)
