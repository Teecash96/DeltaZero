"""Shared protocol adapter interfaces for wallet analysis."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.models.wallet import NormalizedPosition


@dataclass(frozen=True)
class ProtocolSnapshot:
    """Raw read-only protocol data with lightweight metadata."""

    protocol: str
    network: str
    wallet_address: str
    raw_positions: list[dict[str, object]] = field(default_factory=list)
    market_context: dict[str, object] = field(default_factory=dict)
    data_timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    warnings: list[str] = field(default_factory=list)


class WalletAdapter(ABC):
    """Read-only protocol adapter."""

    protocol: str
    network: str

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()

    @abstractmethod
    def supports(self, network: str, protocol: str) -> bool: ...

    @abstractmethod
    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot: ...

    @abstractmethod
    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]: ...
