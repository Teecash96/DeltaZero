"""Validate DeltaZero's public A2MCP x402 boundary like an OKX reviewer.

Usage:
    python3 backend/scripts/verify_a2mcp.py
    python3 backend/scripts/verify_a2mcp.py https://example.com/mcp
"""

from __future__ import annotations

import base64
import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen


DEFAULT_ENDPOINT = "https://deltazero-production.up.railway.app/mcp"
USDT0_XLAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736"
HEADERS = {"Accept": "application/json", "Content-Type": "application/json"}


def probe(endpoint: str, payload: dict | None) -> tuple[int, dict, dict]:
    request = Request(
        endpoint,
        data=None if payload is None else json.dumps(payload).encode(),
        headers=HEADERS,
        method="POST",
    )
    try:
        response = urlopen(request, timeout=30)
    except HTTPError as error:
        response = error

    challenge_header = response.headers.get("PAYMENT-REQUIRED")
    challenge = (
        json.loads(base64.b64decode(challenge_header))
        if challenge_header
        else {}
    )
    body_bytes = response.read()
    body = json.loads(body_bytes.decode()) if body_bytes else {}
    return response.status, challenge, body


def assert_standard_challenge(endpoint: str, label: str, payload: dict | None) -> dict:
    status, challenge, _body = probe(endpoint, payload)
    if status != 402:
        raise RuntimeError(f"{label}: expected HTTP 402, received {status}")
    if challenge.get("x402Version") != 2:
        raise RuntimeError(f"{label}: missing x402Version 2 challenge")
    if challenge.get("resource", {}).get("url") != endpoint:
        raise RuntimeError(f"{label}: challenge resource URL does not match endpoint")

    exact = next(
        (entry for entry in challenge.get("accepts", []) if entry.get("scheme") == "exact"),
        None,
    )
    if exact is None:
        raise RuntimeError(f"{label}: exact payment option is missing")
    if exact.get("network") != "eip155:196" or exact.get("asset") != USDT0_XLAYER:
        raise RuntimeError(f"{label}: X Layer USD₮0 payment option is invalid")
    if exact.get("amount") != "1000000":
        raise RuntimeError(f"{label}: expected the registered 1 USD₮0 price")
    return challenge


def main() -> None:
    endpoint = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ENDPOINT
    initialize = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "okx-review-probe", "version": "1.0"},
        },
    }
    tools_list = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    paid_tool = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {"name": "delta_zero_risk_engine", "arguments": {}},
    }

    checks = {
        "bare_post": assert_standard_challenge(endpoint, "bare POST", None),
        "initialize": assert_standard_challenge(endpoint, "initialize", initialize),
        "tools_list": assert_standard_challenge(endpoint, "tools/list", tools_list),
        "tool_call": assert_standard_challenge(endpoint, "tools/call", paid_tool),
    }
    print(json.dumps({
        "endpoint": endpoint,
        "status": "x402-standard-ready",
        "validated_requests": list(checks),
        "schemes": [item["scheme"] for item in checks["tool_call"]["accepts"]],
    }, indent=2))


if __name__ == "__main__":
    main()
