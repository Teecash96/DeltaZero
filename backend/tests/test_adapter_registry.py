"""Protocol adapter plugin registry tests."""

import pytest

from app.integrations.base import ProtocolSnapshot, WalletAdapter
from app.integrations.registry import ProtocolAdapterRegistry, create_default_adapter_registry
from app.models.wallet import NormalizedPosition


class ExampleAdapter(WalletAdapter):
    protocol = "example"
    network = "example-chain"

    def supports(self, network: str, protocol: str) -> bool:
        return network == self.network and protocol == self.protocol

    def fetch_wallet_data(self, wallet_address: str) -> ProtocolSnapshot:
        return ProtocolSnapshot(protocol=self.protocol, network=self.network, wallet_address=wallet_address)

    def normalize_positions(self, snapshot: ProtocolSnapshot) -> list[NormalizedPosition]:
        return []


def test_third_party_adapter_can_register_without_engine_changes() -> None:
    registry = ProtocolAdapterRegistry()
    registry.register("example", lambda network: ExampleAdapter() if network == "example-chain" else None)
    adapters = registry.resolve(["example-chain"], ["example"])
    assert len(adapters) == 1
    assert adapters[0].protocol == "example"


def test_duplicate_registration_requires_explicit_replace() -> None:
    registry = ProtocolAdapterRegistry()
    registry.register("example", lambda _: ExampleAdapter())
    with pytest.raises(ValueError, match="already registered"):
        registry.register("example", lambda _: ExampleAdapter())


def test_default_registry_exposes_supported_protocols() -> None:
    assert create_default_adapter_registry().protocols == ("aave", "hyperliquid", "morpho")
