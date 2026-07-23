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

    # Aave v3 Pool contract addresses
    _POOL_ADDRESSES = {
        "ethereum": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        "arbitrum": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    }

    # getUserAccountData(address user) → (totalCollateralBase, totalDebtBase,
    # availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor)
    _GET_USER_ACCOUNT_DATA = (
        "0x5c889f70"  # keccak("getUserAccountData(address)")[:4]
    )

    def _fetch_onchain_account_data(self, wallet_address: str) -> dict[str, object] | None:
        """Attempt live on-chain Aave v3 account data via eth_call."""
        pool = self._POOL_ADDRESSES.get(self.network)
        if not pool:
            return None

        addr_param = "0" * 24 + wallet_address[2:].lower()
        data = self._GET_USER_ACCOUNT_DATA + addr_param

        try:
            result = self._rpc_call("eth_call", [{"to": pool, "data": data}, "latest"])
            if not result or result == "0x":
                return None
            decoded = bytes.fromhex(result[2:])
            # Aave returns 6 uint256 values packed as 32-byte words
            if len(decoded) < 192:
                return None
            words = [int.from_bytes(decoded[i : i + 32], "big") for i in range(0, 192, 32)]
            return {
                "total_collateral_base": words[0],
                "total_debt_base": words[1],
                "available_borrows_base": words[2],
                "current_liquidation_threshold": words[3],
                "ltv": words[4],
                "health_factor_raw": words[5],
            }
        except Exception:
            return None

    def _ray_to_usd(self, ray_value: int, decimals: int = 8) -> float:
        """Convert Aave ray (27-decimal) base unit to USD (8 decimals)."""
        return ray_value / (10 ** (27 + decimals))

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        warnings: list[str] = []
        raw_positions: list[dict[str, object]] = []
        account_data: dict[str, object] = {}

        rpc_url = self._rpc_url()

        # Attempt live on-chain lookup when RPC is configured
        if rpc_url:
            onchain = self._fetch_onchain_account_data(wallet_address)
            if onchain:
                collateral = self._ray_to_usd(onchain["total_collateral_base"], 8)
                debt = self._ray_to_usd(onchain["total_debt_base"], 8)
                hf_raw = onchain["health_factor_raw"]
                health_factor = hf_raw / 1e27 if hf_raw else 0.0

                account_data = {
                    "total_collateral_usd": round(collateral, 2),
                    "total_debt_usd": round(debt, 2),
                    "available_borrows_usd": round(self._ray_to_usd(onchain["available_borrows_base"], 8), 2),
                    "liquidation_threshold": onchain["current_liquidation_threshold"] / 1e4,
                    "health_factor": round(health_factor, 4),
                }

                if collateral > 0:
                    raw_positions.append({
                        "asset": self.network.upper(),
                        "supplied_value_usd": round(collateral, 2),
                        "borrowed_value_usd": round(debt, 2),
                        "usage_as_collateral_enabled": True,
                        "data_timestamp": self._timestamp(),
                        "network": self.network,
                    })
                    warnings.append("Aave positions reflect on-chain state at query time. Empty positions are normal for wallets without Aave exposure.")
                return ProtocolSnapshot(
                    protocol=self.protocol,
                    network=self.network,
                    wallet_address=wallet_address,
                    raw_positions=raw_positions,
                    market_context={"account_data": account_data},
                    warnings=warnings,
                    discovery_complete=True,
                )

            warnings.append("On-chain Aave lookup failed. Data shown below is estimated.")

        # Fallback: preview mode with zero-rich data so the analysis pipeline
        # still produces a meaningful report even without RPC access.
        if not rpc_url:
            warnings.append(f"{self.network.title()} RPC URL missing; returning estimated Aave data.")

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

        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            raw_positions=raw_positions,
            market_context={"account_data": account_data, "_preview": True},
            warnings=warnings,
            discovery_complete=not warnings,
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
