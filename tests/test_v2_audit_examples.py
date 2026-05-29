from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from model_v2.risk import (  # noqa: E402
    debt_btc_equivalent,
    effective_ltv,
    liquidation_price,
    margin_call_price,
    net_btc_after_debt,
    price_drop_to_threshold,
)


EXAMPLE_COLLATERAL_BTC = 2.66666667
EXAMPLE_DEBT_USD = 40_000.0
EXAMPLE_BTC_PRICE = 60_000.0
EXAMPLE_LIQUIDATION_LTV = 0.75
EXAMPLE_MARGIN_CALL_LTV = 0.70


def test_sats_style_example_liquidation_price_is_20000() -> None:
    assert liquidation_price(
        EXAMPLE_DEBT_USD,
        EXAMPLE_COLLATERAL_BTC,
        EXAMPLE_LIQUIDATION_LTV,
    ) == pytest.approx(20_000.0)


def test_sats_style_example_effective_ltv_is_25_percent() -> None:
    assert effective_ltv(
        EXAMPLE_DEBT_USD,
        EXAMPLE_COLLATERAL_BTC,
        EXAMPLE_BTC_PRICE,
    ) == pytest.approx(0.25)


def test_zero_debt_returns_zero_ltv_and_threshold_prices() -> None:
    assert effective_ltv(0.0, EXAMPLE_COLLATERAL_BTC, EXAMPLE_BTC_PRICE) == 0.0
    assert margin_call_price(0.0, EXAMPLE_COLLATERAL_BTC, EXAMPLE_MARGIN_CALL_LTV) == 0.0
    assert liquidation_price(0.0, EXAMPLE_COLLATERAL_BTC, EXAMPLE_LIQUIDATION_LTV) == 0.0
    assert debt_btc_equivalent(0.0, EXAMPLE_BTC_PRICE) == 0.0


@pytest.mark.parametrize("collateral_btc", [0.0, -1.0])
def test_invalid_collateral_raises_value_error(collateral_btc: float) -> None:
    with pytest.raises(ValueError):
        effective_ltv(EXAMPLE_DEBT_USD, collateral_btc, EXAMPLE_BTC_PRICE)
    with pytest.raises(ValueError):
        margin_call_price(EXAMPLE_DEBT_USD, collateral_btc, EXAMPLE_MARGIN_CALL_LTV)
    with pytest.raises(ValueError):
        liquidation_price(EXAMPLE_DEBT_USD, collateral_btc, EXAMPLE_LIQUIDATION_LTV)


@pytest.mark.parametrize("btc_price", [0.0, -60_000.0])
def test_invalid_price_raises_value_error(btc_price: float) -> None:
    with pytest.raises(ValueError):
        effective_ltv(EXAMPLE_DEBT_USD, EXAMPLE_COLLATERAL_BTC, btc_price)
    with pytest.raises(ValueError):
        debt_btc_equivalent(EXAMPLE_DEBT_USD, btc_price)
    with pytest.raises(ValueError):
        net_btc_after_debt(EXAMPLE_COLLATERAL_BTC, EXAMPLE_DEBT_USD, btc_price)
    with pytest.raises(ValueError):
        price_drop_to_threshold(20_000.0, btc_price)


@pytest.mark.parametrize("threshold", [0.0, -0.1, 1.0, 1.2])
def test_invalid_ltv_threshold_raises_value_error(threshold: float) -> None:
    with pytest.raises(ValueError):
        margin_call_price(EXAMPLE_DEBT_USD, EXAMPLE_COLLATERAL_BTC, threshold)
    with pytest.raises(ValueError):
        liquidation_price(EXAMPLE_DEBT_USD, EXAMPLE_COLLATERAL_BTC, threshold)


def test_net_btc_after_debt_subtracts_debt_btc_equivalent() -> None:
    assert debt_btc_equivalent(EXAMPLE_DEBT_USD, EXAMPLE_BTC_PRICE) == pytest.approx(
        0.66666667
    )
    assert net_btc_after_debt(
        EXAMPLE_COLLATERAL_BTC,
        EXAMPLE_DEBT_USD,
        EXAMPLE_BTC_PRICE,
    ) == pytest.approx(2.0)


def test_price_drop_to_threshold() -> None:
    assert price_drop_to_threshold(20_000.0, 60_000.0) == pytest.approx(2 / 3)
    assert price_drop_to_threshold(0.0, 60_000.0) == 0.0
