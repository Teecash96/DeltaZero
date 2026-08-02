"""Shared limits for unauthenticated and payment-gated request processing."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Awaitable, Callable


DEFAULT_MAX_REQUEST_BODY_BYTES = 1_048_576
DEFAULT_REQUEST_BODY_TIMEOUT_SECONDS = 10.0


class RequestBodyLimitError(ValueError):
    """Raised when a request body exceeds an application resource limit."""


def _positive_int_environment(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer") from exc
    if parsed <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return parsed


def _positive_float_environment(name: str, default: float) -> float:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        parsed = float(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive number") from exc
    if parsed <= 0:
        raise RuntimeError(f"{name} must be a positive number")
    return parsed


MAX_REQUEST_BODY_BYTES = _positive_int_environment(
    "DELTAZERO_MAX_REQUEST_BODY_BYTES",
    DEFAULT_MAX_REQUEST_BODY_BYTES,
)
REQUEST_BODY_TIMEOUT_SECONDS = _positive_float_environment(
    "DELTAZERO_REQUEST_BODY_TIMEOUT_SECONDS",
    DEFAULT_REQUEST_BODY_TIMEOUT_SECONDS,
)


def content_length(scope: dict[str, Any]) -> int | None:
    """Return a valid declared body length, if one was supplied."""

    for name, value in scope.get("headers", []):
        if name.lower() != b"content-length":
            continue
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed >= 0 else None
    return None


def enforce_declared_content_length(scope: dict[str, Any]) -> None:
    """Reject an oversized declared body before reading attacker input."""

    declared = content_length(scope)
    if declared is not None and declared > MAX_REQUEST_BODY_BYTES:
        raise RequestBodyLimitError(
            f"Request body exceeds the {MAX_REQUEST_BODY_BYTES} byte limit"
        )


async def read_bounded_body(
    receive: Callable[[], Awaitable[dict[str, Any]]],
    *,
    scope: dict[str, Any] | None = None,
) -> bytes:
    """Read an ASGI body with byte and total read time limits."""

    if scope is not None:
        enforce_declared_content_length(scope)

    chunks: list[bytes] = []
    total = 0
    loop = asyncio.get_running_loop()
    deadline = loop.time() + REQUEST_BODY_TIMEOUT_SECONDS
    while True:
        remaining = deadline - loop.time()
        if remaining <= 0:
            raise RequestBodyLimitError("Request body receive timed out")
        try:
            message = await asyncio.wait_for(
                receive(),
                timeout=remaining,
            )
        except asyncio.TimeoutError as exc:
            raise RequestBodyLimitError("Request body receive timed out") from exc

        message_type = message.get("type")
        if message_type == "http.disconnect":
            raise RequestBodyLimitError("Client disconnected before request completion")
        if message_type != "http.request":
            continue

        chunk = message.get("body", b"")
        if not isinstance(chunk, bytes):
            raise RequestBodyLimitError("Request body chunk is invalid")
        total += len(chunk)
        if total > MAX_REQUEST_BODY_BYTES:
            raise RequestBodyLimitError(
                f"Request body exceeds the {MAX_REQUEST_BODY_BYTES} byte limit"
            )
        chunks.append(chunk)
        if not message.get("more_body", False):
            return b"".join(chunks)
