"""Verify DeltaZero's public MCP transport the way an OKX reviewer can.

Usage:
    python3 backend/scripts/verify_a2mcp.py
    python3 backend/scripts/verify_a2mcp.py https://example.com/mcp
"""

from __future__ import annotations

import json
import sys
import time
from urllib.request import Request, urlopen


DEFAULT_ENDPOINT = "https://deltazero-production.up.railway.app/mcp"
HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


def post(endpoint: str, payload: dict) -> tuple[dict, float]:
    started = time.perf_counter()
    request = Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers=HEADERS,
        method="POST",
    )
    with urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode())
        if response.status != 200:
            raise RuntimeError(f"Unexpected HTTP status: {response.status}")
    return body, time.perf_counter() - started


def main() -> None:
    endpoint = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ENDPOINT
    initialize, initialize_seconds = post(
        endpoint,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "okx-review-probe", "version": "1.0"},
            },
        },
    )
    tools, discovery_seconds = post(
        endpoint,
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    )
    result, call_seconds = post(
        endpoint,
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "build_neutral_strategy",
                "arguments": {
                    "request": {
                        "asset": "SOL",
                        "capital_usd": 5000,
                        "risk_tolerance": "medium",
                        "target_style": "neutral_yield",
                        "long_yield_apy": 14,
                        "short_funding_apy": 3,
                        "fee_drag_apy": 1,
                    }
                },
            },
        },
    )

    if "error" in initialize or "error" in tools or result["result"].get("isError"):
        raise RuntimeError("MCP review probe returned a protocol or tool error")

    summary = {
        "endpoint": endpoint,
        "server": initialize["result"]["serverInfo"],
        "tool_count": len(tools["result"]["tools"]),
        "sample_tool": "build_neutral_strategy",
        "sample_action": result["result"]["structuredContent"]["recommendation"]["action"],
        "latency_ms": {
            "initialize": round(initialize_seconds * 1000),
            "discovery": round(discovery_seconds * 1000),
            "tool_call": round(call_seconds * 1000),
        },
        "status": "ready",
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
