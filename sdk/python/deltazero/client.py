from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from .models import (
    AuditRequest,
    AuditResponse,
    BuildRequest,
    BuildResponse,
    StressTestRequest,
    StressTestResponse,
    WalletAnalyzeRequest,
    WalletPortfolioResponse,
)


class DeltaZeroError(Exception):
    pass


@dataclass
class DeltaZeroHTTPError(DeltaZeroError):
    status: int
    url: str
    body: Any

    def __str__(self) -> str:  # pragma: no cover - simple formatting
        return f"API {self.status}: {self.body}"


@dataclass
class DeltaZeroTimeoutError(DeltaZeroError):
    url: str
    timeout_s: float

    def __str__(self) -> str:  # pragma: no cover - simple formatting
        return f"Request to {self.url} timed out after {self.timeout_s:.1f}s."


@dataclass
class DeltaZeroResponseError(DeltaZeroError):
    url: str
    message: str

    def __str__(self) -> str:  # pragma: no cover - simple formatting
        return self.message


def _normalize_base_url(base_url: str) -> str:
    base_url = base_url.strip()
    if not base_url:
        raise DeltaZeroError("A base_url is required.")
    return base_url[:-1] if base_url.endswith("/") else base_url


def _parse_json_body(raw: bytes, url: str) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DeltaZeroResponseError(url, f"Invalid JSON returned from {url}.") from exc
    if data is None:
        return None
    if not isinstance(data, dict):
        raise DeltaZeroResponseError(url, f"Invalid response body returned from {url}.")
    return data


def _extract_error_message(data: Any, fallback: str) -> str:
    if isinstance(data, dict):
        detail = data.get("detail")
        if isinstance(detail, str):
            return detail
        if detail is not None:
            return json.dumps(detail)
    if isinstance(data, str) and data.strip():
        return data
    return fallback


class DeltaZeroClient:
    def __init__(self, base_url: str, timeout_s: float = 10.0) -> None:
        self.base_url = _normalize_base_url(base_url)
        self.timeout_s = timeout_s

    def _request(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        payload = json.dumps(body).encode("utf-8")
        req = request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=self.timeout_s) as response:
                parsed = _parse_json_body(response.read(), url)
                if parsed is None:
                    raise DeltaZeroResponseError(url, f"Invalid response body returned from {url}.")
                return parsed
        except error.HTTPError as exc:
            raw = exc.read() if exc.fp else b""
            body_data = _parse_json_body(raw, url) if raw else None
            raise DeltaZeroHTTPError(exc.code, url, _extract_error_message(body_data, exc.reason or "Request failed.")) from exc
        except (socket.timeout, TimeoutError) as exc:
            raise DeltaZeroTimeoutError(url, self.timeout_s) from exc
        except error.URLError as exc:
            reason = exc.reason
            if isinstance(reason, (socket.timeout, TimeoutError)):
                raise DeltaZeroTimeoutError(url, self.timeout_s) from exc
            raise DeltaZeroError(str(reason)) from exc

    def build_strategy(self, request_body: BuildRequest) -> BuildResponse:
        return self._request("/strategy/build", request_body)  # type: ignore[return-value]

    def audit_position(self, request_body: AuditRequest) -> AuditResponse:
        return self._request("/strategy/audit", request_body)  # type: ignore[return-value]

    def stress_test(self, request_body: StressTestRequest) -> StressTestResponse:
        return self._request("/strategy/stress-test", request_body)  # type: ignore[return-value]

    def audit_wallet(self, request_body: WalletAnalyzeRequest) -> WalletPortfolioResponse:
        return self._request("/wallet/analyze", request_body)  # type: ignore[return-value]
