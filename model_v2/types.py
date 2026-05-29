"""Shared dataclasses and enums for the spreadsheet v2 reference model."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class InterestTreatment(StrEnum):
    """How loan interest is handled by a strategy engine."""

    CAPITALIZED = "capitalized"
    PAID_EXTERNALLY = "paid_externally"


class AccumulationStrategy(StrEnum):
    """Supported accumulation strategy variants."""

    RECURSIVE_LOOP = "recursive_loop"
    BORROW_ONCE = "borrow_once"
    MAINTAIN_EFFECTIVE_LTV = "maintain_effective_ltv"
    RISK_MANAGED = "risk_managed"


class IncomeStrategy(StrEnum):
    """Supported income strategy variants."""

    BORROW_INCOME = "borrow_income"
    BORROW_CAPACITY_PERCENT = "borrow_capacity_percent"


@dataclass(frozen=True)
class BorrowTerms:
    """Shared borrowing assumptions."""

    borrow_apr: float
    interest_treatment: InterestTreatment = InterestTreatment.CAPITALIZED
    origination_fee: float = 0.0
    platform_fee: float = 0.0


@dataclass(frozen=True)
class RiskThresholds:
    """Shared risk threshold assumptions."""

    margin_call_ltv: float
    liquidation_ltv: float
    warning_ltv: float = 0.60
    minimum_liquidation_buffer: float = 0.50


@dataclass(frozen=True)
class PricePoint:
    """One annual BTC price projection point."""

    year: int
    btc_price: float
    scenario: str = "base"
    yoy_change: float | None = None


@dataclass(frozen=True)
class AccumulationConfig:
    """Configuration for the recursive accumulation engine."""

    starting_btc: float
    current_btc_price: float
    borrow_terms: BorrowTerms
    risk_thresholds: RiskThresholds
    strategy: AccumulationStrategy = AccumulationStrategy.RECURSIVE_LOOP
    target_leverage_multiple: float | None = None
    target_effective_ltv: float | None = None
    max_effective_ltv: float = 0.35


@dataclass(frozen=True)
class AccumulationRow:
    """One output row from the accumulation engine."""

    year: int
    btc_price: float
    collateral_btc: float
    total_btc: float
    debt_usd: float
    effective_ltv: float
    liquidation_price: float
    margin_call_price: float = 0.0
    debt_btc_equivalent: float = 0.0
    net_btc_after_debt: float = 0.0
    interest_usd: float = 0.0
    borrowed_usd: float = 0.0
    btc_purchased: float = 0.0
    warning: str | None = None


@dataclass(frozen=True)
class IncomeConfig:
    """Configuration for the borrow-funded income engine."""

    starting_btc: float
    current_btc_price: float
    annual_income_target: float
    borrow_terms: BorrowTerms
    risk_thresholds: RiskThresholds
    strategy: IncomeStrategy = IncomeStrategy.BORROW_INCOME
    income_start_year: int = 1
    income_ltv_ceiling: float = 0.35


@dataclass(frozen=True)
class IncomeRow:
    """One output row from the income engine."""

    year: int
    btc_price: float
    collateral_btc: float
    debt_usd: float
    income_borrowed_usd: float
    income_shortfall_usd: float
    effective_ltv: float
    liquidation_price: float
    margin_call_price: float = 0.0
    debt_btc_equivalent: float = 0.0
    net_btc_after_debt: float = 0.0
    interest_usd: float = 0.0
    warning: str | None = None
