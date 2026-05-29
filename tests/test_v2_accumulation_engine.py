from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from model_v2.accumulation import accumulation_setup, accumulation_year  # noqa: E402
from model_v2.types import (  # noqa: E402
    AccumulationConfig,
    AccumulationRow,
    BorrowTerms,
    InterestTreatment,
    PricePoint,
    RiskThresholds,
)


def config(
    *,
    target_effective_ltv: float = 0.25,
    max_effective_ltv: float = 0.35,
    interest_treatment: InterestTreatment = InterestTreatment.CAPITALIZED,
) -> AccumulationConfig:
    return AccumulationConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        target_effective_ltv=target_effective_ltv,
        max_effective_ltv=max_effective_ltv,
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
    )


def test_accumulation_setup_uses_closed_form_recursive_leverage() -> None:
    row = accumulation_setup(config())

    assert row.year == 0
    assert row.btc_price == pytest.approx(60_000.0)
    assert row.collateral_btc == pytest.approx(2.6666666667)
    assert row.total_btc == pytest.approx(row.collateral_btc)
    assert row.btc_purchased == pytest.approx(0.6666666667)
    assert row.borrowed_usd == pytest.approx(40_000.0)
    assert row.debt_usd == pytest.approx(40_000.0)
    assert row.effective_ltv == pytest.approx(0.25)
    assert row.net_btc_after_debt == pytest.approx(2.0)
    assert row.liquidation_price == pytest.approx(20_000.0)


def test_accumulation_setup_derives_target_ltv_from_leverage_multiple() -> None:
    cfg = AccumulationConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        target_leverage_multiple=1.25,
        borrow_terms=BorrowTerms(borrow_apr=0.10),
        risk_thresholds=RiskThresholds(margin_call_ltv=0.70, liquidation_ltv=0.75),
    )

    row = accumulation_setup(cfg)

    assert row.collateral_btc == pytest.approx(2.5)
    assert row.effective_ltv == pytest.approx(0.20)
    assert row.debt_usd == pytest.approx(30_000.0)


def test_accumulation_setup_caps_target_ltv_by_max_and_liquidation_buffer() -> None:
    row = accumulation_setup(config(target_effective_ltv=0.50, max_effective_ltv=0.35))

    assert row.effective_ltv == pytest.approx(0.35)
    assert row.debt_usd == pytest.approx(64_615.384615, abs=0.01)
    assert row.collateral_btc == pytest.approx(3.0769230769)


def test_accumulation_year_capitalizes_interest_before_top_up() -> None:
    prior = accumulation_setup(config())
    row = accumulation_year(config(), prior, PricePoint(year=1, btc_price=120_000.0))

    assert row.interest_usd == pytest.approx(4_000.0)
    assert row.borrowed_usd == pytest.approx(48_000.0, abs=0.01)
    assert row.btc_purchased == pytest.approx(0.4)
    assert row.debt_usd == pytest.approx(92_000.0, abs=0.01)
    assert row.collateral_btc == pytest.approx(3.0666666667)
    assert row.effective_ltv == pytest.approx(0.25)


def test_accumulation_year_paid_external_interest_does_not_increase_debt_before_top_up() -> None:
    cfg = config(interest_treatment=InterestTreatment.PAID_EXTERNALLY)
    prior = accumulation_setup(cfg)
    row = accumulation_year(cfg, prior, PricePoint(year=1, btc_price=120_000.0))

    assert row.interest_usd == pytest.approx(4_000.0)
    assert row.borrowed_usd == pytest.approx(53_333.333333, abs=0.01)
    assert row.debt_usd == pytest.approx(93_333.333333, abs=0.01)
    assert row.effective_ltv == pytest.approx(0.25)


def test_accumulation_year_does_not_borrow_when_price_drop_puts_position_above_target() -> None:
    prior = accumulation_setup(config())
    row = accumulation_year(config(), prior, PricePoint(year=1, btc_price=45_000.0))

    assert row.interest_usd == pytest.approx(4_000.0)
    assert row.borrowed_usd == 0.0
    assert row.btc_purchased == 0.0
    assert row.debt_usd == pytest.approx(44_000.0)
    assert row.collateral_btc == pytest.approx(prior.collateral_btc)
    assert row.effective_ltv > 0.25


def test_accumulation_year_zero_target_and_zero_debt_remains_safe() -> None:
    cfg = config(target_effective_ltv=0.0)
    prior = accumulation_setup(cfg)
    row = accumulation_year(cfg, prior, PricePoint(year=1, btc_price=60_000.0))

    assert row.debt_usd == 0.0
    assert row.borrowed_usd == 0.0
    assert row.warning is None


def test_accumulation_rejects_negative_apr() -> None:
    cfg = AccumulationConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        target_effective_ltv=0.25,
        borrow_terms=BorrowTerms(borrow_apr=-0.01),
        risk_thresholds=RiskThresholds(margin_call_ltv=0.70, liquidation_ltv=0.75),
    )

    with pytest.raises(ValueError):
        accumulation_setup(cfg)


def test_accumulation_rejects_misordered_risk_thresholds() -> None:
    cfg = AccumulationConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        target_effective_ltv=0.25,
        borrow_terms=BorrowTerms(borrow_apr=0.10),
        risk_thresholds=RiskThresholds(margin_call_ltv=0.80, liquidation_ltv=0.75),
    )

    with pytest.raises(ValueError):
        accumulation_setup(cfg)


def test_accumulation_rejects_max_effective_ltv_at_or_above_margin_call() -> None:
    cfg = AccumulationConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        target_effective_ltv=0.65,
        max_effective_ltv=0.65,
        borrow_terms=BorrowTerms(borrow_apr=0.0),
        risk_thresholds=RiskThresholds(
            margin_call_ltv=0.60,
            liquidation_ltv=0.90,
            warning_ltv=0.20,
            minimum_liquidation_buffer=0.10,
        ),
    )

    with pytest.raises(ValueError):
        accumulation_setup(cfg)


def test_accumulation_year_marks_liquidated_and_does_not_borrow() -> None:
    prior = AccumulationRow(
        year=0,
        btc_price=60_000.0,
        collateral_btc=2.0,
        total_btc=2.0,
        debt_usd=100_000.0,
        effective_ltv=0.8333333333,
        liquidation_price=66_666.6667,
    )

    row = accumulation_year(config(), prior, PricePoint(year=1, btc_price=60_000.0))

    assert row.borrowed_usd == 0.0
    assert row.btc_purchased == 0.0
    assert row.warning == "LIQUIDATED"
