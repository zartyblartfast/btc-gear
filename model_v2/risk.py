"""Shared v2 risk formulas.

All formulas are pure functions operating on USD-denominated debt and BTC
collateral/holdings. LTV values are decimal fractions, e.g. 0.75 for 75%.
"""

from __future__ import annotations


def _validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive")


def _validate_threshold(value: float, name: str) -> None:
    _validate_positive(value, name)
    if value >= 1:
        raise ValueError(f"{name} must be less than 1")


def effective_ltv(debt_usd: float, collateral_btc: float, btc_price: float) -> float:
    """Return debt divided by posted collateral value.

    A zero debt balance has zero LTV. Collateral and BTC price must be positive
    because they define the denominator.
    """

    _validate_positive(collateral_btc, "collateral_btc")
    _validate_positive(btc_price, "btc_price")
    if debt_usd == 0:
        return 0.0
    return debt_usd / (collateral_btc * btc_price)


def debt_btc_equivalent(debt_usd: float, btc_price: float) -> float:
    """Return USD debt expressed in BTC at the given BTC price."""

    _validate_positive(btc_price, "btc_price")
    if debt_usd == 0:
        return 0.0
    return debt_usd / btc_price


def net_btc_after_debt(total_btc: float, debt_usd: float, btc_price: float) -> float:
    """Return total BTC holdings net of the BTC equivalent of debt."""

    return total_btc - debt_btc_equivalent(debt_usd, btc_price)


def margin_call_price(
    debt_usd: float, collateral_btc: float, margin_call_ltv: float
) -> float:
    """Return the BTC price at which the margin-call LTV is reached."""

    _validate_positive(collateral_btc, "collateral_btc")
    _validate_threshold(margin_call_ltv, "margin_call_ltv")
    if debt_usd == 0:
        return 0.0
    return debt_usd / (collateral_btc * margin_call_ltv)


def liquidation_price(
    debt_usd: float, collateral_btc: float, liquidation_ltv: float
) -> float:
    """Return the BTC price at which the liquidation LTV is reached."""

    _validate_positive(collateral_btc, "collateral_btc")
    _validate_threshold(liquidation_ltv, "liquidation_ltv")
    if debt_usd == 0:
        return 0.0
    return debt_usd / (collateral_btc * liquidation_ltv)


def price_drop_to_threshold(threshold_price: float, current_price: float) -> float:
    """Return fractional price drop from current price to a threshold price."""

    _validate_positive(current_price, "current_price")
    if threshold_price <= 0:
        return 0.0
    return 1 - threshold_price / current_price
