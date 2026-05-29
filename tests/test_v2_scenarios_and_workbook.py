from __future__ import annotations

import sys
from pathlib import Path

import pytest
from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from model_v2.scenarios import default_v2_inputs, run_v2_projection  # noqa: E402
from scripts.build_spreadsheet import build_workbook as build_canonical_workbook  # noqa: E402
from scripts.build_spreadsheet_v2 import build_workbook_v2  # noqa: E402


def test_default_projection_contains_setup_plus_ten_annual_rows() -> None:
    projection = run_v2_projection(default_v2_inputs(projection_years=10))

    assert len(projection.price_points) == 11
    assert len(projection.accumulation_rows) == 11
    assert len(projection.income_rows) == 11
    assert projection.accumulation_rows[0].year == 0
    assert projection.income_rows[0].year == 0
    assert projection.accumulation_rows[-1].year == 10
    assert projection.income_rows[-1].year == 10


def test_default_projection_preserves_audit_setup_example() -> None:
    projection = run_v2_projection(default_v2_inputs(projection_years=1))
    row = projection.accumulation_rows[0]

    assert row.collateral_btc == pytest.approx(2.6666666667)
    assert row.btc_purchased == pytest.approx(0.6666666667)
    assert row.debt_usd == pytest.approx(40_000.0)
    assert row.effective_ltv == pytest.approx(0.25)
    assert row.liquidation_price == pytest.approx(20_000.0)


def test_default_income_projection_reports_capacity_shortfall() -> None:
    projection = run_v2_projection(default_v2_inputs(projection_years=1))
    row = projection.income_rows[1]

    assert row.income_borrowed_usd == pytest.approx(42_000.0)
    assert row.income_shortfall_usd == pytest.approx(8_000.0)
    assert row.warning == "CONSTRAINED"


def test_v2_workbook_builder_creates_expected_tabs_and_values(tmp_path: Path) -> None:
    output_path = tmp_path / "btc_model_v2.xlsx"

    build_workbook_v2(output_path)

    wb = load_workbook(output_path, data_only=False)
    assert wb.sheetnames == [
        "Inputs",
        "Price Projection",
        "Accumulation Engine",
        "Income Engine",
        "Risk Alerts",
        "Summary",
        "Audit Examples",
    ]

    summary = wb["Summary"]
    assert summary["A1"].value == "BTC-Backed Loan Model v2 Summary"
    assert summary["B4"].value == pytest.approx(2.0)
    assert summary["B7"].value == pytest.approx(2.6666666667)
    assert summary["B14"].value == pytest.approx(42_000.0)
    assert summary["B15"].value == pytest.approx(8_000.0)
    assert summary["A13"].value == "Income selected draw year 1"
    assert summary["A14"].value == "Income funded year 1"

    inputs = wb["Inputs"]
    input_labels = [inputs.cell(row=row, column=1).value for row in range(4, 22)]
    assert "Selected Annual Income Draw" in input_labels
    assert "Max Available Annual Income (Year 1)" in input_labels
    assert "Annual Income Target" not in input_labels

    accumulation = wb["Accumulation Engine"]
    assert accumulation["A3"].value == "Year"
    assert accumulation["C3"].value == "Starting Collateral BTC"
    assert accumulation["D3"].value == "Starting Debt"
    assert accumulation["E3"].value == "Interest Accrued"
    assert accumulation["F3"].value == "Debt After Interest"
    assert accumulation["G3"].value == "Pre-Action LTV"
    assert accumulation["L3"].value == "Gross BTC Held"
    assert accumulation["M3"].value == "Debt BTC Equivalent"
    assert accumulation["N3"].value == "Net BTC After Debt"
    assert accumulation["O3"].value == "Extra BTC vs Passive"
    assert accumulation["P3"].value == "Net Equity USD"
    assert accumulation["Q3"].value == "Effective LTV End"
    assert accumulation["R3"].value == "Leverage Multiple"
    assert accumulation["S3"].value == "Margin-Call Price"
    assert accumulation["U3"].value == "Drop to Liquidation"
    assert accumulation["V3"].value == "Risk Status"
    assert accumulation["C4"].value == pytest.approx(2.0)
    assert accumulation["J4"].value == pytest.approx(2.6666666667)
    assert accumulation["D5"].value == pytest.approx(40_000.0)
    assert accumulation["F5"].value == pytest.approx(44_000.0)
    assert accumulation["G5"].value == pytest.approx(0.275)
    assert accumulation["L5"].value == pytest.approx(2.6666666667)
    assert accumulation["R5"].value == pytest.approx(1.3333333333)

    income = wb["Income Engine"]
    assert income["D3"].value == "Starting Debt"
    assert income["E3"].value == "Interest Accrued"
    assert income["F3"].value == "Debt After Interest"
    assert income["G3"].value == "Selected Income Draw"
    assert income["H3"].value == "Max Available Annual Income"
    assert income["J3"].value == "Unfunded Income"
    assert income["K3"].value == "Cumulative Income Borrowed"
    assert income["N3"].value == "Net BTC After Debt"
    assert income["O3"].value == "Net Equity USD"
    assert income["Q3"].value == "Margin-Call Price"
    assert income["S3"].value == "Drop to Liquidation"
    assert income["T3"].value == "Sustainability Status"
    assert income["D5"].value == 0
    assert income["G5"].value == pytest.approx(50_000.0)
    assert income["H5"].value == pytest.approx(42_000.0)
    assert income["K5"].value == pytest.approx(42_000.0)

    risk = wb["Risk Alerts"]
    risk_metrics = [risk.cell(row=row, column=1).value for row in range(4, 20)]
    assert "Accumulation min drop-to-liquidation" in risk_metrics
    assert "Accumulation total new borrowing" in risk_metrics
    assert "Accumulation BTC outperformance vs passive" in risk_metrics
    assert "Income min drop-to-liquidation" in risk_metrics
    assert "Income liquidation year" in risk_metrics
    assert "Income total interest accrued" in risk_metrics

    audit = wb["Audit Examples"]
    assert audit["B6"].value == pytest.approx(2.6666666667)
    assert audit["B8"].value == pytest.approx(40_000.0)
    assert audit["B10"].value == pytest.approx(20_000.0)
    assert audit["A13"].value == "Double-loop / 30.6% effective LTV example"
    assert audit["B17"].value == pytest.approx(0.306)
    assert audit["A20"].value == "Income capacity example"
    assert audit["A25"].value == "Selected income draw"
    assert audit["B27"].value == pytest.approx(40_000.0)
    assert audit["B28"].value == pytest.approx(10_000.0)


def test_canonical_build_spreadsheet_script_builds_v2_without_legacy_income_label(tmp_path: Path) -> None:
    output_path = tmp_path / "canonical.xlsx"

    build_canonical_workbook(output_path)

    wb = load_workbook(output_path, data_only=True)
    assert "Income Engine" in wb.sheetnames
    inputs = wb["Inputs"]
    labels = [inputs.cell(row=row, column=1).value for row in range(1, 50)]
    assert "Selected Annual Income Draw" in labels
    assert "Max Available Annual Income (Year 1)" in labels
    assert "Annual Income Target" not in labels
