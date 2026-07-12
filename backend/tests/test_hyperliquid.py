"""Hyperliquid account-discovery regression tests."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.integrations.hyperliquid import HyperliquidAdapter, MIN_POSITION_VALUE_USD
from app.services import wallet_analyzer

MASTER = "0x1111111111111111111111111111111111111111"
SUB_ONE = "0x2222222222222222222222222222222222222222"
SUB_TWO = "0x3333333333333333333333333333333333333333"
VAULT = "0x4444444444444444444444444444444444444444"
AGENT = "0x5555555555555555555555555555555555555555"


def perp(coin: str = "ETH", size: str = "1", value: str = "2500") -> dict[str, object]:
    return {
        "type": "oneWay",
        "position": {
            "coin": coin,
            "szi": size,
            "positionValue": value,
            "entryPx": "2400",
            "unrealizedPnl": "100",
            "marginUsed": "500",
            "liquidationPx": "1800",
        },
    }


def clearing(*positions: dict[str, object]) -> dict[str, object]:
    return {
        "marginSummary": {"accountValue": "3000", "totalNtlPos": "2500", "totalMarginUsed": "500"},
        "crossMarginSummary": {"accountValue": "3000", "totalNtlPos": "2500", "totalMarginUsed": "500"},
        "withdrawable": "2500",
        "assetPositions": list(positions),
    }


def spot(*balances: dict[str, object]) -> dict[str, object]:
    return {"balances": list(balances)}


def base_responses(role: str = "user", mode: object = "default") -> dict[tuple[str, str, str], object]:
    return {
        ("userRole", MASTER, ""): {"role": role},
        ("userAbstraction", MASTER, ""): mode,
        ("userDexAbstraction", MASTER, ""): False,
        ("perpDexs", "", ""): [None],
        ("spotMetaAndAssetCtxs", "", ""): [{"universe": []}, []],
        ("clearinghouseState", MASTER, ""): clearing(),
        ("spotClearinghouseState", MASTER, ""): spot(),
        ("subAccounts", MASTER, ""): [],
        ("userVaultEquities", MASTER, ""): [],
    }


def install_info(monkeypatch: pytest.MonkeyPatch, responses: dict[tuple[str, str, str], object], failures: set[str] | None = None) -> list[dict[str, object]]:
    calls: list[dict[str, object]] = []
    failures = failures or set()

    def fake(self: HyperliquidAdapter, body: dict[str, object]) -> Any:
        del self
        calls.append(body)
        request_type = str(body.get("type"))
        if request_type in failures:
            raise RuntimeError(f"{request_type} unavailable")
        key = (request_type, str(body.get("user") or body.get("vaultAddress") or ""), str(body.get("dex") or ""))
        if key not in responses:
            raise AssertionError(f"Unexpected Hyperliquid request: {body}")
        return responses[key]

    monkeypatch.setattr(HyperliquidAdapter, "_post_info", fake)
    return calls


def normalized(monkeypatch: pytest.MonkeyPatch, responses: dict[tuple[str, str, str], object], address: str = MASTER):
    install_info(monkeypatch, responses)
    adapter = HyperliquidAdapter()
    snapshot = adapter.fetch_wallet_data(address)
    return snapshot, adapter.normalize_positions(snapshot)


@pytest.fixture(autouse=True)
def clear_wallet_state() -> None:
    wallet_analyzer.WALLET_REQUEST_CACHE.clear()
    wallet_analyzer.WALLET_REQUEST_LOG.clear()


def test_standard_master_account_with_direct_perp(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("clearinghouseState", MASTER, "")] = clearing(perp())
    snapshot, positions = normalized(monkeypatch, responses)
    assert snapshot.discovery_complete
    assert len(positions) == 1
    assert positions[0].position_type == "perpetual_long"
    assert positions[0].market_context["source"] == "direct.clearinghouseState:default"


def test_master_account_positions_only_in_subaccount(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("subAccounts", MASTER, "")] = [
        {"name": "Trading", "subAccountUser": SUB_ONE, "master": MASTER}
    ]
    responses[("clearinghouseState", SUB_ONE, "")] = clearing(perp(size="-2", value="5000"))
    responses[("spotClearinghouseState", SUB_ONE, "")] = spot()
    snapshot, positions = normalized(monkeypatch, responses)
    assert len(positions) == 1
    assert positions[0].position_type == "perpetual_short"
    assert positions[0].market_context["account_name"] == "Trading"
    assert snapshot.discovery_metadata["subaccounts_checked"] == 1


def test_subaccount_address_is_queried_directly(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses = {
        (key[0], SUB_ONE if key[1] == MASTER else key[1], key[2]): value for key, value in responses.items()
        if key[0] not in {"subAccounts", "userVaultEquities"}
    }
    responses[("userRole", SUB_ONE, "")] = {"role": "subAccount"}
    responses[("clearinghouseState", SUB_ONE, "")] = clearing(perp())
    snapshot, positions = normalized(monkeypatch, responses, SUB_ONE)
    assert snapshot.discovery_metadata["role"] == "subAccount"
    assert len(positions) == 1


def test_vault_address_with_open_positions(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = {
        ("userRole", VAULT, ""): {"role": "vault"},
        ("perpDexs", "", ""): [None],
        ("spotMetaAndAssetCtxs", "", ""): [{"universe": []}, []],
        ("clearinghouseState", VAULT, ""): clearing(perp()),
        ("spotClearinghouseState", VAULT, ""): spot(),
        ("vaultDetails", VAULT, ""): {"vaultAddress": VAULT, "name": "Vault"},
    }
    snapshot, positions = normalized(monkeypatch, responses, VAULT)
    assert snapshot.discovery_metadata["role"] == "vault"
    assert snapshot.discovery_metadata["vaults_checked"] == 1
    assert len(positions) == 1


def test_wallet_with_only_vault_equity(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("userVaultEquities", MASTER, "")] = [{"vaultAddress": VAULT, "equity": "742.50"}]
    _, positions = normalized(monkeypatch, responses)
    assert len(positions) == 1
    assert positions[0].position_type == "vault_deposit"
    assert positions[0].current_value_usd == 742.5


def test_agent_wallet_is_incomplete(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = install_info(monkeypatch, {("userRole", AGENT, ""): {"role": "agent"}})
    snapshot = HyperliquidAdapter().fetch_wallet_data(AGENT)
    assert not snapshot.discovery_complete
    assert "agent or API wallet" in snapshot.warnings[0]
    assert calls == [{"type": "userRole", "user": AGENT}]


@pytest.mark.parametrize(
    ("mode", "expected"),
    [("unifiedAccount", "unified"), ("portfolioMargin", "portfolio_margin")],
)
def test_abstraction_accounts_include_hip3_positions(monkeypatch: pytest.MonkeyPatch, mode: str, expected: str) -> None:
    responses = base_responses(mode=mode)
    responses[("perpDexs", "", "")] = [None, {"name": "hip3"}]
    responses[("clearinghouseState", MASTER, "hip3")] = clearing(perp("XYZ", "1", "100"))
    snapshot, positions = normalized(monkeypatch, responses)
    assert snapshot.discovery_metadata["account_mode"] == expected
    assert any(position.asset == "XYZ" for position in positions)


def test_empty_standard_account(monkeypatch: pytest.MonkeyPatch) -> None:
    snapshot, positions = normalized(monkeypatch, base_responses())
    assert snapshot.discovery_complete
    assert positions == []


@pytest.mark.parametrize("failed_type", ["userAbstraction", "subAccounts"])
def test_required_discovery_failure_is_incomplete(monkeypatch: pytest.MonkeyPatch, failed_type: str) -> None:
    responses = base_responses()
    install_info(monkeypatch, responses, {failed_type})
    snapshot = HyperliquidAdapter().fetch_wallet_data(MASTER)
    assert not snapshot.discovery_complete
    assert failed_type in snapshot.discovery_metadata["request_failures"]


def test_spot_only_supported_balance(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("spotMetaAndAssetCtxs", "", "")] = [
        {"universe": [{"tokens": [150, 0]}]},
        [{"midPx": "35"}],
    ]
    responses[("spotClearinghouseState", MASTER, "")] = spot(
        {"coin": "HYPE", "token": 150, "total": "2", "entryNtl": "60"}
    )
    _, positions = normalized(monkeypatch, responses)
    assert len(positions) == 1
    assert positions[0].position_type == "spot"
    assert positions[0].current_value_usd == 70


def test_dust_balance_is_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("spotClearinghouseState", MASTER, "")] = spot(
        {"coin": "USDC", "token": 0, "total": str(MIN_POSITION_VALUE_USD - 0.01), "entryNtl": "0"}
    )
    _, positions = normalized(monkeypatch, responses)
    assert positions == []


def test_multiple_subaccounts(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("subAccounts", MASTER, "")] = [
        {"name": "One", "subAccountUser": SUB_ONE, "master": MASTER},
        {"name": "Two", "subAccountUser": SUB_TWO, "master": MASTER},
    ]
    for address, coin in [(SUB_ONE, "ETH"), (SUB_TWO, "BTC")]:
        responses[("clearinghouseState", address, "")] = clearing(perp(coin))
        responses[("spotClearinghouseState", address, "")] = spot()
    snapshot, positions = normalized(monkeypatch, responses)
    assert snapshot.discovery_metadata["subaccounts_checked"] == 2
    assert {position.asset for position in positions} == {"ETH", "BTC"}


def test_historical_activity_is_not_position_evidence(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = install_info(monkeypatch, base_responses())
    adapter = HyperliquidAdapter()
    positions = adapter.normalize_positions(adapter.fetch_wallet_data(MASTER))
    assert positions == []
    assert all(call["type"] not in {"portfolio", "userFills", "historicalOrders"} for call in calls)


def test_real_positions_are_never_replaced_with_demo_data(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = base_responses()
    responses[("clearinghouseState", MASTER, "")] = clearing(perp("DOGE", "20", "300"))
    _, positions = normalized(monkeypatch, responses)
    assert [position.asset for position in positions] == ["DOGE"]


def test_incomplete_discovery_returns_insufficient_data(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    responses = base_responses()
    install_info(monkeypatch, responses, {"subAccounts"})
    monkeypatch.setattr(
        wallet_analyzer,
        "_select_adapters",
        lambda networks, protocols: [HyperliquidAdapter()],
    )
    response = client.post(
        "/wallet/analyze",
        json={
            "wallet_address": MASTER,
            "networks": ["hyperliquid"],
            "protocols": ["hyperliquid"],
            "stress_profile": "standard",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["assessment_status"] == "insufficient_data"
    assert data["recommendation"] is None
    assert data["protocol_errors"][0]["error_type"] == "DiscoveryIncomplete"
