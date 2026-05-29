# BTC-Backed Loan Spreadsheet v2 Model Specification

Status: Draft for rebuild
Date: 2026-05-29
Decision: Option C — one workbook, two separate strategy engines: Accumulation and Income

## 1. Why v2 exists

The current workbook is arithmetically useful but strategically wrong for the product we need. It runs Accumulation and Income through a shared loan lifecycle and uses rebalancing rules that do not match how BTC-backed loans are normally used for either:

- BTC accumulation through recursive/looped collateral, or
- spendable income funded by borrowing against BTC.

The v2 workbook must separate the two strategy engines. They share inputs, price paths, and risk math, but they do not share a single state table or a mode toggle.

## 2. Workbook architecture

Tabs:

1. Inputs
   - Shared assumptions
   - Accumulation assumptions
   - Income assumptions
   - Risk thresholds
   - Price scenario assumptions

2. Price Projection
   - Deterministic annual BTC price paths
   - Pessimistic / Base / Optimistic
   - Annual YoY change
   - Optional stress drawdown fields

3. Accumulation Engine
   - Recursive BTC leverage model
   - Borrow stablecoins, buy BTC, redeposit purchased BTC as collateral
   - Tracks gross BTC, debt, net BTC after debt, effective LTV, liquidation price

4. Income Engine
   - Borrow-only income model
   - Borrow annual stablecoin income against BTC collateral
   - Does not sell BTC by default
   - Tracks funded income, debt, LTV path, liquidation price, sustainability

5. Risk & Alerts
   - Shared risk calculations for both engines
   - Effective LTV, margin-call price, liquidation price, borrowing capacity, safety buffer

6. Summary
   - Passive hold comparison
   - Accumulation summary
   - Income summary
   - Risk summary
   - Verdict flags

7. Audit Examples
   - Hardcoded examples and expected outputs used to validate formulas

## 3. Core principles

### 3.1 Strategies, not modes

Accumulation and Income are different strategies. Do not implement them as one table with an Inputs!Mode switch.

Accumulation asks:

> How much additional BTC exposure can I build by borrowing stablecoins, buying BTC, and redepositing it as collateral while keeping liquidation risk acceptable?

Income asks:

> How much spendable USD/stablecoin income can I borrow against BTC while preserving acceptable LTV and liquidation buffers?

### 3.2 Effective LTV uses total posted collateral

In v2, effective LTV is always:

```text
effective_ltv = debt_usd / (posted_collateral_btc * btc_price)
```

For recursive accumulation, purchased BTC is assumed to be posted as collateral unless the user selects a non-recursive strategy variant.

### 3.3 Debt is USD/stablecoin denominated

Debt remains fixed in USD terms except for:

- accrued interest,
- new borrowing,
- repayments,
- fees if explicitly modeled as financed.

Debt in BTC equivalent is diagnostic only:

```text
debt_btc_equivalent = debt_usd / btc_price
net_btc_after_debt = total_btc_held - debt_btc_equivalent
```

### 3.4 Income is borrowed, not sold, by default

The default income model borrows stablecoins for income. Selling BTC for income is an optional fallback/deleveraging action, not the primary model.

This distinction matters because:

- borrowing is the core BTC-backed loan use case,
- selling BTC creates taxable/frictional events in many jurisdictions,
- selling BTC for income undermines the “keep BTC exposure” premise.

## 4. Shared inputs

Recommended Inputs tab sections:

### 4.1 Starting position

| Input | Default | Notes |
|---|---:|---|
| Starting BTC | 2.0 | User's initial BTC position |
| Current BTC price | 75000 | Starting spot price |
| Projection start year | 2026 | First modeled year |
| Projection length | 20 | Number of future years |
| Scenario selected for Summary | Base | Summary scenario |

### 4.2 Borrowing terms

| Input | Default | Notes |
|---|---:|---|
| Borrow APR | 0.1149 | Stablecoin loan APR |
| Interest treatment | Capitalized | Capitalized / Paid externally |
| Origination fee | 0.00 | Optional |
| Platform fee | 0.00 | Optional |
| Margin call LTV | 0.70 | Platform-specific |
| Liquidation LTV | 0.80 | Platform-specific |
| Warning LTV | 0.60 | Conservative alert threshold |
| Minimum liquidation buffer | 0.50 | Require liquidation price to remain at least 50% below current price unless explicitly overridden |

### 4.3 Accumulation inputs

| Input | Default | Notes |
|---|---:|---|
| Accumulation strategy | Recursive Loop | Recursive Loop / Borrow Once / Maintain Effective LTV / Risk-Managed |
| Target leverage multiple | 1.30 | Conservative default |
| Target effective LTV | derived | `1 - 1 / leverage_multiple` |
| Max effective LTV | 0.35 | Hard cap before no further borrowing |
| Re-loop policy | Setup + annual safe top-up | Setup only / Annual safe top-up / Threshold only |
| Deleveraging policy | Flag only | Flag only / Sell collateral to target / External top-up |

### 4.4 Income inputs

| Input | Default | Notes |
|---|---:|---|
| Income strategy | Borrow Income | Borrow Income / Borrow Capacity % / Hybrid later |
| Max available annual income | calculated | USD/stablecoin capacity from BTC collateral, LTV ceiling, existing debt, interest, and liquidation buffer |
| Selected annual income draw | 50000 | User-selected USD/stablecoin draw; capped by max available annual income |
| Income start year | 1 | First year to borrow income |
| Income LTV ceiling | 0.35 | Post-income max LTV |
| Minimum liquidation buffer | 0.50 | Required drop-to-liquidation buffer |
| Unfunded income handling | Show shortfall | Do not auto-sell BTC by default |
| Optional BTC-sale fallback | No | Explicit opt-in only |

## 5. Shared formulas

Let:

```text
P_t = BTC price in year t
BTC0 = starting BTC
collateral_btc_t = BTC posted as collateral at end of year t
total_btc_t = total BTC held at end of year t
debt_t = debt USD/stablecoin at end of year t
APR = borrow APR
MC = margin call LTV
LIQ = liquidation LTV
```

Core formulas:

```text
collateral_value_t = collateral_btc_t * P_t
effective_ltv_t = debt_t / collateral_value_t
net_equity_usd_t = total_btc_t * P_t - debt_t
debt_btc_equivalent_t = debt_t / P_t
net_btc_after_debt_t = total_btc_t - debt_btc_equivalent_t
margin_call_price_t = debt_t / (collateral_btc_t * MC)
liquidation_price_t = debt_t / (collateral_btc_t * LIQ)
price_drop_to_margin_t = 1 - margin_call_price_t / P_t
price_drop_to_liquidation_t = 1 - liquidation_price_t / P_t
interest_t = debt_start_t * APR
```

If interest is capitalized:

```text
debt_after_interest_t = debt_start_t + interest_t
```

If interest is paid externally:

```text
debt_after_interest_t = debt_start_t
external_interest_paid_t = interest_t
```

## 6. Accumulation Engine

### 6.1 Purpose

The Accumulation Engine models BTC exposure growth through recursive borrowing:

1. Borrow stablecoins against BTC.
2. Buy BTC.
3. Deposit the purchased BTC as additional collateral.
4. Monitor effective LTV and liquidation price.
5. Optionally borrow more only when safe.

### 6.2 Closed-form setup for recursive leverage

If all borrowed funds buy BTC and the purchased BTC is posted as collateral, the relationship between target effective LTV and gross leverage is:

```text
leverage_multiple = 1 / (1 - target_effective_ltv)
target_effective_ltv = 1 - 1 / leverage_multiple
final_collateral_btc = starting_btc * leverage_multiple
initial_debt = target_effective_ltv * final_collateral_btc * P_0
btc_purchased = final_collateral_btc - starting_btc
```

Examples:

| Leverage multiple | Effective LTV |
|---:|---:|
| 1.20x | 16.67% |
| 1.30x | 23.08% |
| 1.40x | 28.57% |
| 1.60x | 37.50% |
| 2.00x | 50.00% |

This is different from the old model's “LTV on original collateral.”

### 6.3 Annual lifecycle

For each year t:

1. Read BTC price `P_t`.
2. Carry forward prior year collateral BTC, total BTC, and debt.
3. Accrue interest according to interest treatment.
4. Compute pre-action effective LTV and liquidation price.
5. Determine whether new borrowing is allowed:
   - not liquidated,
   - effective LTV below target,
   - post-borrow LTV below max effective LTV,
   - liquidation buffer above minimum.
6. If allowed, calculate borrowing capacity.
7. Use new borrowing to buy BTC.
8. Add purchased BTC to collateral and total BTC.
9. If over risk threshold, either flag required action or deleverage according to policy.
10. Compute end-of-year metrics.

### 6.4 Additional borrowing formula

For v2 initial implementation, use recursive top-up only. Borrowed funds are immediately used to buy BTC and the purchased BTC is posted as collateral.

First choose the effective LTV to borrow toward:

```text
buffer_ltv_limit = liquidation_ltv * (1 - minimum_liquidation_buffer)
borrow_ltv = min(target_ltv, max_effective_ltv, buffer_ltv_limit)
```

Validate `0 <= borrow_ltv < 1`.

Solve for new borrowing `B`:

```text
(debt_after_interest + B) / ((collateral_btc_start + B / P_t) * P_t) = borrow_ltv
```

Therefore:

```text
recursive_borrow_capacity = max(0, (borrow_ltv * collateral_btc_start * P_t - debt_after_interest) / (1 - borrow_ltv))
btc_bought = recursive_borrow_capacity / P_t
collateral_btc_end = collateral_btc_start + btc_bought
total_btc_end = collateral_btc_end
debt_end = debt_after_interest + recursive_borrow_capacity
```

Do not borrow if the position is already at or above `borrow_ltv`, in margin call, liquidated, or below the required liquidation buffer.

### 6.5 Exact deleveraging formula if BTC is sold

If selling collateral BTC to repay debt and target an effective LTV, selling changes both debt and collateral. Solve:

```text
(debt - R) / ((collateral_btc - R / P_t) * P_t) = target_ltv
```

Therefore:

```text
repayment_required = max(0, (debt - target_ltv * collateral_btc * P_t) / (1 - target_ltv))
btc_sold = repayment_required / P_t
debt_end = debt - repayment_required
collateral_btc_end = collateral_btc - btc_sold
```

Guards:

- `target_ltv` must be less than 1.
- repayment must not exceed debt.
- BTC sold must not exceed collateral BTC.
- If debt is greater than or equal to collateral value, mark the row insolvent/liquidated rather than pretending a normal repayment can repair the position.

V2 default should be “flag only” rather than forced BTC sale, unless the user explicitly selects a deleveraging policy.

### 6.6 Accumulation outputs

Required columns:

- Year
- BTC price
- Starting collateral BTC
- Starting debt
- Interest accrued
- Debt after interest
- Pre-action effective LTV
- New borrowing
- BTC bought
- Ending collateral BTC
- Ending debt
- Gross BTC held
- Debt BTC equivalent
- Net BTC after debt
- Extra BTC vs passive hold
- Net equity USD
- Effective LTV end
- Leverage multiple
- Margin-call price
- Liquidation price
- Drop to liquidation
- Risk status

## 7. Income Engine

### 7.1 Purpose

The Income Engine models spendable income funded by borrowing stablecoins against BTC collateral. It answers:

- How much income capacity does the BTC collateral support?
- How much of the user's selected draw can be funded?
- How does debt grow?
- How much liquidation buffer remains?
- When does the income plan become constrained or unsafe?

### 7.2 Default behavior

Default income behavior:

- Keep BTC collateral constant.
- Accrue interest.
- Calculate max available annual income from collateral, safe LTV, existing debt, and liquidation buffer.
- Borrow the selected annual income draw if capacity allows.
- Do not buy BTC.
- Do not sell BTC.
- Show shortfall if selected income draw exceeds safe capacity.

### 7.3 Annual lifecycle

For each year t:

1. Read BTC price `P_t`.
2. Carry forward collateral BTC and debt.
3. Accrue interest according to interest treatment.
4. Compute pre-income effective LTV.
5. Compute max safe debt:

```text
ltv_limit_debt = collateral_btc * P_t * income_ltv_ceiling
buffer_limit_debt = collateral_btc * P_t * liquidation_ltv * (1 - minimum_liquidation_buffer)
max_safe_debt = min(ltv_limit_debt, buffer_limit_debt)
```

6. Compute available borrowing capacity:

```text
available_capacity = max(0, max_safe_debt - debt_after_interest)
```

7. Present max available annual income and read the selected income draw.
8. Borrow income:

```text
max_available_annual_income = available_capacity
income_borrowed = min(selected_income_draw, max_available_annual_income)
unfunded_income = selected_income_draw - income_borrowed
debt_end = debt_after_interest + income_borrowed
```

9. Compute ending risk metrics.
10. Flag sustainability.

### 7.4 Income sustainability flags

Suggested flags, in precedence order:

1. LIQUIDATED: LTV >= liquidation threshold.
2. MARGIN CALL: LTV >= margin call threshold.
3. WARNING: LTV >= warning LTV or drop-to-liquidation is below the minimum liquidation buffer.
4. CONSTRAINED: selected income draw is only partially funded.
5. FAILED: none of the selected income draw can be funded for the year.
6. SAFE: full income funded and risk thresholds are satisfied.

If multiple conditions are true, report the highest-precedence status. For example, a year can be both constrained and in warning territory; display WARNING and retain unfunded income as a numeric output.

### 7.5 Income outputs

Required columns:

- Year
- BTC price
- Starting collateral BTC
- Starting debt
- Interest accrued
- Debt after interest
- Selected income draw
- Max available annual income
- Income borrowed
- Unfunded income
- Cumulative income borrowed
- Ending debt
- Debt BTC equivalent
- Net BTC after debt
- Net equity USD
- Effective LTV end
- Margin-call price
- Liquidation price
- Drop to liquidation
- Sustainability status

## 8. Risk & Alerts tab

Risk calculations must be visible, not hidden in Summary formulas.

Required sections:

- Accumulation risk path
- Income risk path
- Passive hold comparison
- Worst-year metrics

Required metrics:

- Max effective LTV
- Min drop-to-liquidation
- First warning year
- First constrained income year
- Liquidation year if any
- Total interest accrued
- Total new borrowing
- Total income funded
- Net BTC after debt at end
- BTC outperformance vs passive

## 9. Summary tab

Summary must not imply the two engines are directly interchangeable. It should show distinct questions.

Accumulation Summary:

- Starting BTC
- Ending gross BTC
- Ending debt
- Debt BTC equivalent
- Net BTC after debt
- Extra BTC vs passive
- Ending effective LTV
- Liquidation BTC price
- Minimum drop-to-liquidation
- Verdict

Income Summary:

- Starting BTC
- Requested cumulative income
- Funded cumulative income
- Unfunded cumulative income
- Ending debt
- Debt BTC equivalent
- Net BTC after debt
- Ending effective LTV
- Liquidation BTC price
- First constrained year
- Verdict

Passive Hold Summary:

- BTC held
- Ending USD value
- No debt

## 10. Audit examples

The workbook must include hardcoded audit examples with expected results.

### 10.1 Recursive setup example

Input:

- Starting BTC = 2.0
- BTC price = $60,000
- Target effective LTV = 25%

Expected:

```text
final_collateral_btc = 2 / (1 - 0.25) = 2.66666667 BTC
btc_purchased = 0.66666667 BTC
debt = 0.25 * 2.66666667 * 60000 = $40,000
effective_ltv = 25%
liquidation_price at 75% threshold = 40000 / (2.66666667 * 0.75) = $20,000
```

### 10.2 Double-loop / 30.6% effective LTV example

Use the article-style benchmark:

- Starting BTC = 2.0
- BTC price = $60,000
- Gross BTC ≈ 2.883
- Debt ≈ $53,000
- Effective LTV ≈ 30.6%

This example may be represented either as explicit two-loop steps or as a target effective LTV close to 30.6%.

### 10.3 Income capacity example

Input:

- Collateral BTC = 2.0
- BTC price = $100,000
- Existing debt = $30,000
- Income LTV ceiling = 35%
- Max available annual income = $40,000
- Selected income draw = $50,000

Expected:

```text
max_safe_debt = 2 * 100000 * 0.35 = $70,000
available_capacity = 70000 - 30000 = $40,000
income_borrowed = $40,000
unfunded_income = $10,000
debt_end = $70,000
```

## 11. Implementation requirements

- Build a pure Python reference model before building Excel formulas.
- Tests must validate the reference model against audit examples.
- Spreadsheet formulas must mirror the reference model.
- Generated workbook must include audit example rows.
- Do not reuse old mode-sensitive Summary formulas.
- Do not preserve old rebalancing enums as the primary v2 interface.
- Make output path configurable and Linux-safe.
- Explicitly model Year 0/setup separately from Year 1 annual lifecycle. Interest accrues on debt outstanding at the start of an annual row; new borrowing in that row begins accruing interest in the following row.
- Defer origination/platform fees in the initial v2 implementation unless exact treatment is specified and tested.
- Validate core thresholds: `0 < warning_ltv < margin_call_ltv < liquidation_ltv < 1`, `income_ltv_ceiling < margin_call_ltv`, and `max_effective_ltv < margin_call_ltv`.
- Initial v2 supports only Accumulation = Recursive Loop with flag-only deleveraging and Income = Borrow Income with show-shortfall. Other strategy labels must be marked future/disabled until formulas and tests exist.
- Numerical tolerances for tests: BTC within `1e-8`, USD within `$0.01` for reference model tests, LTV within `0.0001`.

## 12. Known limitations to disclose

- Annual time steps understate intrayear liquidation risk.
- Borrow APR may change over time.
- Real lending platforms may restrict recursive collateral, rehypothecation, collateral types, or renewals.
- Taxes are not modeled.
- Liquidation penalties are not modeled unless explicitly added.
- Stablecoin, custody, smart-contract, oracle, counterparty, regulatory, and operational risks are outside the math.

## 13. v2 acceptance criteria

The v2 workbook is acceptable only when:

1. Accumulation and Income are separate engine tabs.
2. Accumulation uses effective LTV against total collateral for recursive strategies.
3. Income defaults to borrowing stablecoins, not selling BTC.
4. Summary reports passive-vs-strategy deltas clearly.
5. Audit examples are visible and match expected values.
6. A pure Python model and tests exist for the core formulas.
7. Generated workbook can be regenerated from the script without manual edits.
