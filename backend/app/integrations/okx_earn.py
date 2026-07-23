"""Read-only OKX Earn integration for DeltaZero wallet analysis.

This adapter simulates OKX Earn position analysis for hackathon demonstrations.
Since OKX doesn't expose public APIs for user positions, we use realistic mock data
that showcases the type of yield positions judges might have on OKX Earn.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field

from app.integrations.base import WalletAdapter
from app.models.wallet import NormalizedPosition


@dataclass
class OKXPosition:
    """Normalized OKX Earn position."""
    
    asset: str
    amount_usd: float
    apy: float | None = None
    risk_category: str = "stablecoin"  # stablecoin / volatile-lending / staking
    protocol: str = "OKX Earn"
    network: str = "OKX Web3 Wallet"
    
    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "asset": self.asset,
            "amount_usd": round(self.amount_usd, 2),
            "apy": self.apy,
            "risk_category": self.risk_category,
            "protocol": self.protocol,
            "network": self.network,
        }


class OKXEarningsSummary(BaseModel):
    """OKX Earn earnings and yield summary for wallet analysis report."""
    
    total_earnings_usd: float = Field(default=0.0, description="Total value in OKX Earn")
    average_apy: float | None = Field(default=None, description="Weighted average APY")
    position_count: int = Field(default=0, description="Number of distinct positions")
    top_asset: str | None = Field(default=None, description="Largest allocation by USD value")
    risk_exposure: dict[str, float] = Field(
        default_factory=dict,
        description="Breakdown by risk category (stablecoin, volatile-lending, staking)"
    )
    
    @classmethod
    def from_positions(cls, positions: list[OKXPosition]) -> Self:
        if not positions:
            return cls()
        
        total = sum(p.amount_usd for p in positions)
        weighted_apy_sum = sum(p.amount_usd * (p.apy or 0) for p in positions if p.apy)
        avg_apy = (weighted_apy_sum / total) if total > 0 else None
        
        top_asset = max(positions, key=lambda p: p.amount_usd).asset if positions else None
        
        risk_breakdown: dict[str, float] = {}
        for pos in positions:
            risk_cat = pos.risk_category
            risk_breakdown[risk_cat] = risk_breakdown.get(risk_cat, 0) + pos.amount_usd
        
        return cls(
            total_earnings_usd=round(total, 2),
            average_apy=round(avg_apy, 4) if avg_apy else None,
            position_count=len(positions),
            top_asset=top_asset,
            risk_exposure={k: round(v, 2) for k, v in sorted(risk_breakdown.items(), key=lambda x: -x[1])},
        )


# Mock OKX Earn positions for demo purposes
# These represent typical yield positions a hackathon participant might have
DEMO_OKX_POSITIONS: list[dict[str, Any]] = [
    {
        "asset": "USDC",
        "amount_usd": 5000.0,
        "apy": 8.5,
        "risk_category": "stablecoin",
        "product_type": "Flexible Savings",
    },
    {
        "asset": "USDT",
        "amount_usd": 3000.0,
        "apy": 12.0,
        "risk_category": "stablecoin",
        "product_type": "Market Making Rewards",
    },
    {
        "asset": "ETH",
        "amount_usd": 2500.0,
        "apy": 5.2,
        "risk_category": "staking",
        "product_type": "Liquid Staking",
    },
    {
        "asset": "BTC",
        "amount_usd": 1500.0,
        "apy": 3.8,
        "risk_category": "staking",
        "product_type": "Liquid Staking",
    },
]


class OKXReadAdapterProtocol(WalletAdapter):
    """Read-only adapter for OKX Earn.

    **PREVIEW** — OKX does not expose a public API for reading user positions,
    so this adapter returns realistic demo data to showcase the analysis pipeline.
    In production, positions would need manual entry or OKX API key integration.
    """

    protocol = "okx-earn"
    network = "okx-earn"

    def __init__(self):
        self._enabled = True

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool):
        self._enabled = value

    async def fetch_positions(
        self,
        wallet_address: str | None,
        include_assets: list[str] | None = None,
    ) -> tuple[list[OKXPosition], str | None]:
        """Fetch positions from OKX Earn.

        Returns mock demo data that represents typical OKX Earn yield positions.
        This showcases the full integration even without real API access.
        """
        await asyncio.sleep(0.15)  # Simulate realistic API latency

        # Filter assets if requested
        if include_assets:
            filtered = [p for p in DEMO_OKX_POSITIONS if p["asset"].upper() in [a.upper() for a in include_assets]]
            positions_data = filtered if filtered else DEMO_OKX_POSITIONS
        else:
            positions_data = DEMO_OKX_POSITIONS

        positions = [OKXPosition(**{
            "asset": p["asset"],
            "amount_usd": p["amount_usd"],
            "apy": p["apy"],
            "risk_category": p["risk_category"],
            "protocol": p.get("protocol", "OKX Earn"),
            "network": p.get("network", "OKX Web3 Wallet"),
        }) for p in positions_data]

        return positions, None

    def supports(self, network: str, protocol: str) -> bool:
        """Check if this adapter supports the given network and protocol."""
        return network == "okx-earn" and protocol.lower() in {"okx-earn", "okx earn", "earn"}

    def fetch_wallet_data(self, wallet_address: str):
        """Mock implementation — returns empty snapshot."""
        from app.integrations.base import ProtocolSnapshot
        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            market_context={"_preview": True},
            warnings=["OKX Earn adapter is in preview mode — positions shown are demo data, not live."],
        )

    def normalize_positions(self, snapshot) -> list[NormalizedPosition]:
        """Convert OKX positions to normalized format.

        NOTE: OKX does not expose a public API for user positions.
        This returns realistic demo data for hackathon demonstration.
        The `wallet_address` parameter from `fetch_wallet_data` is
        intentionally unused — the mock data represents typical positions.
        """
        positions = []
        for pos in DEMO_OKX_POSITIONS:
            positions.append(NormalizedPosition(
                protocol="okx-earn",
                network="okx-earn",
                position_type="lending_supply",
                asset=pos["asset"],
                quantity=None,
                notional_usd=pos["amount_usd"],
                current_value_usd=pos["amount_usd"],
                entry_value_usd=pos["amount_usd"] * (1 - pos["apy"] / 100),
                unrealized_pnl_usd=pos["amount_usd"] * (pos["apy"] / 100),
                collateral_usd=pos["amount_usd"],
                debt_usd=None,
                funding_apy=pos["apy"],
                liquidation_price=None,
                health_factor=None,
                data_timestamp="2024-07-22T00:00:00Z",
                data_quality="preview",
                side="long",
                subaccount_name=None,
                subaccount_address=None,
            ))
        return positions


def create_okx_earn_adapter(network: str) -> OKXReadAdapterProtocol | None:
    """Factory function for OKX Earn adapter registry."""
    if network != "okx-earn":
        return None
    return OKXReadAdapterProtocol()
