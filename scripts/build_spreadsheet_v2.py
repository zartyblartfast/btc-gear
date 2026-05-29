#!/usr/bin/env python3
"""Build the clean-sheet BTC-backed loan model v2 workbook."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from model_v2.income import income_year
from model_v2.risk import effective_ltv, price_drop_to_threshold
from model_v2.scenarios import V2ProjectionResult, default_v2_inputs, run_v2_projection
from model_v2.types import BorrowTerms, IncomeConfig, IncomeRow, PricePoint, RiskThresholds

HEADER_FILL = PatternFill(start_color="023D4B", end_color="023D4B", fill_type="solid")
SECTION_FILL = PatternFill(start_color="D1ECF1", end_color="D1ECF1", fill_type="solid")
INPUT_FILL = PatternFill(start_color="F6F6F6", end_color="F6F6F6", fill_type="solid")
THIN = Border(
    left=Side(style="thin", color="DDDDDD"),
    right=Side(style="thin", color="DDDDDD"),
    top=Side(style="thin", color="DDDDDD"),
    bottom=Side(style="thin", color="DDDDDD"),
)
TITLE_FONT = Font(name="Calibri", size=18, bold=True, color="023D4B")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
SECTION_FONT = Font(name="Calibri", size=12, bold=True, color="023D4B")
LABEL_FONT = Font(name="Calibri", size=11, color="333333")
VALUE_FONT = Font(name="Calibri", size=11, bold=True)

USD_FMT = '$#,##0.00'
BTC_FMT = '0.00000000'
PCT_FMT = '0.00%'


def _cell(ws, row: int, col: int, value=None, *, fmt: str | None = None, font=None, fill=None, align="center"):
    cell = ws.cell(row=row, column=col, value=value)
    cell.border = THIN
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
    if fmt:
        cell.number_format = fmt
    if font:
        cell.font = font
    if fill:
        cell.fill = fill
    return cell


def _title(ws, text: str) -> None:
    ws.merge_cells("A1:H1")
    _cell(ws, 1, 1, text, font=TITLE_FONT, align="left")


def _headers(ws, row: int, headers: list[str]) -> None:
    for idx, header in enumerate(headers, start=1):
        _cell(ws, row, idx, header, font=HEADER_FONT, fill=HEADER_FILL)


def _autosize(ws) -> None:
    for column_cells in ws.columns:
        letter = get_column_letter(column_cells[0].column)
        max_len = max(len(str(cell.value)) if cell.value is not None else 0 for cell in column_cells)
        ws.column_dimensions[letter].width = min(max(max_len + 2, 12), 28)


def _write_inputs(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.active
    ws.title = "Inputs"
    _title(ws, "BTC-Backed Loan Model v2 Inputs")
    acc = projection.accumulation_rows[0]
    inc = projection.income_rows[0]
    cfg = default_v2_inputs().accumulation_config
    income_cfg = default_v2_inputs().income_config
    year1_income_capacity = (
        income_cfg.starting_btc
        * income_cfg.current_btc_price
        * min(
            income_cfg.income_ltv_ceiling,
            income_cfg.risk_thresholds.liquidation_ltv
            * (1 - income_cfg.risk_thresholds.minimum_liquidation_buffer),
        )
    )

    rows = [
        ("Shared", None, None, None),
        ("Current BTC Price", cfg.current_btc_price, "USD", "Year 0 price; feeds Price Projection"),
        ("Annual BTC Price Growth", 0.0, "%", "Editable flat/default projection growth rate"),
        ("Starting BTC", cfg.starting_btc, "BTC", "Collateral used by both engines"),
        ("Borrow APR", cfg.borrow_terms.borrow_apr, "%", "Interest accrues on start-of-row debt"),
        ("Interest Treatment", str(cfg.borrow_terms.interest_treatment), "choice", "capitalized or paid externally"),
        ("Margin Call LTV", cfg.risk_thresholds.margin_call_ltv, "%", "Risk threshold"),
        ("Liquidation LTV", cfg.risk_thresholds.liquidation_ltv, "%", "Risk threshold"),
        ("Minimum Liquidation Buffer", cfg.risk_thresholds.minimum_liquidation_buffer, "%", "Required price-drop buffer"),
        ("Accumulation", None, None, None),
        ("Target Effective LTV", cfg.target_effective_ltv, "%", "Recursive setup/top-up target"),
        ("Max Effective LTV", cfg.max_effective_ltv, "%", "Hard cap"),
        ("Setup Collateral BTC", acc.collateral_btc, "BTC", "Computed audit output"),
        ("Income", None, None, None),
        ("Max Available Annual Income (Year 1)", year1_income_capacity, "USD", "Calculated from BTC collateral, LTV ceiling, and liquidation buffer"),
        ("Selected Annual Income Draw", income_cfg.selected_annual_income_draw, "USD", "User-selected draw; capped by max available annual income"),
        ("Income LTV Ceiling", income_cfg.income_ltv_ceiling, "%", "Safe debt ceiling"),
        ("Setup Collateral BTC", inc.collateral_btc, "BTC", "Income keeps BTC constant"),
    ]
    _headers(ws, 3, ["Input", "Value", "Unit", "Notes"])
    for idx, row in enumerate(rows, start=4):
        name, value, unit, notes = row
        if value is None and unit is None:
            ws.merge_cells(start_row=idx, start_column=1, end_row=idx, end_column=4)
            _cell(ws, idx, 1, name, font=SECTION_FONT, fill=SECTION_FILL, align="left")
            continue
        fmt = PCT_FMT if unit == "%" else USD_FMT if unit == "USD" else BTC_FMT if unit == "BTC" else None
        _cell(ws, idx, 1, name, font=LABEL_FONT, fill=INPUT_FILL, align="left")
        _cell(ws, idx, 2, value, fmt=fmt, font=VALUE_FONT)
        _cell(ws, idx, 3, unit)
        _cell(ws, idx, 4, notes, align="left")
    _autosize(ws)


def _write_price_projection(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.create_sheet("Price Projection")
    _title(ws, "Price Projection")
    _headers(ws, 3, ["Year", "BTC Price", "Scenario", "YoY Change"])
    for row_idx, point in enumerate(projection.price_points, start=4):
        _cell(ws, row_idx, 1, point.year)
        price_formula = "='Inputs'!$B$5" if point.year == 0 else f"=B{row_idx - 1}*(1+'Inputs'!$B$6)"
        yoy_formula = 0 if point.year == 0 else f"=B{row_idx}/B{row_idx - 1}-1"
        _cell(ws, row_idx, 2, price_formula, fmt=USD_FMT)
        _cell(ws, row_idx, 3, "Editable formula projection")
        _cell(ws, row_idx, 4, yoy_formula, fmt=PCT_FMT)
    _autosize(ws)


def _write_accumulation(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.create_sheet("Accumulation Engine")
    _title(ws, "Accumulation Engine — Recursive BTC Leverage")
    headers = [
        "Year", "BTC Price", "Starting Collateral BTC", "Starting Debt",
        "Interest Accrued", "Debt After Interest", "Pre-Action LTV", "New Borrowing",
        "BTC Bought", "Ending Collateral BTC", "Ending Debt", "Gross BTC Held",
        "Debt BTC Equivalent", "Net BTC After Debt", "Extra BTC vs Passive",
        "Net Equity USD", "Effective LTV End", "Leverage Multiple",
        "Margin-Call Price", "Liquidation Price", "Drop to Liquidation",
        "Risk Status",
    ]
    _headers(ws, 3, headers)
    passive_btc = projection.accumulation_rows[0].net_btc_after_debt
    prior = None
    for row_idx, row in enumerate(projection.accumulation_rows, start=4):
        starting_collateral = passive_btc if prior is None else prior.collateral_btc
        starting_debt = 0.0 if prior is None else prior.debt_usd
        debt_after_interest = starting_debt + row.interest_usd
        pre_action_ltv = effective_ltv(debt_after_interest, starting_collateral, row.btc_price)
        net_equity_usd = row.total_btc * row.btc_price - row.debt_usd
        drop_to_liquidation = price_drop_to_threshold(row.liquidation_price, row.btc_price)
        leverage_multiple = row.total_btc / passive_btc
        values = [
            row.year, f"='Price Projection'!B{row_idx}", starting_collateral, starting_debt,
            row.interest_usd, debt_after_interest, pre_action_ltv, row.borrowed_usd,
            row.btc_purchased, row.collateral_btc, row.debt_usd, row.total_btc,
            row.debt_btc_equivalent, row.net_btc_after_debt,
            row.total_btc - passive_btc, net_equity_usd, row.effective_ltv,
            leverage_multiple, row.margin_call_price, row.liquidation_price,
            drop_to_liquidation, row.warning or "SAFE",
        ]
        formats = [
            None, USD_FMT, BTC_FMT, USD_FMT,
            USD_FMT, USD_FMT, PCT_FMT, USD_FMT,
            BTC_FMT, BTC_FMT, USD_FMT, BTC_FMT,
            BTC_FMT, BTC_FMT, BTC_FMT, USD_FMT,
            PCT_FMT, None, USD_FMT, USD_FMT,
            PCT_FMT, None,
        ]
        for col, (value, fmt) in enumerate(zip(values, formats, strict=True), start=1):
            _cell(ws, row_idx, col, value, fmt=fmt)
        prior = row
    _autosize(ws)


def _write_income(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.create_sheet("Income Engine")
    _title(ws, "Income Engine — Borrow-Funded Income")
    headers = [
        "Year", "BTC Price", "Starting Collateral BTC", "Starting Debt",
        "Interest Accrued", "Debt After Interest", "Selected Income Draw",
        "Max Available Annual Income", "Income Borrowed", "Unfunded Income",
        "Cumulative Income Borrowed", "Ending Debt", "Debt BTC Equivalent",
        "Net BTC After Debt", "Net Equity USD", "Effective LTV End",
        "Margin-Call Price", "Liquidation Price", "Drop to Liquidation",
        "Sustainability Status",
    ]
    _headers(ws, 3, headers)
    prior = None
    cumulative_income = 0.0
    selected_income_draw = default_v2_inputs().income_config.selected_annual_income_draw
    income_ltv_ceiling = default_v2_inputs().income_config.income_ltv_ceiling
    thresholds = default_v2_inputs().income_config.risk_thresholds
    for row_idx, row in enumerate(projection.income_rows, start=4):
        starting_debt = 0.0 if prior is None else prior.debt_usd
        debt_after_interest = starting_debt + row.interest_usd
        selected_draw = 0.0 if row.year == 0 else selected_income_draw
        ltv_limit_debt = row.collateral_btc * row.btc_price * income_ltv_ceiling
        buffer_limit_debt = (
            row.collateral_btc
            * row.btc_price
            * thresholds.liquidation_ltv
            * (1 - thresholds.minimum_liquidation_buffer)
        )
        max_safe_debt = min(ltv_limit_debt, buffer_limit_debt)
        available_capacity = max(0.0, max_safe_debt - debt_after_interest)
        cumulative_income += row.income_borrowed_usd
        net_equity_usd = row.collateral_btc * row.btc_price - row.debt_usd
        drop_to_liquidation = price_drop_to_threshold(row.liquidation_price, row.btc_price)
        values = [
            row.year, f"='Price Projection'!B{row_idx}", row.collateral_btc, starting_debt,
            row.interest_usd, debt_after_interest, selected_draw, available_capacity,
            row.income_borrowed_usd, row.income_shortfall_usd, cumulative_income,
            row.debt_usd, row.debt_btc_equivalent, row.net_btc_after_debt,
            net_equity_usd, row.effective_ltv, row.margin_call_price,
            row.liquidation_price, drop_to_liquidation, row.warning,
        ]
        formats = [
            None, USD_FMT, BTC_FMT, USD_FMT,
            USD_FMT, USD_FMT, USD_FMT, USD_FMT,
            USD_FMT, USD_FMT, USD_FMT,
            USD_FMT, BTC_FMT, BTC_FMT,
            USD_FMT, PCT_FMT, USD_FMT,
            USD_FMT, PCT_FMT, None,
        ]
        for col, (value, fmt) in enumerate(zip(values, formats, strict=True), start=1):
            _cell(ws, row_idx, col, value, fmt=fmt)
        prior = row
    _autosize(ws)


def _write_risk_alerts(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.create_sheet("Risk Alerts")
    _title(ws, "Risk Alerts")
    acc_rows = projection.accumulation_rows
    inc_rows = projection.income_rows
    passive_btc = acc_rows[0].net_btc_after_debt
    acc_drop_values = [
        price_drop_to_threshold(row.liquidation_price, row.btc_price) for row in acc_rows
    ]
    inc_drop_values = [
        price_drop_to_threshold(row.liquidation_price, row.btc_price) for row in inc_rows
    ]
    metrics = [
        ("Accumulation risk path", None, None),
        ("Accumulation max effective LTV", max(row.effective_ltv for row in acc_rows), PCT_FMT),
        ("Accumulation min drop-to-liquidation", min(acc_drop_values), PCT_FMT),
        ("Accumulation first non-safe year", next((row.year for row in acc_rows if row.warning), "None"), None),
        ("Accumulation liquidation year", next((row.year for row in acc_rows if row.warning == "LIQUIDATED"), "None"), None),
        ("Accumulation total interest accrued", sum(row.interest_usd for row in acc_rows), USD_FMT),
        ("Accumulation total new borrowing", sum(row.borrowed_usd for row in acc_rows), USD_FMT),
        ("Accumulation ending net BTC", acc_rows[-1].net_btc_after_debt, BTC_FMT),
        ("Accumulation BTC outperformance vs passive", acc_rows[-1].net_btc_after_debt - passive_btc, BTC_FMT),
        ("Income risk path", None, None),
        ("Income max effective LTV", max(row.effective_ltv for row in inc_rows), PCT_FMT),
        ("Income min drop-to-liquidation", min(inc_drop_values), PCT_FMT),
        ("Income first constrained year", next((row.year for row in inc_rows if row.warning == "CONSTRAINED"), "None"), None),
        ("Income liquidation year", next((row.year for row in inc_rows if row.warning == "LIQUIDATED"), "None"), None),
        ("Income total interest accrued", sum(row.interest_usd for row in inc_rows), USD_FMT),
        ("Income total funded", sum(row.income_borrowed_usd for row in inc_rows), USD_FMT),
        ("Income total shortfall", sum(row.income_shortfall_usd for row in inc_rows), USD_FMT),
        ("Passive hold comparison", None, None),
        ("Passive BTC held", passive_btc, BTC_FMT),
        ("Passive ending value", passive_btc * projection.price_points[-1].btc_price, USD_FMT),
    ]
    _headers(ws, 3, ["Metric", "Value"])
    for idx, (name, value, fmt) in enumerate(metrics, start=4):
        if value is None:
            ws.merge_cells(start_row=idx, start_column=1, end_row=idx, end_column=2)
            _cell(ws, idx, 1, name, font=SECTION_FONT, fill=SECTION_FILL, align="left")
            continue
        _cell(ws, idx, 1, name, align="left")
        _cell(ws, idx, 2, value, fmt=fmt)
    _autosize(ws)


def _write_summary(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.create_sheet("Summary")
    _title(ws, "BTC-Backed Loan Model v2 Summary")
    acc0 = projection.accumulation_rows[0]
    acc_end = projection.accumulation_rows[-1]
    inc_rows = projection.income_rows
    inc_end = inc_rows[-1]
    summary = [
        ("Passive starting BTC", 2.0, BTC_FMT),
        ("Passive ending BTC", 2.0, BTC_FMT),
        ("Passive ending value", 2.0 * projection.price_points[-1].btc_price, USD_FMT),
        ("Accumulation setup gross BTC", acc0.collateral_btc, BTC_FMT),
        ("Accumulation ending gross BTC", acc_end.collateral_btc, BTC_FMT),
        ("Accumulation ending debt", acc_end.debt_usd, USD_FMT),
        ("Accumulation ending net BTC", acc_end.net_btc_after_debt, BTC_FMT),
        ("Accumulation ending LTV", acc_end.effective_ltv, PCT_FMT),
        ("Accumulation status", acc_end.warning or "SAFE", None),
        ("Income selected draw year 1", 50_000.0, USD_FMT),
        ("Income funded year 1", inc_rows[1].income_borrowed_usd, USD_FMT),
        ("Income shortfall year 1", inc_rows[1].income_shortfall_usd, USD_FMT),
        ("Income ending debt", inc_end.debt_usd, USD_FMT),
        ("Income ending net BTC", inc_end.net_btc_after_debt, BTC_FMT),
        ("Income status", inc_end.warning, None),
    ]
    _headers(ws, 3, ["Metric", "Value"])
    for idx, (name, value, fmt) in enumerate(summary, start=4):
        _cell(ws, idx, 1, name, align="left")
        _cell(ws, idx, 2, value, fmt=fmt)
    _autosize(ws)


def _write_audit_examples(wb: Workbook, projection: V2ProjectionResult) -> None:
    ws = wb.create_sheet("Audit Examples")
    _title(ws, "Audit Examples")
    acc = projection.accumulation_rows[0]

    risk = RiskThresholds(
        margin_call_ltv=0.70,
        liquidation_ltv=0.75,
        warning_ltv=0.60,
        minimum_liquidation_buffer=0.50,
    )
    income_capacity_cfg = IncomeConfig(
        starting_btc=2.0,
        current_btc_price=100_000.0,
        selected_annual_income_draw=50_000.0,
        income_ltv_ceiling=0.35,
        borrow_terms=BorrowTerms(borrow_apr=0.0),
        risk_thresholds=risk,
    )
    income_capacity_prior = IncomeRow(
        year=0,
        btc_price=100_000.0,
        collateral_btc=2.0,
        debt_usd=30_000.0,
        income_borrowed_usd=0.0,
        income_shortfall_usd=0.0,
        effective_ltv=0.15,
        liquidation_price=20_000.0,
    )
    income_capacity = income_year(
        income_capacity_cfg,
        income_capacity_prior,
        PricePoint(year=1, btc_price=100_000.0),
    )

    _headers(ws, 3, ["Audit Check", "Expected / Model Value"])
    rows = [
        (4, "Starting BTC", 2.0, BTC_FMT),
        (5, "Target effective LTV", 0.25, PCT_FMT),
        (6, "Final collateral BTC", acc.collateral_btc, BTC_FMT),
        (7, "BTC purchased", acc.btc_purchased, BTC_FMT),
        (8, "Debt", acc.debt_usd, USD_FMT),
        (9, "Effective LTV", acc.effective_ltv, PCT_FMT),
        (10, "Liquidation price", acc.liquidation_price, USD_FMT),
        (13, "Double-loop / 30.6% effective LTV example", None, None),
        (14, "Starting BTC", 2.0, BTC_FMT),
        (15, "BTC price", 60_000.0, USD_FMT),
        (16, "Gross BTC ≈", 2.883, BTC_FMT),
        (17, "Effective LTV ≈", 0.306, PCT_FMT),
        (18, "Debt ≈", 53_000.0, USD_FMT),
        (20, "Income capacity example", None, None),
        (21, "Collateral BTC", 2.0, BTC_FMT),
        (22, "BTC price", 100_000.0, USD_FMT),
        (23, "Existing debt", 30_000.0, USD_FMT),
        (24, "Income LTV ceiling", 0.35, PCT_FMT),
        (25, "Selected income draw", 50_000.0, USD_FMT),
        (26, "Max safe debt", 70_000.0, USD_FMT),
        (27, "Income borrowed", income_capacity.income_borrowed_usd, USD_FMT),
        (28, "Unfunded income", income_capacity.income_shortfall_usd, USD_FMT),
        (29, "Debt end", income_capacity.debt_usd, USD_FMT),
    ]
    for idx, name, value, fmt in rows:
        if value is None:
            ws.merge_cells(start_row=idx, start_column=1, end_row=idx, end_column=2)
            _cell(ws, idx, 1, name, font=SECTION_FONT, fill=SECTION_FILL, align="left")
            continue
        _cell(ws, idx, 1, name, align="left")
        _cell(ws, idx, 2, value, fmt=fmt)
    _autosize(ws)


def build_workbook_v2(output_path: str | Path = "btc_leveraged_model_v2.xlsx") -> Path:
    """Build and save the v2 workbook. Returns the saved path."""

    output_path = Path(output_path)
    projection = run_v2_projection(default_v2_inputs(projection_years=10))
    wb = Workbook()
    _write_inputs(wb, projection)
    _write_price_projection(wb, projection)
    _write_accumulation(wb, projection)
    _write_income(wb, projection)
    _write_risk_alerts(wb, projection)
    _write_summary(wb, projection)
    _write_audit_examples(wb, projection)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)
    return output_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the v2 BTC-backed loan model workbook.")
    parser.add_argument(
        "--output",
        "-o",
        default="btc_leveraged_model_v2.xlsx",
        help="Output .xlsx path (default: btc_leveraged_model_v2.xlsx)",
    )
    args = parser.parse_args(argv)

    path = build_workbook_v2(args.output)
    print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
