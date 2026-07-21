from __future__ import annotations

import io
import json
import unittest
from socket import timeout as socket_timeout
from unittest.mock import patch
from urllib.error import HTTPError

from deltazero.client import DeltaZeroClient, DeltaZeroHTTPError, DeltaZeroResponseError, DeltaZeroTimeoutError


def response(data: dict[str, object]) -> object:
    class _Response:
        def read(self) -> bytes:
            return json.dumps(data).encode("utf-8")

        def __enter__(self) -> "_Response":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

    return _Response()


class DeltaZeroClientTests(unittest.TestCase):
    def test_successful_builder_request(self) -> None:
        client = DeltaZeroClient("https://example.com")
        with patch("deltazero.client.request.urlopen", return_value=response({"recommendation": {"action": "OPEN"}})):
            report = client.build_strategy(
                {
                    "asset": "SOL",
                    "capital_usd": 5000,
                    "risk_tolerance": "medium",
                    "target_style": "neutral_yield",
                    "long_yield_apy": 14,
                    "short_funding_apy": 3,
                    "fee_drag_apy": 1,
                }
            )
        self.assertEqual(report["recommendation"]["action"], "OPEN")

    def test_successful_risk_envelope_request(self) -> None:
        client = DeltaZeroClient("https://example.com")
        envelope = {
            "schema_id": "https://deltazero.dev/schemas/risk-envelope/v1",
            "schema_version": "1.0.0",
            "decision": {"action": "OPEN", "human_approval_required": True},
        }
        with patch("deltazero.client.request.urlopen", return_value=response(envelope)):
            report = client.evaluate_risk_envelope(
                {
                    "asset": "SOL",
                    "capital_usd": 5000,
                    "risk_tolerance": "medium",
                    "target_style": "neutral_yield",
                    "long_yield_apy": 14,
                    "short_funding_apy": 3,
                    "fee_drag_apy": 1,
                }
            )
        self.assertEqual(report["schema_version"], "1.0.0")
        self.assertTrue(report["decision"]["human_approval_required"])

    def test_successful_auditor_request(self) -> None:
        client = DeltaZeroClient("https://example.com")
        with patch("deltazero.client.request.urlopen", return_value=response({"actions": ["HOLD"]})):
            report = client.audit_position(
                {
                    "asset": "SOL",
                    "long_notional_usd": 3800,
                    "short_notional_usd": 3000,
                    "collateral_usd": 1200,
                    "risk_tolerance": "medium",
                    "long_yield_apy": 12,
                    "short_funding_apy": 4,
                    "fee_drag_apy": 1,
                }
            )
        self.assertEqual(report["actions"][0], "HOLD")

    def test_successful_stress_test_request(self) -> None:
        client = DeltaZeroClient("https://example.com")
        with patch("deltazero.client.request.urlopen", return_value=response({"actions": ["REBALANCE"]})):
            report = client.stress_test(
                {
                    "asset": "SOL",
                    "long_notional_usd": 3500,
                    "short_notional_usd": 3150,
                    "collateral_usd": 1500,
                    "risk_tolerance": "medium",
                    "long_yield_apy": 14,
                    "short_funding_apy": 3,
                    "fee_drag_apy": 1,
                    "scenario": {"type": "funding_worsens", "magnitude_pct": 4},
                }
            )
        self.assertEqual(report["actions"][0], "REBALANCE")

    def test_successful_wallet_request(self) -> None:
        client = DeltaZeroClient("https://example.com")
        with patch(
            "deltazero.client.request.urlopen",
            return_value=response({"recommendation": {"action": "HOLD", "summary": "Hold.", "confidence": 94}}),
        ):
            report = client.audit_wallet(
                {
                    "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
                    "networks": ["ethereum", "hyperliquid"],
                    "protocols": ["hyperliquid", "aave"],
                    "stress_profile": "standard",
                }
            )
        self.assertEqual(report["recommendation"]["action"], "HOLD")

    def test_timeout_handling(self) -> None:
        client = DeltaZeroClient("https://example.com", timeout_s=0.001)

        def _timeout(*args, **kwargs):
            raise socket_timeout()

        with patch("deltazero.client.request.urlopen", side_effect=_timeout):
            with self.assertRaises(DeltaZeroTimeoutError):
                client.build_strategy(
                    {
                        "asset": "SOL",
                        "capital_usd": 5000,
                        "risk_tolerance": "medium",
                        "target_style": "neutral_yield",
                        "long_yield_apy": 14,
                        "short_funding_apy": 3,
                        "fee_drag_apy": 1,
                    }
                )

    def test_non_2xx_response(self) -> None:
        client = DeltaZeroClient("https://example.com")
        http_error = HTTPError(
            "https://example.com/strategy/build",
            400,
            "Bad Request",
            hdrs=None,
            fp=io.BytesIO(json.dumps({"detail": "Bad request"}).encode("utf-8")),
        )
        with patch("deltazero.client.request.urlopen", side_effect=http_error):
            with self.assertRaises(DeltaZeroHTTPError) as excinfo:
                client.build_strategy(
                    {
                        "asset": "SOL",
                        "capital_usd": 5000,
                        "risk_tolerance": "medium",
                        "target_style": "neutral_yield",
                        "long_yield_apy": 14,
                        "short_funding_apy": 3,
                        "fee_drag_apy": 1,
                    }
                )
        self.assertEqual(excinfo.exception.status, 400)

    def test_invalid_response_body(self) -> None:
        client = DeltaZeroClient("https://example.com")

        class BadResponse:
            def read(self) -> bytes:
                return b"not-json"

            def __enter__(self) -> "BadResponse":
                return self

            def __exit__(self, exc_type, exc, tb) -> None:
                return None

        with patch("deltazero.client.request.urlopen", return_value=BadResponse()):
            with self.assertRaises(DeltaZeroResponseError):
                client.build_strategy(
                    {
                        "asset": "SOL",
                        "capital_usd": 5000,
                        "risk_tolerance": "medium",
                        "target_style": "neutral_yield",
                        "long_yield_apy": 14,
                        "short_funding_apy": 3,
                        "fee_drag_apy": 1,
                    }
                )


if __name__ == "__main__":
    unittest.main()
