"""Hylo Solana adapter tests."""

from __future__ import annotations

import httpx

from app.integrations.hylo import HYLO_ASSETS, HyloAdapter
from app.services.position_normalizer import normalize_hylo_positions


SOLANA_WALLET = "8xKJ8YvM3cSgQxv8g7f3pQ9zvQkJ4JrV2aY3hB6cD7eF"
HYUSD_MINT = next(mint for mint, name in HYLO_ASSETS.items() if name == "hyUSD")


def test_hylo_adapter_reads_supported_spl_balances(monkeypatch) -> None:
    def fake_post(url, *, json, timeout):
        assert json["method"] == "getTokenAccountsByOwner"
        assert json["params"][0] == SOLANA_WALLET
        return httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "result": {
                    "context": {"slot": 12345},
                    "value": [
                        {
                            "account": {
                                "data": {
                                    "parsed": {
                                        "info": {
                                            "mint": HYUSD_MINT,
                                            "tokenAmount": {
                                                "uiAmountString": "250.5",
                                                "decimals": 6,
                                            },
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "account": {
                                "data": {
                                    "parsed": {
                                        "info": {
                                            "mint": "not-a-hylo-mint",
                                            "tokenAmount": {"uiAmountString": "99"},
                                        }
                                    }
                                }
                            }
                        },
                    ],
                },
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    snapshot = HyloAdapter(rpc_url="https://rpc.example").fetch_wallet_data(SOLANA_WALLET)

    assert snapshot.discovery_metadata["slot"] == 12345
    assert snapshot.market_context["valuation_status"] == "unavailable"
    assert len(snapshot.raw_positions) == 1
    assert snapshot.raw_positions[0]["asset"] == "hyUSD"
    assert snapshot.raw_positions[0]["quantity"] == 250.5

    normalized = normalize_hylo_positions(
        {
            "positions": snapshot.raw_positions,
            "market_context": snapshot.market_context,
            "data_timestamp": snapshot.data_timestamp,
        }
    )
    assert normalized[0].protocol == "hylo"
    assert normalized[0].network == "solana"
    assert normalized[0].quantity == 250.5
    assert normalized[0].current_value_usd is None
    assert normalized[0].data_quality == "partial"


def test_hylo_adapter_rejects_non_solana_address() -> None:
    try:
        HyloAdapter().fetch_wallet_data("0x1234567890abcdef1234567890abcdef12345678")
    except ValueError as exc:
        assert "base58 Solana" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("Expected invalid Solana address to be rejected")
