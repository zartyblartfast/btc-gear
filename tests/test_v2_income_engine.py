from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from model_v2.income import income_setup, income_year  # noqa: E402
from model_v2.types import (  # noqa: E402
    BorrowTerms,
    IncomeConfig,
    IncomeRow,
    InterestTreatment,
    PricePoint,
    RiskThresholds,
)


def config(
    *,
    selected_annual_income_draw: float = 50_000.0,
    income_ltv_ceiling: float = 0.35,
    interest_treatment: InterestTreatment = InterestTreatment.CAPITALIZED,
) -> IncomeConfig:
    return IncomeConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        selected_annual_income_draw=selected_annual_income_draw,
        borrow_terms=BorrowTerms(
            borrow_apr=0.10,
            interest_treatment=interest_treatment,
        ),
        risk_thresholds=RiskThresholds(
            margin_call_ltv=0.70,
            liquidation_ltv=0.75,
            warning_ltv=0.60,
            minimum_liquidation_buffer=0.50,
        ),
        income_ltv_ceiling=income_ltv_ceiling,
    )


def test_income_setup_starts_with_btc_collateral_and_no_debt() -> None:
    row = income_setup(config())

    assert row.year == 0
    assert row.btc_price == pytest.approx(60_000.0)
    assert row.collateral_btc == pytest.approx(2.0)
    assert row.debt_usd == 0.0
    assert row.income_borrowed_usd == 0.0
    assert row.income_shortfall_usd == 0.0
    assert row.effective_ltv == 0.0
    assert row.net_btc_after_debt == pytest.approx(2.0)
    assert row.warning == "SAFE"


def test_income_year_funds_selected_draw_up_to_safe_capacity() -> None:
    prior = income_setup(config(selected_annual_income_draw=40_000.0))
    row = income_year(config(selected_annual_income_draw=40_000.0), prior, PricePoint(year=1, btc_price=60_000.0))

    assert row.interest_usd == 0.0
    assert row.income_borrowed_usd == pytest.approx(40_000.0)
    assert row.income_shortfall_usd == 0.0
    assert row.debt_usd == pytest.approx(40_000.0)
    assert row.effective_ltv == pytest.approx(1 / 3)
    assert row.warning == "SAFE"


def test_income_year_partially_funds_income_when_capacity_is_limited() -> None:
    prior = income_setup(config(selected_annual_income_draw=50_000.0))
    row = income_year(config(selected_annual_income_draw=50_000.0), prior, PricePoint(year=1, btc_price=60_000.0))

    # Capacity is min(2 * 60000 * 0.35, 2 * 60000 * 0.75 * 0.50) = 42000.
    assert row.income_borrowed_usd == pytest.approx(42_000.0)
    assert row.income_shortfall_usd == pytest.approx(8_000.0)
    assert row.debt_usd == pytest.approx(42_000.0)
    assert row.effective_ltv == pytest.approx(0.35)
    assert row.warning == "CONSTRAINED"


def test_income_year_uses_liquidation_buffer_when_it_is_stricter_than_ltv_ceiling() -> None:
    cfg = config(selected_annual_income_draw=50_000.0, income_ltv_ceiling=0.50)
    prior = income_setup(cfg)
    row = income_year(cfg, prior, PricePoint(year=1, btc_price=60_000.0))

    assert row.income_borrowed_usd == pytest.approx(45_000.0)
    assert row.income_shortfall_usd == pytest.approx(5_000.0)
    assert row.effective_ltv == pytest.approx(0.375)


def test_income_year_capitalizes_interest_before_computing_capacity() -> None:
    prior = IncomeRow(
        year=1,
        btc_price=60_000.0,
        collateral_btc=2.0,
        debt_usd=40_000.0,
        income_borrowed_usd=40_000.0,
        income_shortfall_usd=0.0,
        effective_ltv=1 / 3,
        liquidation_price=26_666.6667,
    )
    row = income_year(config(selected_annual_income_draw=10_000.0), prior, PricePoint(year=2, btc_price=60_000.0))

    assert row.interest_usd == pytest.approx(4_000.0)
    assert row.income_borrowed_usd == 0.0
    assert row.income_shortfall_usd == pytest.approx(10_000.0)
    assert row.debt_usd == pytest.approx(44_000.0)
    assert row.warning == "FAILED"


def test_income_year_paid_external_interest_does_not_reduce_capacity() -> None:
    cfg = config(selected_annual_income_draw=2_000.0, interest_treatment=InterestTreatment.PAID_EXTERNALLY)
    prior = IncomeRow(
        year=1,
        btc_price=60_000.0,
        collateral_btc=2.0,
        debt_usd=40_000.0,
        income_borrowed_usd=40_000.0,
        income_shortfall_usd=0.0,
        effective_ltv=1 / 3,
        liquidation_price=26_666.6667,
    )
    row = income_year(cfg, prior, PricePoint(year=2, btc_price=60_000.0))

    assert row.interest_usd == pytest.approx(4_000.0)
    assert row.income_borrowed_usd == pytest.approx(2_000.0)
    assert row.income_shortfall_usd == 0.0
    assert row.debt_usd == pytest.approx(42_000.0)


def test_income_status_precedence_reports_warning_before_constrained() -> None:
    prior = IncomeRow(
        year=1,
        btc_price=60_000.0,
        collateral_btc=2.0,
        debt_usd=80_000.0,
        income_borrowed_usd=0.0,
        income_shortfall_usd=0.0,
        effective_ltv=0.5833333333,
        liquidation_price=46_666.6667,
    )

    row = income_year(config(selected_annual_income_draw=10_000.0), prior, PricePoint(year=2, btc_price=60_000.0))

    assert row.income_borrowed_usd == 0.0
    assert row.income_shortfall_usd == pytest.approx(10_000.0)
    assert row.warning == "MARGIN CALL"


def test_income_year_zero_debt_and_zero_income_remains_safe() -> None:
    cfg = config(selected_annual_income_draw=0.0)
    prior = income_setup(cfg)
    row = income_year(cfg, prior, PricePoint(year=1, btc_price=60_000.0))

    assert row.debt_usd == 0.0
    assert row.income_borrowed_usd == 0.0
    assert row.income_shortfall_usd == 0.0
    assert row.warning == "SAFE"


def test_income_rejects_negative_apr() -> None:
    cfg = IncomeConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        selected_annual_income_draw=10_000.0,
        borrow_terms=BorrowTerms(borrow_apr=-0.01),
        risk_thresholds=RiskThresholds(margin_call_ltv=0.70, liquidation_ltv=0.75),
    )

    with pytest.raises(ValueError):
        income_setup(cfg)


def test_income_rejects_misordered_risk_thresholds() -> None:
    cfg = IncomeConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        selected_annual_income_draw=10_000.0,
        borrow_terms=BorrowTerms(borrow_apr=0.10),
        risk_thresholds=RiskThresholds(margin_call_ltv=0.80, liquidation_ltv=0.75),
    )

    with pytest.raises(ValueError):
        income_setup(cfg)


def test_income_year_marks_liquidated_before_income_failure() -> None:
    prior = IncomeRow(
        year=1,
        btc_price=60_000.0,
        collateral_btc=2.0,
        debt_usd=100_000.0,
        income_borrowed_usd=0.0,
        income_shortfall_usd=0.0,
        effective_ltv=0.8333333333,
        liquidation_price=66_666.6667,
    )

    row = income_year(config(selected_annual_income_draw=10_000.0), prior, PricePoint(year=2, btc_price=60_000.0))

    assert row.income_borrowed_usd == 0.0
    assert row.income_shortfall_usd == pytest.approx(10_000.0)
    assert row.warning == "LIQUIDATED"
