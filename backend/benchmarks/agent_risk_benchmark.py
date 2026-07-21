#!/usr/bin/env python3
"""Reproducible local benchmark for DeltaZero's agent-facing risk contract.

This measures the in-process FastAPI application. It intentionally excludes
network latency, cold starts, protocol data fetches, and payment settlement.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import platform
import statistics
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.main import create_app


RISK_ENGINE_PAYLOAD = {
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
    "stress_magnitude_pct": 4,
    "simulation_count": 1000,
    "time_horizon_days": 30,
    "seed": 42,
}

BASE_BUILD = {
    "asset": "SOL",
    "capital_usd": 5000,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
}

BASE_AUDIT = {
    "asset": "SOL",
    "long_notional_usd": 3800,
    "short_notional_usd": 3000,
    "collateral_usd": 1200,
    "risk_tolerance": "medium",
    "long_yield_apy": 12,
    "short_funding_apy": 4,
    "fee_drag_apy": 1,
}

BASE_MONTE_CARLO = {
    "asset": "SOL",
    "capital_usd": 5000,
    "long_notional_usd": 3500,
    "short_notional_usd": 3360,
    "collateral_usd": 1500,
    "long_yield_apy": 14,
    "short_funding_apy": 3,
    "fee_drag_apy": 1,
    "risk_tolerance": "medium",
    "target_style": "neutral_yield",
    "simulation_count": 1000,
    "time_horizon_days": 30,
    "seed": 7,
}

EXPECTED_REPORT_KEYS = {
    "strategy_build",
    "hedge_drift_audit",
    "funding_stress_test",
    "monte_carlo_sensitivity",
}


def normalize(value: Any) -> Any:
    """Remove timestamps while preserving every decision-bearing field."""

    if isinstance(value, dict):
        return {
            key: normalize(item)
            for key, item in sorted(value.items())
            if key not in {"generated_at", "market_data_timestamp", "data_timestamp"}
        }
    if isinstance(value, list):
        return [normalize(item) for item in value]
    return value


def fingerprint(value: Any) -> str:
    encoded = json.dumps(normalize(value), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = max(0, math.ceil(fraction * len(ordered)) - 1)
    return ordered[index]


def policy_fixtures() -> list[dict[str, Any]]:
    healthy_audit = {
        **BASE_AUDIT,
        "long_notional_usd": 4000,
        "short_notional_usd": 3840,
    }
    return [
        {"name": "build_open", "path": "/strategy/build", "payload": BASE_BUILD, "allowed": ["OPEN"]},
        {
            "name": "build_negative_carry_wait",
            "path": "/strategy/build",
            "payload": {**BASE_BUILD, "long_yield_apy": 2, "short_funding_apy": 6},
            "allowed": ["WAIT"],
        },
        {
            "name": "build_aggressive_negative_wait",
            "path": "/strategy/build",
            "payload": {
                **BASE_BUILD,
                "target_style": "aggressive_carry",
                "long_yield_apy": 2,
                "short_funding_apy": 6,
            },
            "allowed": ["WAIT"],
        },
        {
            "name": "build_borderline_wait",
            "path": "/strategy/build",
            "payload": {**BASE_BUILD, "long_yield_apy": 4, "short_funding_apy": 2.5},
            "allowed": ["WAIT"],
        },
        {"name": "audit_drift_rebalance", "path": "/strategy/audit", "payload": BASE_AUDIT, "allowed": ["REBALANCE"]},
        {"name": "audit_healthy_hold", "path": "/strategy/audit", "payload": healthy_audit, "allowed": ["HOLD"]},
        {
            "name": "audit_severe_reduce_or_close",
            "path": "/strategy/audit",
            "payload": {
                **BASE_AUDIT,
                "long_notional_usd": 5200,
                "short_notional_usd": 2600,
                "collateral_usd": 150,
                "long_yield_apy": 8,
                "short_funding_apy": 7,
                "fee_drag_apy": 2,
            },
            "allowed": ["REDUCE", "CLOSE"],
        },
        {
            "name": "audit_weak_buffer_reduce",
            "path": "/strategy/audit",
            "payload": {**BASE_AUDIT, "long_notional_usd": 4000, "short_notional_usd": 3880, "collateral_usd": 150},
            "allowed": ["REDUCE"],
        },
        {
            "name": "stress_negative_carry_de_risk",
            "path": "/stress-test/run",
            "payload": {**healthy_audit, "scenario": {"type": "funding_worsens", "magnitude_pct": 12}},
            "allowed": ["WAIT", "REDUCE", "CLOSE"],
        },
        {
            "name": "monte_carlo_low_risk_proceed",
            "path": "/monte-carlo/run",
            "payload": {
                **BASE_MONTE_CARLO,
                "market_shock_volatility_pct": 1,
                "funding_shift_volatility_apy": 1,
                "slippage_mean_pct": 0.1,
                "slippage_volatility_pct": 0.1,
                "collateral_haircut_mean_pct": 0,
                "collateral_haircut_volatility_pct": 0.1,
                "protocol_loss_volatility_pct": 0.1,
            },
            "allowed": ["PROCEED"],
            "summary_action": True,
        },
        {
            "name": "monte_carlo_baseline_adjust",
            "path": "/monte-carlo/run",
            "payload": BASE_MONTE_CARLO,
            "allowed": ["ADJUST"],
            "summary_action": True,
        },
        {
            "name": "monte_carlo_severe_avoid",
            "path": "/monte-carlo/run",
            "payload": {
                **BASE_MONTE_CARLO,
                "market_shock_mean_pct": -40,
                "market_shock_volatility_pct": 25,
                "collateral_haircut_mean_pct": 30,
                "protocol_loss_mean_pct": 20,
            },
            "allowed": ["AVOID"],
            "summary_action": True,
        },
    ]


def run_benchmark(runs: int, warmups: int) -> dict[str, Any]:
    logging.getLogger("httpx").setLevel(logging.WARNING)
    client = TestClient(create_app())

    for _ in range(warmups):
        response = client.post("/risk-engine/analyze", json=RISK_ENGINE_PAYLOAD)
        response.raise_for_status()

    durations: list[float] = []
    hashes: list[str] = []
    valid_responses = 0
    for _ in range(runs):
        started = time.perf_counter_ns()
        response = client.post("/risk-engine/analyze", json=RISK_ENGINE_PAYLOAD)
        durations.append((time.perf_counter_ns() - started) / 1_000_000)
        response.raise_for_status()
        body = response.json()
        hashes.append(fingerprint(body))
        if body.get("service") == "risk_engine_pass" and EXPECTED_REPORT_KEYS.issubset(body):
            valid_responses += 1

    fixture_results = []
    for fixture in policy_fixtures():
        response = client.post(fixture["path"], json=fixture["payload"])
        response.raise_for_status()
        body = response.json()
        if fixture.get("summary_action"):
            actual = body["summary"]["recommendation"]
        else:
            actual = body["recommendation"]["action"]
        fixture_results.append(
            {
                "name": fixture["name"],
                "actual": actual,
                "allowed": fixture["allowed"],
                "passed": actual in fixture["allowed"],
            }
        )

    canonical_hash = hashes[0]
    identical = sum(item == canonical_hash for item in hashes)
    passed_fixtures = sum(item["passed"] for item in fixture_results)

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "scope": "Local in-process FastAPI TestClient benchmark",
        "environment": {"python": platform.python_version(), "platform": platform.platform()},
        "workload": {
            "endpoint": "POST /risk-engine/analyze",
            "reports_per_call": 4,
            "monte_carlo_paths": RISK_ENGINE_PAYLOAD["simulation_count"],
            "seed": RISK_ENGINE_PAYLOAD["seed"],
            "warmups": warmups,
            "measured_runs": runs,
        },
        "latency_ms": {
            "minimum": round(min(durations), 2),
            "p50": round(statistics.median(durations), 2),
            "p95": round(percentile(durations, 0.95), 2),
            "maximum": round(max(durations), 2),
        },
        "repeatability": {"identical_normalized_outputs": identical, "total_runs": runs},
        "schema_validity": {"valid_responses": valid_responses, "total_runs": runs},
        "reference_policy_fixtures": {
            "passed": passed_fixtures,
            "total": len(fixture_results),
            "cases": fixture_results,
        },
        "limitations": [
            "Latency excludes network transit, cold starts, public-protocol adapters, and x402 settlement.",
            "Timestamp fields are removed before repeatability hashes are compared.",
            "Reference-policy agreement verifies expected product rules; it is not a profitability or real-world loss forecast.",
            "No synthetic latency or error-rate numbers are assigned to ad-hoc scripts or spreadsheets because no canonical implementation was tested.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=50)
    parser.add_argument("--warmups", type=int, default=5)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).with_name("results.json"),
    )
    args = parser.parse_args()
    if args.runs < 1 or args.warmups < 0:
        raise SystemExit("runs must be positive and warmups cannot be negative")

    result = run_benchmark(args.runs, args.warmups)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
