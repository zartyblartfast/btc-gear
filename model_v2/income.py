"""Borrow-funded income engine for the v2 reference model."""

from __future__ import annotations

from model_v2.risk import (
    debt_btc_equivalent,
    effective_ltv,
    liquidation_price,
    margin_call_price,
    net_btc_after_debt,
    price_drop_to_threshold,
)
from model_v2.types import IncomeConfig, IncomeRow, IncomeStrategy, InterestTreatment, PricePoint


def _validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive")


def _validate_non_negative(value: float, name: str) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative")


def _validate_ltv(value: float, name: str) -> None:
    if value < 0 or value >= 1:
        raise ValueError(f"{name} must be at least 0 and less than 1")


def _validate_config(config: IncomeConfig) -> None:
    if config.strategy != IncomeStrategy.BORROW_INCOME:
        raise NotImplementedError("v2 currently implements only borrow_income")
    if config.borrow_terms.borrow_apr < 0:
        raise ValueError("borrow_apr must be non-negative")
    _validate_positive(config.starting_btc, "starting_btc")
    _validate_positive(config.current_btc_price, "current_btc_price")
    _validate_non_negative(config.annual_income_target, "annual_income_target")
    _validate_ltv(config.income_ltv_ceiling, "income_ltv_ceiling")
    _validate_ltv(config.risk_thresholds.margin_call_ltv, "margin_call_ltv")
    _validate_ltv(config.risk_thresholds.liquidation_ltv, "liquidation_ltv")
    _validate_ltv(config.risk_thresholds.warning_ltv, "warning_ltv")
    _validate_ltv(
        config.risk_thresholds.minimum_liquidation_buffer,
        "minimum_liquidation_buffer",
    )
    if config.risk_thresholds.warning_ltv >= config.risk_thresholds.margin_call_ltv:
        raise ValueError("warning_ltv must be less than margin_call_ltv")
    if config.risk_thresholds.margin_call_ltv >= config.risk_thresholds.liquidation_ltv:
        raise ValueError("margin_call_ltv must be less than liquidation_ltv")
    if config.income_ltv_ceiling >= config.risk_thresholds.margin_call_ltv:
        raise ValueError("income_ltv_ceiling must be less than margin_call_ltv")


def _interest_adjusted_debt(config: IncomeConfig, debt_start: float) -> tuple[float, float]:
    interest = debt_start * config.borrow_terms.borrow_apr
    if config.borrow_terms.interest_treatment == InterestTreatment.CAPITALIZED:
        return debt_start + interest, interest
    if config.borrow_terms.interest_treatment == InterestTreatment.PAID_EXTERNALLY:
        return debt_start, interest
    raise NotImplementedError(
        f"unsupported interest treatment: {config.borrow_terms.interest_treatment}"
    )


def _build_row(
    config: IncomeConfig,
    *,
    year: int,
    btc_price: float,
    collateral_btc: float,
    debt_usd: float,
    income_borrowed_usd: float,
    income_shortfall_usd: float,
    interest_usd: float = 0.0,
    warning: str | None = None,
) -> IncomeRow:
    ltv = effective_ltv(debt_usd, collateral_btc, btc_price)
    liq_price = liquidation_price(
        debt_usd, collateral_btc, config.risk_thresholds.liquidation_ltv
    )
    margin_price = margin_call_price(
        debt_usd, collateral_btc, config.risk_thresholds.margin_call_ltv
    )
    return IncomeRow(
        year=year,
        btc_price=btc_price,
        collateral_btc=collateral_btc,
        debt_usd=debt_usd,
        income_borrowed_usd=income_borrowed_usd,
        income_shortfall_usd=income_shortfall_usd,
        effective_ltv=ltv,
        liquidation_price=liq_price,
        margin_call_price=margin_price,
        debt_btc_equivalent=debt_btc_equivalent(debt_usd, btc_price),
        net_btc_after_debt=net_btc_after_debt(collateral_btc, debt_usd, btc_price),
        interest_usd=interest_usd,
        warning=warning,
    )


def _risk_status(config: IncomeConfig, ltv: float, liq_price: float, btc_price: float) -> str | None:
    if ltv == 0:
        return None
    thresholds = config.risk_thresholds
    if ltv >= thresholds.liquidation_ltv:
        return "LIQUIDATED"
    if ltv >= thresholds.margin_call_ltv:
        return "MARGIN CALL"
    drop_to_liq = price_drop_to_threshold(liq_price, btc_price)
    if ltv >= thresholds.warning_ltv or drop_to_liq < thresholds.minimum_liquidation_buffer:
        return "WARNING"
    return None


def _income_status(
    config: IncomeConfig,
    *,
    ltv: float,
    liq_price: float,
    btc_price: float,
    requested_income: float,
    income_borrowed: float,
) -> str:
    risk = _risk_status(config, ltv, liq_price, btc_price)
    if risk is not None:
        return risk
    if requested_income > 0 and income_borrowed == 0:
        return "FAILED"
    if income_borrowed < requested_income:
        return "CONSTRAINED"
    return "SAFE"


def income_setup(config: IncomeConfig) -> IncomeRow:
    """Return the year-0 income row: starting BTC posted, no debt."""

    _validate_config(config)
    return _build_row(
        config,
        year=0,
        btc_price=config.current_btc_price,
        collateral_btc=config.starting_btc,
        debt_usd=0.0,
        income_borrowed_usd=0.0,
        income_shortfall_usd=0.0,
        warning="SAFE",
    )


def income_year(
    config: IncomeConfig,
    prior_row: IncomeRow,
    price_point: PricePoint,
    requested_income: float | None = None,
) -> IncomeRow:
    """Return one annual borrow-funded income row.

    Interest accrues on start-of-row debt only. Annual income borrowing happens
    after interest and begins accruing interest on the following row.
    """

    _validate_config(config)
    _validate_positive(price_point.btc_price, "btc_price")
    _validate_positive(prior_row.collateral_btc, "prior collateral_btc")

    requested = config.annual_income_target if requested_income is None else requested_income
    _validate_non_negative(requested, "requested_income")

    debt_after_interest, interest = _interest_adjusted_debt(config, prior_row.debt_usd)
    collateral_value = prior_row.collateral_btc * price_point.btc_price
    ltv_limit_debt = collateral_value * config.income_ltv_ceiling
    buffer_limit_debt = (
        collateral_value
        * config.risk_thresholds.liquidation_ltv
        * (1 - config.risk_thresholds.minimum_liquidation_buffer)
    )
    max_safe_debt = min(ltv_limit_debt, buffer_limit_debt)
    available_capacity = max(0.0, max_safe_debt - debt_after_interest)

    pre_ltv = effective_ltv(debt_after_interest, prior_row.collateral_btc, price_point.btc_price)
    pre_liq_price = liquidation_price(
        debt_after_interest,
        prior_row.collateral_btc,
        config.risk_thresholds.liquidation_ltv,
    )
    pre_risk = _risk_status(config, pre_ltv, pre_liq_price, price_point.btc_price)

    income_borrowed = 0.0
    if pre_risk not in {"LIQUIDATED", "MARGIN CALL"}:
        income_borrowed = min(requested, available_capacity)

    shortfall = requested - income_borrowed
    debt_end = debt_after_interest + income_borrowed

    end_ltv = effective_ltv(debt_end, prior_row.collateral_btc, price_point.btc_price)
    end_liq_price = liquidation_price(
        debt_end,
        prior_row.collateral_btc,
        config.risk_thresholds.liquidation_ltv,
    )
    status = _income_status(
        config,
        ltv=end_ltv,
        liq_price=end_liq_price,
        btc_price=price_point.btc_price,
        requested_income=requested,
        income_borrowed=income_borrowed,
    )

    return _build_row(
        config,
        year=price_point.year,
        btc_price=price_point.btc_price,
        collateral_btc=prior_row.collateral_btc,
        debt_usd=debt_end,
        income_borrowed_usd=income_borrowed,
        income_shortfall_usd=shortfall,
        interest_usd=interest,
        warning=status,
    )
