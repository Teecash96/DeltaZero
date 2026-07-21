#!/usr/bin/env python3
"""Build the transparent reference cohort used by the illustrative hero gauge.

This is a bounded product-policy cohort, not a sample of live Hyperliquid users.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path


CONFIGURATION_COUNT = 1001
MIN_COLLATERAL_TO_SHORT_RATIO = 0.10
MAX_COLLATERAL_TO_SHORT_RATIO = 0.45
TARGET_SHORT_USD = 3950.0
TARGET_COLLATERAL_USD = 1500.0
MEDIUM_WARNING = 60.0
MEDIUM_CRITICAL = 40.0


def safety_buffer(collateral_usd: float, short_usd: float) -> float:
    return round(min(100.0, collateral_usd / short_usd * 200.0), 2)


def build_result() -> dict[str, object]:
    ratios = [
        MIN_COLLATERAL_TO_SHORT_RATIO
        + index * (MAX_COLLATERAL_TO_SHORT_RATIO - MIN_COLLATERAL_TO_SHORT_RATIO) / (CONFIGURATION_COUNT - 1)
        for index in range(CONFIGURATION_COUNT)
    ]
    scores = [safety_buffer(ratio * TARGET_SHORT_USD, TARGET_SHORT_USD) for ratio in ratios]
    target_score = safety_buffer(TARGET_COLLATERAL_USD, TARGET_SHORT_USD)
    percentile = sum(score <= target_score for score in scores) / len(scores) * 100

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "benchmark_type": "bounded_product_reference_cohort",
        "asset_label": "SOL neutral-carry reference configurations",
        "configuration_count": CONFIGURATION_COUNT,
        "cohort_bounds": {
            "collateral_to_short_ratio_min_pct": MIN_COLLATERAL_TO_SHORT_RATIO * 100,
            "collateral_to_short_ratio_max_pct": MAX_COLLATERAL_TO_SHORT_RATIO * 100,
            "sampling": "evenly_spaced",
        },
        "illustrative_position": {
            "short_notional_usd": TARGET_SHORT_USD,
            "collateral_usd": TARGET_COLLATERAL_USD,
            "safety_buffer_exact": target_score,
            "safety_buffer_display": round(target_score),
            "percentile_rank": round(percentile),
            "points_above_medium_warning": round(target_score - MEDIUM_WARNING, 2),
            "points_above_medium_critical": round(target_score - MEDIUM_CRITICAL, 2),
        },
        "method": "percent of reference scores less than or equal to the illustrative score",
        "limitations": [
            "This is a transparent DeltaZero policy reference cohort, not a sample of active Hyperliquid accounts.",
            "The cohort does not estimate the real-world distribution of trader collateralization.",
            "Safety Buffer is a collateral-coverage heuristic, not liquidation probability or expected profitability.",
        ],
    }


def main() -> None:
    output = Path(__file__).with_name("safety_buffer_reference.json")
    result = build_result()
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
