"""Regression tests for bounded request-body handling."""

from __future__ import annotations

import asyncio

import pytest

from app import request_limits


def test_body_reader_enforces_a_total_read_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(request_limits, "REQUEST_BODY_TIMEOUT_SECONDS", 0.001)

    async def receive() -> dict[str, object]:
        await asyncio.sleep(0.01)
        return {"type": "http.request", "body": b"x", "more_body": True}

    with pytest.raises(request_limits.RequestBodyLimitError, match="timed out"):
        asyncio.run(request_limits.read_bounded_body(receive))


def test_body_reader_rejects_declared_oversize_before_receive() -> None:
    calls = 0

    async def receive() -> dict[str, object]:
        nonlocal calls
        calls += 1
        return {"type": "http.request", "body": b"", "more_body": False}

    scope = {
        "type": "http",
        "headers": [
            (b"content-length", str(request_limits.MAX_REQUEST_BODY_BYTES + 1).encode())
        ],
    }

    with pytest.raises(request_limits.RequestBodyLimitError, match="byte limit"):
        asyncio.run(request_limits.read_bounded_body(receive, scope=scope))
    assert calls == 0
