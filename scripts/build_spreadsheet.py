#!/usr/bin/env python3
"""Canonical spreadsheet builder.

This compatibility entrypoint now builds the v2 workbook. The previous v1
implementation was mode-sensitive and can still produce stale labels such as
"Annual Income Target"; use the v2 Python reference model as the source of
truth.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.build_spreadsheet_v2 import build_workbook_v2


DEFAULT_OUTPUT = "btc_leveraged_model_v2.xlsx"


def build_workbook(output_path: str | Path = DEFAULT_OUTPUT) -> Path:
    """Build the canonical v2 BTC-backed loan workbook."""

    return build_workbook_v2(output_path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the BTC-backed loan model workbook.")
    parser.add_argument(
        "--output",
        "-o",
        default=DEFAULT_OUTPUT,
        help=f"Output .xlsx path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)

    path = build_workbook(args.output)
    print(f"Wrote {path}")
    print("Workbook version: v2 Python reference model")
    print("Tabs: Inputs | Price Projection | Accumulation Engine | Income Engine | Risk Alerts | Summary | Audit Examples")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
