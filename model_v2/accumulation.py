"""Recursive BTC accumulation engine for the v2 reference model."""

from __future__ import annotations

from model_v2.risk import (
    debt_btc_equivalent,
    effective_ltv,
    liquidation_price,
    margin_call_price,
    net_btc_after_debt,
    price_drop_to_threshold,
)
from model_v2.types import (
    AccumulationConfig,
    AccumulationRow,
    AccumulationStrategy,
    InterestTreatment,
    PricePoint,
)


def _validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive")


def _validate_ltv(value: float, name: str) -> None:
    if value < 0 or value >= 1:
        raise ValueError(f"{name} must be at least 0 and less than 1")


def _validate_config(config: AccumulationConfig) -> None:
    if config.borrow_terms.borrow_apr < 0:
        raise ValueError("borrow_apr must be non-negative")
    _validate_ltv(config.risk_thresholds.warning_ltv, "warning_ltv")
    _validate_ltv(config.risk_thresholds.margin_call_ltv, "margin_call_ltv")
    _validate_ltv(config.risk_thresholds.liquidation_ltv, "liquidation_ltv")
    if config.risk_thresholds.warning_ltv >= config.risk_thresholds.margin_call_ltv:
        raise ValueError("warning_ltv must be less than margin_call_ltv")
    if config.risk_thresholds.margin_call_ltv >= config.risk_thresholds.liquidation_ltv:
        raise ValueError("margin_call_ltv must be less than liquidation_ltv")
    if config.max_effective_ltv >= config.risk_thresholds.margin_call_ltv:
        raise ValueError("max_effective_ltv must be less than margin_call_ltv")


def _target_ltv(config: AccumulationConfig) -> float:
    _validate_config(config)
    if config.strategy != AccumulationStrategy.RECURSIVE_LOOP:
        raise NotImplementedError("v2 currently implements only recursive_loop")

    if config.target_effective_ltv is not None:
        target = config.target_effective_ltv
    elif config.target_leverage_multiple is not None:
        _validate_positive(config.target_leverage_multiple, "target_leverage_multiple")
        if config.target_leverage_multiple < 1:
            raise ValueError("target_leverage_multiple must be at least 1")
        target = 1 - 1 / config.target_leverage_multiple
    else:
        raise ValueError("target_effective_ltv or target_leverage_multiple is required")

    _validate_ltv(target, "target_effective_ltv")
    _validate_ltv(config.max_effective_ltv, "max_effective_ltv")
    _validate_ltv(config.risk_thresholds.liquidation_ltv, "liquidation_ltv")
    _validate_ltv(
        config.risk_thresholds.minimum_liquidation_buffer,
        "minimum_liquidation_buffer",
    )

    buffer_ltv_limit = config.risk_thresholds.liquidation_ltv * (
        1 - config.risk_thresholds.minimum_liquidation_buffer
    )
    borrow_ltv = min(target, config.max_effective_ltv, buffer_ltv_limit)
    _validate_ltv(borrow_ltv, "borrow_ltv")
    return borrow_ltv


def _interest_adjusted_debt(config: AccumulationConfig, debt_start: float) -> tuple[float, float]:
    interest = debt_start * config.borrow_terms.borrow_apr
    if config.borrow_terms.interest_treatment == InterestTreatment.CAPITALIZED:
        return debt_start + interest, interest
    if config.borrow_terms.interest_treatment == InterestTreatment.PAID_EXTERNALLY:
        return debt_start, interest
    raise NotImplementedError(
        f"unsupported interest treatment: {config.borrow_terms.interest_treatment}"
    )


def _build_row(
    config: AccumulationConfig,
    *,
    year: int,
    btc_price: float,
    collateral_btc: float,
    debt_usd: float,
    interest_usd: float = 0.0,
    borrowed_usd: float = 0.0,
    btc_purchased: float = 0.0,
    warning: str | None = None,
) -> AccumulationRow:
    ltv = effective_ltv(debt_usd, collateral_btc, btc_price)
    liq_price = liquidation_price(
        debt_usd, collateral_btc, config.risk_thresholds.liquidation_ltv
    )
    margin_price = margin_call_price(
        debt_usd, collateral_btc, config.risk_thresholds.margin_call_ltv
    )
    return AccumulationRow(
        year=year,
        btc_price=btc_price,
        collateral_btc=collateral_btc,
        total_btc=collateral_btc,
        debt_usd=debt_usd,
        effective_ltv=ltv,
        liquidation_price=liq_price,
        margin_call_price=margin_price,
        debt_btc_equivalent=debt_btc_equivalent(debt_usd, btc_price),
        net_btc_after_debt=net_btc_after_debt(collateral_btc, debt_usd, btc_price),
        interest_usd=interest_usd,
        borrowed_usd=borrowed_usd,
        btc_purchased=btc_purchased,
        warning=warning,
    )


def _risk_warning(config: AccumulationConfig, ltv: float, liq_price: float, btc_price: float) -> str | None:
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


def accumulation_setup(config: AccumulationConfig) -> AccumulationRow:
    """Return the year-0 closed-form recursive accumulation setup row."""

    _validate_positive(config.starting_btc, "starting_btc")
    _validate_positive(config.current_btc_price, "current_btc_price")

    borrow_ltv = _target_ltv(config)
    leverage_multiple = 1 / (1 - borrow_ltv)
    final_collateral_btc = config.starting_btc * leverage_multiple
    borrowed_usd = borrow_ltv * final_collateral_btc * config.current_btc_price
    btc_purchased = final_collateral_btc - config.starting_btc

    row = _build_row(
        config,
        year=0,
        btc_price=config.current_btc_price,
        collateral_btc=final_collateral_btc,
        debt_usd=borrowed_usd,
        borrowed_usd=borrowed_usd,
        btc_purchased=btc_purchased,
    )
    return row


def accumulation_year(
    config: AccumulationConfig,
    prior_row: AccumulationRow,
    price_point: PricePoint,
) -> AccumulationRow:
    """Return one annual recursive top-up row.

    Interest accrues on debt outstanding at the start of the row. New borrowing is
    used immediately to buy BTC and posted as collateral; it starts accruing
    interest on the following row.
    """

    _validate_positive(price_point.btc_price, "btc_price")
    _validate_positive(prior_row.collateral_btc, "prior collateral_btc")

    borrow_ltv = _target_ltv(config)
    debt_after_interest, interest = _interest_adjusted_debt(config, prior_row.debt_usd)
    pre_ltv = effective_ltv(
        debt_after_interest, prior_row.collateral_btc, price_point.btc_price
    )
    pre_liq_price = liquidation_price(
        debt_after_interest,
        prior_row.collateral_btc,
        config.risk_thresholds.liquidation_ltv,
    )
    warning = _risk_warning(config, pre_ltv, pre_liq_price, price_point.btc_price)

    borrowed_usd = 0.0
    btc_purchased = 0.0
    if warning not in {"LIQUIDATED", "MARGIN CALL"} and pre_ltv < borrow_ltv:
        borrowed_usd = max(
            0.0,
            (borrow_ltv * prior_row.collateral_btc * price_point.btc_price - debt_after_interest)
            / (1 - borrow_ltv),
        )
        btc_purchased = borrowed_usd / price_point.btc_price

    collateral_end = prior_row.collateral_btc + btc_purchased
    debt_end = debt_after_interest + borrowed_usd

    row = _build_row(
        config,
        year=price_point.year,
        btc_price=price_point.btc_price,
        collateral_btc=collateral_end,
        debt_usd=debt_end,
        interest_usd=interest,
        borrowed_usd=borrowed_usd,
        btc_purchased=btc_purchased,
    )
    final_warning = _risk_warning(
        config, row.effective_ltv, row.liquidation_price, price_point.btc_price
    )
    if final_warning is not None:
        row = AccumulationRow(**{**row.__dict__, "warning": final_warning})
    return row
