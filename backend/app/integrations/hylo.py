"""Read-only Hylo token discovery through Solana JSON-RPC."""

from __future__ import annotations

from datetime import datetime, timezone
import os
import re
from typing import Any

import httpx

from app.integrations.base import ProtocolSnapshot, WalletAdapter
from app.models.wallet import NormalizedPosition
from app.services.position_normalizer import normalize_hylo_positions

SOLANA_RPC_URL_ENV = "SOLANA_RPC_URL"
SOLANA_RPC_DEFAULT = "https://api.mainnet-beta.solana.com"
SOLANA_TIMEOUT_SECONDS = 8.0
SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

# Hylo's official V1 addresses. These labels are metadata only. The adapter
# never submits transactions or requests wallet permissions.
HYLO_PROGRAMS = {
    "exchange": "HYEXCHtHkBagdStcJCp3xbbb9B7sdMdWXFNj6mdsG4hn",
    "stability_pool": "HysTabVUfmQBFcmzu1ctRd1Y1fxd66RBpboy1bmtDSQQ",
}

HYLO_ASSETS = {
    "5YMkXAYccHSGnHn9nob9xEvv6Pvka9DZWH7nTbotTu9E": "hyUSD",
    "HnnGv3HrSqjRpgdFmx7vQGjntNEoex1SU4e9Lxcxuihz": "eHYUSD",
    "4sWNB8zGWHkh6UnmwiEtzNxL4XrN7uK9tosbESbJFfVs": "xSOL",
    "hy1oXYgrBW6PVcJ4s6s2FKavRdwgWTXdfE69AxT7kPT": "hyloSOL",
    "hy1opf2bqRDwAxoktyWAj6f3UpeHcLydzEdKjMYGs2u": "hyloSOL+",
}

SOLANA_ADDRESS_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


class HyloAdapter(WalletAdapter):
    """Discover supported Hylo token balances without custody or execution."""

    protocol = "hylo"
    network = "solana"

    def __init__(self, rpc_url: str | None = None):
        self.rpc_url = (rpc_url or os.getenv(SOLANA_RPC_URL_ENV) or SOLANA_RPC_DEFAULT).strip()

    def supports(self, network: str, protocol: str) -> bool:
        return network == self.network and protocol == self.protocol

    def _rpc_call(self, method: str, params: list[object]) -> dict[str, Any]:
        response = httpx.post(
            self.rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            timeout=SOLANA_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Solana RPC returned a non-object response.")
        if payload.get("error"):
            error = payload["error"]
            message = error.get("message", "Solana RPC error") if isinstance(error, dict) else str(error)
            raise RuntimeError(message)
        return payload

    @staticmethod
    def _token_accounts(payload: dict[str, Any]) -> tuple[int | None, list[dict[str, Any]]]:
        result = payload.get("result")
        if not isinstance(result, dict):
            return None, []
        context = result.get("context") if isinstance(result.get("context"), dict) else {}
        slot = context.get("slot")
        value = result.get("value")
        return int(slot) if isinstance(slot, int) else None, value if isinstance(value, list) else []

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        if not SOLANA_ADDRESS_PATTERN.fullmatch(wallet_address):
            raise ValueError("Hylo requires a valid base58 Solana wallet address.")

        warnings: list[str] = []
        raw_positions: list[dict[str, object]] = []
        accounts_scanned = 0
        slot: int | None = None

        payload = self._rpc_call(
            "getTokenAccountsByOwner",
            [
                wallet_address,
                {"programId": SPL_TOKEN_PROGRAM},
                {"encoding": "jsonParsed"},
            ],
        )
        slot, accounts = self._token_accounts(payload)
        accounts_scanned = len(accounts)

        for account in accounts:
            if not isinstance(account, dict):
                continue
            account_data = account.get("account")
            parsed = account_data.get("data", {}).get("parsed", {}) if isinstance(account_data, dict) else {}
            info = parsed.get("info", {}) if isinstance(parsed, dict) else {}
            mint = str(info.get("mint") or "") if isinstance(info, dict) else ""
            asset = HYLO_ASSETS.get(mint)
            if not asset or not isinstance(info, dict):
                continue
            token_amount = info.get("tokenAmount")
            if not isinstance(token_amount, dict):
                continue
            try:
                quantity = float(token_amount.get("uiAmountString") or token_amount.get("uiAmount") or 0)
            except (TypeError, ValueError):
                continue
            if quantity <= 0:
                continue
            raw_positions.append(
                {
                    "asset": asset,
                    "mint": mint,
                    "quantity": quantity,
                    "decimals": token_amount.get("decimals"),
                    "data_timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

        warnings.append(
            "Hylo Position Health currently reports supported SPL token quantities. "
            "USD valuation and protocol pool collateral ratios are not invented until an official Hylo state API or IDL-backed decoder is configured."
        )
        if not raw_positions:
            warnings.append("No supported Hylo token balances were found for this wallet.")

        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            raw_positions=raw_positions,
            market_context={
                "source": "Solana public JSON-RPC",
                "rpc_method": "getTokenAccountsByOwner",
                "hylo_programs": HYLO_PROGRAMS,
                "known_assets": HYLO_ASSETS,
                "valuation_status": "unavailable",
                "protocol_state_status": "token_balances_only",
                "documentation_url": "https://docs.hylo.so/developer-resources",
                "slot": slot,
            },
            warnings=warnings,
            discovery_complete=True,
            discovery_metadata={
                "accounts_scanned": accounts_scanned,
                "slot": slot,
                "known_assets_detected": sorted({str(item["asset"]) for item in raw_positions}),
                "data_source": "Solana public JSON-RPC",
            },
        )

    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]:
        return normalize_hylo_positions(
            {
                "positions": snapshot.raw_positions,
                "network": snapshot.network,
                "market_context": snapshot.market_context,
                "data_timestamp": snapshot.data_timestamp,
            }
        )
