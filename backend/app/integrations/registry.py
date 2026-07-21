"""Extensible registry for read-only protocol adapter factories."""

from collections.abc import Callable

from app.integrations.aave import AaveAdapter
from app.integrations.base import WalletAdapter
from app.integrations.hyperliquid import HyperliquidAdapter
from app.integrations.morpho import MorphoAdapter

AdapterFactory = Callable[[str], WalletAdapter | None]


class ProtocolAdapterRegistry:
    """Resolve adapters without modifying the wallet-analysis engine."""

    def __init__(self) -> None:
        self._factories: dict[str, AdapterFactory] = {}

    def register(self, protocol: str, factory: AdapterFactory, *, replace: bool = False) -> None:
        key = protocol.strip().lower()
        if not key:
            raise ValueError("Protocol name is required.")
        if key in self._factories and not replace:
            raise ValueError(f"Adapter already registered for {key}.")
        self._factories[key] = factory

    def resolve(self, networks: list[str], protocols: list[str]) -> list[WalletAdapter]:
        adapters: list[WalletAdapter] = []
        for network in networks:
            for protocol in protocols:
                factory = self._factories.get(protocol.lower())
                adapter = factory(network) if factory else None
                if adapter is not None and adapter.supports(network, protocol):
                    adapters.append(adapter)
        return adapters

    @property
    def protocols(self) -> tuple[str, ...]:
        return tuple(sorted(self._factories))


def create_default_adapter_registry() -> ProtocolAdapterRegistry:
    registry = ProtocolAdapterRegistry()
    registry.register("hyperliquid", lambda network: HyperliquidAdapter() if network == "hyperliquid" else None)
    registry.register("aave", lambda network: AaveAdapter(network) if network in {"ethereum", "arbitrum"} else None)
    registry.register("morpho", lambda network: MorphoAdapter(network) if network in {"ethereum", "arbitrum"} else None)
    return registry


DEFAULT_ADAPTER_REGISTRY = create_default_adapter_registry()
