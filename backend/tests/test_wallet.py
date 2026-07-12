"""Tests for POST /wallet/analyze and wallet normalizers."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.integrations.base import ProtocolSnapshot
from app.models.wallet import NormalizedPosition
from app.services.position_normalizer import (
    normalize_aave_positions,
    normalize_hyperliquid_positions,
    normalize_morpho_positions,
)
from app.services import wallet_analyzer


class DummyAdapter:
    def __init__(self, protocol: str, network: str, positions: list[NormalizedPosition], warnings: list[str] | None = None):
        self.protocol = protocol
        self.network = network
        self._positions = positions
        self._warnings = warnings or []

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        return ProtocolSnapshot(
            protocol=self.protocol,
            network=self.network,
            wallet_address=wallet_address,
            raw_positions=[position.model_dump() for position in self._positions],
            market_context={},
            warnings=self._warnings,
        )

    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]:
        return self._positions


@pytest.fixture(autouse=True)
def clear_wallet_cache() -> None:
    wallet_analyzer.WALLET_REQUEST_CACHE.clear()
    wallet_analyzer.WALLET_REQUEST_LOG.clear()


def test_valid_wallet_request_returns_200(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    positions = [
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="perpetual_short",
            asset="ETH",
            quantity=1.25,
            notional_usd=4200,
            current_value_usd=4200,
            entry_value_usd=4100,
            unrealized_pnl_usd=100,
            collateral_usd=1200,
            debt_usd=0,
            funding_apy=4.2,
            liquidation_price=4200,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="spot",
            asset="ETH",
            quantity=1.25,
            notional_usd=4300,
            current_value_usd=4300,
            entry_value_usd=4000,
            unrealized_pnl_usd=300,
            collateral_usd=0,
            debt_usd=0,
            funding_apy=None,
            liquidation_price=None,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
    ]
    monkeypatch.setattr(
        wallet_analyzer,
        "_select_adapters",
        lambda networks, protocols: [DummyAdapter("hyperliquid", "hyperliquid", positions)],
    )
    response = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["hyperliquid"],
            "protocols": ["hyperliquid"],
            "stress_profile": "standard",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "wallet_portfolio_auditor"
    assert data["supported_positions_found"] == 2
    assert 0 <= data["recommendation"]["confidence"] <= 100


def test_invalid_address_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "not-an-address",
            "networks": ["ethereum"],
            "protocols": ["aave"],
            "stress_profile": "standard",
        },
    )
    assert response.status_code == 422


def test_empty_wallet_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "",
            "networks": ["ethereum"],
            "protocols": ["aave"],
            "stress_profile": "standard",
        },
    )
    assert response.status_code == 422


def test_hyperliquid_normalization() -> None:
    raw = {
        "positions": [
            {
                "asset": "ETH",
                "position_type": "perpetual_short",
                "quantity": 1.25,
                "notional_usd": 4200,
                "entry_value_usd": 4100,
                "unrealized_pnl_usd": 100,
                "collateral_usd": 1200,
                "funding_apy": 4.2,
                "liquidation_price": 4200,
                "data_timestamp": "2026-07-12T00:00:00Z",
            }
        ],
        "spot_balances": [
            {
                "asset": "ETH",
                "quantity": 1.25,
                "current_value_usd": 4300,
                "data_timestamp": "2026-07-12T00:00:00Z",
            }
        ],
        "market_context": {},
        "data_timestamp": "2026-07-12T00:00:00Z",
    }
    positions = normalize_hyperliquid_positions(raw)
    assert len(positions) == 2
    assert positions[0].protocol == "hyperliquid"
    assert positions[0].position_type == "perpetual_short"
    assert positions[1].position_type == "spot"


def test_aave_normalization() -> None:
    raw = {
        "reserves": [
            {
                "asset": "ETH",
                "supplied_value_usd": 5000,
                "borrowed_value_usd": 0,
                "usage_as_collateral_enabled": True,
                "supply_apy": 3.5,
                "liquidation_price": None,
                "health_factor": 1.7,
            },
            {
                "asset": "USDC",
                "supplied_value_usd": 0,
                "borrowed_value_usd": 1200,
                "usage_as_collateral_enabled": False,
                "borrow_apy": 4.8,
                "health_factor": 1.7,
            },
        ],
        "account_data": {"health_factor": 1.7, "total_collateral_usd": 5000, "total_debt_usd": 1200},
        "network": "ethereum",
        "data_timestamp": "2026-07-12T00:00:00Z",
    }
    positions = normalize_aave_positions(raw)
    assert len(positions) == 2
    assert any(position.position_type in {"collateral", "lending_supply"} for position in positions)
    assert any(position.position_type == "lending_borrow" for position in positions)


def test_morpho_normalization() -> None:
    raw = {
        "positions": [
            {
                "asset": "ETH",
                "network": "ethereum",
                "type": "vault_deposit",
                "supplied_value_usd": 3200,
                "borrowed_value_usd": 0,
                "collateral_value_usd": 3200,
                "apy": 5.2,
                "health_factor": 1.6,
                "data_timestamp": "2026-07-12T00:00:00Z",
            }
        ],
        "network": "ethereum",
        "data_timestamp": "2026-07-12T00:00:00Z",
    }
    positions = normalize_morpho_positions(raw)
    assert len(positions) == 1
    assert positions[0].position_type == "vault_deposit"
    assert positions[0].collateral_usd == 3200


def test_one_protocol_fails_while_others_succeed(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    good_positions = [
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="perpetual_short",
            asset="ETH",
            quantity=1,
            notional_usd=1000,
            current_value_usd=1000,
            entry_value_usd=1000,
            unrealized_pnl_usd=0,
            collateral_usd=500,
            debt_usd=0,
            funding_apy=2.0,
            liquidation_price=0,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        )
    ]

    class FailingAdapter(DummyAdapter):
        def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:  # type: ignore[override]
            raise RuntimeError("boom")

    monkeypatch.setattr(
        wallet_analyzer,
        "_select_adapters",
        lambda networks, protocols: [
            DummyAdapter("hyperliquid", "hyperliquid", good_positions),
            FailingAdapter("aave", "ethereum", []),
        ],
    )
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["hyperliquid", "ethereum"],
            "protocols": ["hyperliquid", "aave"],
            "stress_profile": "standard",
        },
    ).json()
    assert data["data_quality"] == "partial"
    assert data["protocol_errors"]
    assert data["warnings"]


def test_partial_data_warning(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    class PartialAdapter(DummyAdapter):
        def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:  # type: ignore[override]
            return ProtocolSnapshot(
                protocol=self.protocol,
                network=self.network,
                wallet_address=wallet_address,
                raw_positions=[position.model_dump() for position in self._positions],
                market_context={},
                warnings=["RPC unavailable"],
            )

    positions = [
        NormalizedPosition(
            protocol="aave",
            network="ethereum",
            position_type="lending_supply",
            asset="ETH",
            quantity=1,
            notional_usd=1000,
            current_value_usd=1000,
            entry_value_usd=1000,
            unrealized_pnl_usd=0,
            collateral_usd=1000,
            debt_usd=0,
            funding_apy=3.0,
            liquidation_price=None,
            health_factor=1.5,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        )
    ]
    monkeypatch.setattr(
        wallet_analyzer,
        "_select_adapters",
        lambda networks, protocols: [PartialAdapter("aave", "ethereum", positions)],
    )
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["ethereum"],
            "protocols": ["aave"],
            "stress_profile": "standard",
        },
    ).json()
    assert data["data_quality"] == "partial"
    assert data["warnings"]


def test_healthy_hedged_portfolio_returns_hold(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    positions = [
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="spot",
            asset="ETH",
            quantity=1,
            notional_usd=5000,
            current_value_usd=5000,
            entry_value_usd=5000,
            unrealized_pnl_usd=0,
            collateral_usd=0,
            debt_usd=0,
            funding_apy=3.0,
            liquidation_price=None,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="perpetual_short",
            asset="ETH",
            quantity=1,
            notional_usd=4900,
            current_value_usd=4900,
            entry_value_usd=4900,
            unrealized_pnl_usd=0,
            collateral_usd=1200,
            debt_usd=0,
            funding_apy=4.0,
            liquidation_price=4300,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
    ]
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [DummyAdapter("hyperliquid", "hyperliquid", positions)])
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["hyperliquid"],
            "protocols": ["hyperliquid"],
            "stress_profile": "standard",
        },
    ).json()
    assert data["strategy_health"] == "healthy"
    assert data["recommendation"]["action"] == "HOLD"


def test_poor_hedge_returns_rebalance(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    positions = [
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="spot",
            asset="ETH",
            quantity=1,
            notional_usd=5000,
            current_value_usd=5000,
            entry_value_usd=5000,
            unrealized_pnl_usd=0,
            collateral_usd=0,
            debt_usd=0,
            funding_apy=3.0,
            liquidation_price=None,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="perpetual_short",
            asset="ETH",
            quantity=1,
            notional_usd=3500,
            current_value_usd=3500,
            entry_value_usd=3500,
            unrealized_pnl_usd=0,
            collateral_usd=900,
            debt_usd=0,
            funding_apy=4.0,
            liquidation_price=4300,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
    ]
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [DummyAdapter("hyperliquid", "hyperliquid", positions)])
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["hyperliquid"],
            "protocols": ["hyperliquid"],
            "stress_profile": "standard",
        },
    ).json()
    assert data["recommendation"]["action"] == "REBALANCE"
    assert data["risk_metrics"]["hedge_drift_pct"] > 0


def test_weak_collateral_returns_reduce(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    positions = [
        NormalizedPosition(
            protocol="aave",
            network="ethereum",
            position_type="lending_supply",
            asset="ETH",
            quantity=1,
            notional_usd=4000,
            current_value_usd=4000,
            entry_value_usd=4000,
            unrealized_pnl_usd=0,
            collateral_usd=50,
            debt_usd=0,
            funding_apy=2.5,
            liquidation_price=None,
            health_factor=1.05,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        )
    ]
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [DummyAdapter("aave", "ethereum", positions)])
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["ethereum"],
            "protocols": ["aave"],
            "stress_profile": "strict",
        },
    ).json()
    assert data["recommendation"]["action"] == "REDUCE"


def test_multiple_severe_conditions_return_close(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    positions = [
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="spot",
            asset="ETH",
            quantity=1,
            notional_usd=1000,
            current_value_usd=1000,
            entry_value_usd=1000,
            unrealized_pnl_usd=-250,
            collateral_usd=0,
            debt_usd=0,
            funding_apy=None,
            liquidation_price=None,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="perpetual_short",
            asset="ETH",
            quantity=1,
            notional_usd=200,
            current_value_usd=200,
            entry_value_usd=200,
            unrealized_pnl_usd=-50,
            collateral_usd=0,
            debt_usd=0,
            funding_apy=2.0,
            liquidation_price=5000,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        ),
    ]
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [DummyAdapter("hyperliquid", "hyperliquid", positions)])
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["hyperliquid"],
            "protocols": ["hyperliquid"],
            "stress_profile": "strict",
        },
    ).json()
    assert data["recommendation"]["action"] == "CLOSE"
    assert data["strategy_health"] == "critical"


def test_no_missing_data_is_not_silently_zero_risk(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [DummyAdapter("aave", "ethereum", [])])
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["ethereum"],
            "protocols": ["aave"],
            "stress_profile": "standard",
        },
    ).json()
    assert data["data_quality"] == "insufficient"
    assert data["strategy_health"] == "critical"
    assert data["recommendation"]["action"] != "HOLD"


def test_decision_confidence_remains_bounded(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    positions = [
        NormalizedPosition(
            protocol="hyperliquid",
            network="hyperliquid",
            position_type="spot",
            asset="ETH",
            quantity=1,
            notional_usd=5000,
            current_value_usd=5000,
            entry_value_usd=5000,
            unrealized_pnl_usd=0,
            collateral_usd=0,
            debt_usd=0,
            funding_apy=3.0,
            liquidation_price=None,
            health_factor=None,
            data_timestamp="2026-07-12T00:00:00Z",
            data_quality="complete",
            market_context={},
        )
    ]
    monkeypatch.setattr(wallet_analyzer, "_select_adapters", lambda networks, protocols: [DummyAdapter("hyperliquid", "hyperliquid", positions)])
    data = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "networks": ["hyperliquid"],
            "protocols": ["hyperliquid"],
            "stress_profile": "standard",
        },
    ).json()
    assert 0 <= data["recommendation"]["confidence"] <= 100
