"""Scenario runners for the v2 reference model."""

from __future__ import annotations

from dataclasses import dataclass

from model_v2.accumulation import accumulation_setup, accumulation_year
from model_v2.income import income_setup, income_year
from model_v2.types import (
    AccumulationConfig,
    AccumulationRow,
    BorrowTerms,
    IncomeConfig,
    IncomeRow,
    InterestTreatment,
    PricePoint,
    RiskThresholds,
)


@dataclass(frozen=True)
class V2ProjectionInputs:
    """Inputs needed to run both v2 strategy engines."""

    accumulation_config: AccumulationConfig
    income_config: IncomeConfig
    price_points: tuple[PricePoint, ...]


@dataclass(frozen=True)
class V2ProjectionResult:
    """Rows produced by both v2 strategy engines for the same price path."""

    price_points: tuple[PricePoint, ...]
    accumulation_rows: tuple[AccumulationRow, ...]
    income_rows: tuple[IncomeRow, ...]


def flat_price_points(*, btc_price: float, projection_years: int) -> tuple[PricePoint, ...]:
    """Return year 0..N price points using a flat BTC price path."""

    if btc_price <= 0:
        raise ValueError("btc_price must be positive")
    if projection_years < 0:
        raise ValueError("projection_years must be non-negative")
    return tuple(
        PricePoint(year=year, btc_price=btc_price, scenario="flat", yoy_change=0.0)
        for year in range(projection_years + 1)
    )


def default_v2_inputs(*, projection_years: int = 10) -> V2ProjectionInputs:
    """Return conservative audit-friendly defaults for the v2 workbook.

    The defaults intentionally preserve the documented recursive setup audit:
    2 BTC at $60k with 25% effective LTV produces 2.66666667 BTC collateral
    and $40,000 debt.
    """

    terms = BorrowTerms(
        borrow_apr=0.10,
        interest_treatment=InterestTreatment.CAPITALIZED,
    )
    risk = RiskThresholds(
        margin_call_ltv=0.70,
        liquidation_ltv=0.75,
        warning_ltv=0.60,
        minimum_liquidation_buffer=0.50,
    )
    accumulation_config = AccumulationConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        target_effective_ltv=0.25,
        max_effective_ltv=0.35,
        borrow_terms=terms,
        risk_thresholds=risk,
    )
    income_config = IncomeConfig(
        starting_btc=2.0,
        current_btc_price=60_000.0,
        annual_income_target=50_000.0,
        income_ltv_ceiling=0.35,
        borrow_terms=terms,
        risk_thresholds=risk,
    )
    return V2ProjectionInputs(
        accumulation_config=accumulation_config,
        income_config=income_config,
        price_points=flat_price_points(btc_price=60_000.0, projection_years=projection_years),
    )


def run_v2_projection(inputs: V2ProjectionInputs) -> V2ProjectionResult:
    """Run Accumulation and Income engines over the provided year 0..N prices."""

    if not inputs.price_points:
        raise ValueError("price_points must include at least year 0")
    if inputs.price_points[0].year != 0:
        raise ValueError("first price point must be year 0")

    accumulation_rows: list[AccumulationRow] = [
        accumulation_setup(inputs.accumulation_config)
    ]
    income_rows: list[IncomeRow] = [income_setup(inputs.income_config)]

    for price_point in inputs.price_points[1:]:
        accumulation_rows.append(
            accumulation_year(
                inputs.accumulation_config,
                accumulation_rows[-1],
                price_point,
            )
        )
        income_rows.append(
            income_year(inputs.income_config, income_rows[-1], price_point)
        )

    return V2ProjectionResult(
        price_points=inputs.price_points,
        accumulation_rows=tuple(accumulation_rows),
        income_rows=tuple(income_rows),
    )
