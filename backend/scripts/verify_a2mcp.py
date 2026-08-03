"""Validate DeltaZero's public A2MCP x402 boundary like an OKX reviewer.

Usage:
    python3 backend/scripts/verify_a2mcp.py
    python3 backend/scripts/verify_a2mcp.py https://example.com/mcp
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


DEFAULT_ENDPOINT = "https://deltazero-production.up.railway.app/mcp"
USDT0_XLAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736"
HEADERS = {"Accept": "application/json", "Content-Type": "application/json"}
REVIEW_TIMEOUT_SECONDS = 10


def probe(
    endpoint: str,
    payload: dict | None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict, dict, dict[str, str], float]:
    request = Request(
        endpoint,
        data=None if payload is None else json.dumps(payload).encode(),
        headers=headers or HEADERS,
        method="POST",
    )
    started = time.perf_counter()
    try:
        response = urlopen(request, timeout=REVIEW_TIMEOUT_SECONDS)
    except HTTPError as error:
        response = error
    elapsed = time.perf_counter() - started

    challenge_header = response.headers.get("PAYMENT-REQUIRED")
    challenge = (
        json.loads(base64.b64decode(challenge_header))
        if challenge_header
        else {}
    )
    body_bytes = response.read()
    try:
        body = json.loads(body_bytes.decode()) if body_bytes else {}
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"{endpoint}: response was not valid JSON") from exc
    response_headers = {key.lower(): value for key, value in response.headers.items()}
    return response.status, challenge, body, response_headers, elapsed


def assert_standard_challenge(
    endpoint: str,
    label: str,
    payload: dict | None,
    headers: dict[str, str] | None = None,
) -> dict:
    status, challenge, _body, response_headers, elapsed = probe(endpoint, payload, headers)
    if status != 402:
        raise RuntimeError(f"{label}: expected HTTP 402, received {status}")
    if elapsed >= REVIEW_TIMEOUT_SECONDS:
        raise RuntimeError(f"{label}: response exceeded {REVIEW_TIMEOUT_SECONDS}s")
    if not response_headers.get("content-type", "").startswith("application/json"):
        raise RuntimeError(f"{label}: expected an application/json response")
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


def assert_paid_replay(
    endpoint: str,
    label: str,
    payload: dict,
    payment_signature: str,
) -> tuple[dict, dict[str, str], float]:
    headers = {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": payment_signature,
    }
    status, _challenge, body, response_headers, elapsed = probe(endpoint, payload, headers)
    if status == 406:
        raise RuntimeError(f"{label}: paid replay returned HTTP 406")
    if status != 200:
        raise RuntimeError(f"{label}: expected HTTP 200, received {status}")
    if elapsed >= REVIEW_TIMEOUT_SECONDS:
        raise RuntimeError(f"{label}: response exceeded {REVIEW_TIMEOUT_SECONDS}s")
    if not response_headers.get("content-type", "").startswith("application/json"):
        raise RuntimeError(f"{label}: expected an application/json response")
    if body.get("jsonrpc") != "2.0" or "result" not in body:
        raise RuntimeError(f"{label}: response is not a standard JSON-RPC result")
    if "payment-response" not in response_headers:
        raise RuntimeError(f"{label}: successful replay did not include PAYMENT-RESPONSE")
    return body, response_headers, elapsed


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

    wildcard_headers = {"Accept": "*/*", "Content-Type": "application/json"}
    missing_accept_headers = {"Content-Type": "application/json"}
    checks = {
        "bare_post": assert_standard_challenge(endpoint, "bare POST", None),
        "initialize": assert_standard_challenge(endpoint, "initialize", initialize),
        "tools_list": assert_standard_challenge(endpoint, "tools/list", tools_list),
        "tool_call": assert_standard_challenge(endpoint, "tools/call", paid_tool),
        "tool_call_wildcard_accept": assert_standard_challenge(
            endpoint, "tools/call wildcard Accept", paid_tool, wildcard_headers
        ),
        "tool_call_missing_accept": assert_standard_challenge(
            endpoint, "tools/call missing Accept", paid_tool, missing_accept_headers
        ),
    }
    result = {
        "endpoint": endpoint,
        "status": "x402-standard-ready",
        "validated_requests": list(checks),
        "schemes": [item["scheme"] for item in checks["tool_call"]["accepts"]],
    }

    payment_signature = os.getenv("PAYMENT_SIGNATURE", "").strip()
    if payment_signature:
        first, first_headers, first_elapsed = assert_paid_replay(
            endpoint, "paid tools/call", paid_tool, payment_signature
        )
        second, second_headers, second_elapsed = assert_paid_replay(
            endpoint, "paid tools/call retry", paid_tool, payment_signature
        )
        first_hash = (
            first.get("result", {})
            .get("structuredContent", {})
            .get("risk_envelope", {})
            .get("proof", {})
            .get("output_hash")
        )
        second_hash = (
            second.get("result", {})
            .get("structuredContent", {})
            .get("risk_envelope", {})
            .get("proof", {})
            .get("output_hash")
        )
        if not first_hash or first_hash != second_hash:
            raise RuntimeError("paid replay did not preserve the deterministic output hash")
        if second_headers.get("x-deltazero-replay") != "recovered":
            raise RuntimeError("identical paid retry was not recovered from the replay store")
        result["paid_replay"] = {
            "status": "verified",
            "first_elapsed_seconds": round(first_elapsed, 3),
            "retry_elapsed_seconds": round(second_elapsed, 3),
            "deterministic_output_hash": first_hash,
            "retry": second_headers.get("x-deltazero-replay"),
            "settlement_receipt": "PAYMENT-RESPONSE",
        }
    else:
        result["paid_replay"] = (
            "not run; set PAYMENT_SIGNATURE from an x402-compatible client "
            "to verify the live settlement and retry path"
        )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
