# Bitcoin Leveraged Accumulation & Income Model — Specification v3

## 1. Purpose

A spreadsheet model that projects outcomes when a Bitcoin holder uses their BTC as collateral to borrow and acquire *more* Bitcoin. The bet is simple: if Bitcoin's long-term price appreciation exceeds the cost of borrowing, the leveraged position generates excess return. That excess can be withdrawn as retirement income or reinvested to accumulate more BTC than simply holding.

This is **not** a lending-yield model. The user is the borrower, not the lender. There is no "lending APY" to earn — the profit comes from the spread between BTC's CAGR and the borrowing rate, applied to a larger BTC position than the user could otherwise hold.

## 2. The Core Strategy

### 2.1 Mechanics

```
Year 0:
  1. User deposits N BTC as collateral on a borrowing platform
  2. User borrows stablecoins worth N × BTC_price × LTV%
  3. User swaps borrowed stablecoins for BTC
  4. User now holds N + borrowed_BTC (total), with debt = borrowed_stablecoins

Each subsequent year:
  1. BTC price changes — collateral value and position value change
  2. Borrow interest accrues on the outstanding debt
  3. Effective LTV = debt ÷ collateral_value (changes with price)
  4. Decision: withdraw excess return as income, repay some debt, borrow more, or let it ride
```

### 2.2 Where the Return Comes From

| Component | Formula |
|-----------|---------|
| Starting net worth (BTC) | N (the user's original holdings) |
| Total BTC held (leveraged) | N + borrowed_BTC |
| Annual BTC appreciation | total_BTC × price_gain% |
| Annual borrowing cost | debt × borrow_APR |
| **Excess return** | appreciation − borrowing_cost |
| **Income withdrawn** | Portion of excess return sold for USD (if in income mode) |
| **BTC accumulated** | Excess return kept as additional BTC (if in accumulation mode) |

### 2.3 Why Borrow Stablecoins (Not BTC)

The model assumes borrowing **stablecoins** (USDC, USDT) and swapping for BTC, rather than borrowing BTC directly. Reason: the debt is fixed in USD terms while the collateral is in BTC. When BTC price rises, the collateral grows but the debt stays the same — LTV improves naturally and the user gains equity. When BTC price falls, LTV worsens and liquidation risk increases.

If the user borrowed BTC directly, both collateral and debt would rise together in USD terms — no natural deleveraging from price appreciation, and liquidation risk is more sensitive. Stablecoin borrowing is also far more common across platforms (Aave, Compound, Morpho, centralized lenders).

The model includes an optional toggle for BTC-denominated borrowing as an alternative, with appropriate adjustments.

#### Inflation Tailwind

Borrowing stablecoins carries an additional, often overlooked advantage: **fiat inflation erodes the real value of the debt over time.** A $52,500 loan today is worth about $29,000 in purchasing power after 20 years at 3% annual inflation — even before making a single payment. Meanwhile, BTC is a hard asset whose price should, over long timeframes, reflect monetary debasement.

This means the *real* (inflation-adjusted) borrowing cost is lower than the nominal rate:

```
Real borrow cost ≈ Nominal APR − Inflation rate
```

At 11.49% nominal APR with 3% inflation, the real cost is roughly 8.5%. The spread between BTC's real appreciation and this real borrowing cost is the true economic return.

The model optionally displays real (inflation-adjusted) values alongside nominal figures. When enabled, all USD amounts are discounted by the user's inflation assumption so they reflect constant purchasing power. This is especially important over a 20-year horizon where inflation compounding is significant.

### 2.4 Two Modes

The user chooses one mode in the Inputs tab:

**Accumulation Mode:** All excess return is reinvested. Each year, as BTC rises and LTV improves, the user can borrow more to buy additional BTC (maintaining target LTV). Net BTC holdings grow faster than simply holding. No USD income is taken.

**Income Mode:** A portion of the excess return is sold for USD and withdrawn each year. The user specifies either a fixed dollar amount or a percentage of excess return to withdraw. The remaining excess stays in the position.

### 2.5 Simple Numerical Example (using Ledn-like parameters)

| | Year 0 | Year 1 (+40% BTC) |
|---|---|---|
| BTC price | $75,000 | $105,000 |
| Collateral (BTC) | 2.0 | 2.0 |
| Collateral value | $150,000 | $210,000 |
| LTV target | 50% | 50% (rebalanced) |
| Borrowed (USD) | $75,000 | $105,000 (borrow more as collateral rose) |
| BTC bought with borrowed | 1.0 BTC | 1.0 BTC (new borrowing buys more) |
| Total BTC held | 3.0 | 3.0 + new_borrowed_BTC |
| Borrow interest (11.49%) | — | $75,000 × 11.49% = $8,618 |
| Appreciation on original 2 BTC | — | 2.0 × $30,000 = $60,000 |
| Appreciation on borrowed 1.0 BTC | — | 1.0 × $30,000 = $30,000 |
| Total appreciation | — | $90,000 |
| Excess return | — | $90,000 − $8,618 = $81,382 |
| **In accumulation mode:** | — | $81,382 buys +0.78 BTC at $105K. Now hold ~3.78 BTC total |
| **In income mode (withdraw 30%):** | — | Withdraw $24,415. Reinvest $56,967 (+0.54 BTC). Now hold ~3.54 BTC |

Without leverage, the user would hold 2.0 BTC worth $210,000 (gain of $60,000). With leverage at 50% LTV, net worth after repaying debt is $210,000 + $105,000 (from borrowed BTC) − $75,000 (debt) = $240,000 in equity. The leverage amplified the return from $60K to ~$81K excess.

---

## 3. Spreadsheet Structure

| Tab | Name | Purpose |
|-----|------|---------|
| 1 | **Inputs** | All user-configurable parameters |
| 2 | **Price Projection** | Three BTC price scenarios (20 years) |
| 3 | **Leveraged Position** | Year-by-year: position value, debt, LTV, excess return, liquidation risk |
| 4 | **Income / Accumulation** | Year-by-year: income withdrawn (income mode) or BTC accumulated (accumulation mode) |
| 5 | **Summary** | Key metrics across all scenarios, both modes |

---

## 4. Tab 1 — Inputs

### 4.1 BTC Position

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| BTC holdings | Total Bitcoin used as collateral | 2.0 | BTC |
| Current BTC price | Spot price at model start | $75,000 | USD |

### 4.2 Borrowing Parameters

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| LTV target | Target loan-to-value ratio (how much to borrow as % of collateral). Ledn offers 50% initial LTV. | 50% | % |
| Borrow APR | Annual interest rate on borrowed funds. Ledn tiered rates: 11.49% (loans <$250K), 10.49% ($250K+), 9.99% ($500K+), 9.75% ($1M+). Simple interest, not compounding. | 11.49% | % |
| Origination fee | One-time fee on initial loan. Ledn charges none. | 0.0% | % |
| Annual platform fee | Ongoing custody or management fee. Ledn charges none. | 0.0% | % |
| Borrow currency | "Stablecoins/USD" (default, as Ledn issues) or "BTC" (BTC-denominated debt, not offered by Ledn) | Stablecoins/USD | toggle |
| Margin call LTV | LTV at which the platform requires additional collateral. Ledn margin calls at 70%. | 70% | % |
| Liquidation LTV | LTV at which the platform liquidates the collateral. Ledn liquidates at 80%. | 80% | % |
| Safety margin | Extra LTV buffer for early warning (warning at margin_call_LTV − margin) | 10 pp | percentage points |

**Important:** Ledn loans have a 12-month term and must be renewed annually. The model treats renewal as frictionless provided LTV is healthy (under 70%), but adds a "renewal risk" flag if LTV exceeds the margin call threshold at renewal time, since the platform may require collateral top-up or partial repayment to renew.

#### Risk Profile Presets

Rather than picking an LTV arbitrarily, the user can select from four risk profiles. The table below shows what BTC price drop triggers a margin call (70% LTV) and liquidation (80% LTV) at each LTV level, using Ledn's thresholds.

| Profile | LTV | Margin call at | Liquidation at | Borrowed (2 BTC, $75K) | Annual interest | Initial extra BTC | Who it's for |
|---------|-----|----------------|----------------|------------------------|-----------------|--------------------|-------------|
| **Conservative** | 10% | BTC drops 86% (to ~$10,700) | BTC drops 87.5% (to ~$9,400) | $15,000 | $1,723 | 0.20 | Near-zero liquidation risk. Amplification is minimal — mainly a "dry powder" reserve. |
| **Moderate** | 25% | BTC drops 64% (to ~$26,800) | BTC drops 69% (to ~$23,400) | $37,500 | $4,309 | 0.50 | Survives most drawdowns historically. Modest but meaningful return amplification. |
| **Standard** | 35% | BTC drops 50% (to ~$37,500) | BTC drops 56% (to ~$32,800) | $52,500 | $6,032 | 0.70 | Balance of risk and reward. Margin call possible in severe bears (2018, 2022 would have triggered). |
| **Aggressive** | 50% | BTC drops 29% (to ~$53,600) | BTC drops 37.5% (to ~$46,900) | $75,000 | $8,618 | 1.00 | Maximum borrowing. A 29% drop triggers margin call — common in any volatile year. Requires active monitoring. |

**How to read the table:** A "Conservative" 10% LTV means BTC would need to crash from $75K to ~$10,700 before Ledn issues a margin call — an 86% drawdown, worse than any BTC bear market in history. The trade-off: only 0.20 BTC is acquired upfront. At the other extreme, "Aggressive" 50% LTV nets a full extra Bitcoin at origination but a routine 29% correction triggers a margin call. The "Initial extra BTC" column shows how much additional BTC the user holds at year 0 — the actual gain or loss over time depends on BTC price appreciation net of interest costs, which the full model projects year-by-year.

**Recommendation:** For a user with strong long-term BTC conviction who does not want to actively monitor LTV, the Moderate (25%) or Standard (35%) profiles offer the best risk/reward. The Conservative profile (10%) is suitable for users who want exposure to the strategy with effectively zero liquidation risk, even if returns are modest.

The formula for calculating the margin call and liquidation trigger prices:

```
Margin_Call_Price  = Initial_BTC_Price × (LTV / Margin_Call_LTV)
Liquidation_Price  = Initial_BTC_Price × (LTV / Liquidation_LTV)
```

Example (Standard, 35% LTV): Margin call at $75,000 × (0.35 / 0.70) = $37,500 — a 50% drop.

### 4.3 Mode & Withdrawal

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| Mode | Accumulation (reinvest all) or Income (withdraw some) | Accumulation | toggle |
| Withdrawal rule | "Fixed $" (withdraw fixed USD/year) or "% of excess return" | % of excess return | toggle |
| Withdrawal amount | Fixed dollar amount (if fixed $) or % of excess return (if %) | 50% | USD or % |

### 4.4 Rebalancing Behavior

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| Rebalance rule | How to adjust borrowing each year | Maintain target LTV | choice |

Options for rebalancing:
- **Maintain target LTV:** Each year, adjust the borrowed amount (up or down) to return to the target LTV. When BTC rises, borrow more. When BTC falls, repay debt to avoid liquidation.
- **Never increase debt:** Borrow only at year 0. Let LTV drift down as BTC rises. Only repay if LTV breaches safety margin. More conservative.
- **Dynamic (follow model suggestions):** Follow the suggested adjustments in §6.3 based on price movement.

### 4.5 Inflation Assumption

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| Show real values | Display inflation-adjusted (real) figures alongside nominal | Yes | toggle |
| Annual inflation rate | Assumed USD inflation rate for real-value calculations | 3.0% | % |

When enabled, all USD-denominated values in the output tabs gain an additional "Real (today's $)" column. The adjustment formula:

```
Real_Value(t) = Nominal_Value(t) / (1 + inflation_rate)^t
```

This means:
- **Debt erodes in real terms** — the real burden of a fixed stablecoin loan shrinks each year
- **Income figures show purchasing power** — $10,000 in year 20 at 3% inflation is ~$5,500 in today's dollars
- **The real borrowing cost** is approximately the nominal APR minus the inflation rate
- **Real net worth** reflects what the end-state actually buys, not just the headline number

The toggle lets the user switch between nominal-only (simpler, matches actual dollar amounts) and real-inclusive (better for long-horizon planning).

### 4.6 Price Scenario Anchors

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| Pessimistic 2030 anchor | BTC price in 2030 (pessimistic) | $100,000 | USD |
| Median 2030 anchor | BTC price in 2030 (base/median) | $500,000 | USD |
| Optimistic 2030 anchor | BTC price in 2030 (optimistic) | $1,000,000 | USD |
| Post-2030 growth decay | Growth rate after 2030 as fraction of 2025–2030 CAGR | 30% | % |
| Cycle amplitude | Peak-to-trough volatility around trend line | 40% | % |
| Amplitude decay per cycle | Reduction in cycle amplitude each 4-year cycle | 15% | % |

### 4.7 Model Parameters

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| Start year | First projection year | 2025 | year |
| Projection length | Years to model | 20 | years |

---

## 5. Tab 2 — Price Projection

### 5.1 Method

**Two-phase compound growth with a 4-year cyclical overlay.**

Rather than fitting a logistic curve (which requires numerical solvers), the model uses a transparent two-phase approach:

**Phase 1 (Years 0–5, 2025–2030):** Compound at the rate needed to hit the user's 2030 anchor exactly.

**Phase 2 (Years 5–20, 2030–2045):** Compound at a reduced rate (Phase 1 rate × decay factor), reflecting market maturation and diminishing returns.

A dampened cosine wave overlays the trend to model Bitcoin's ~4-year halving cycle.

### 5.2 Calculation Steps (per scenario)

**Step 1 — Phase 1 CAGR:**
```
CAGR1 = (Anchor_2030 / Current_Price)^(1/5) − 1
```

**Step 2 — Phase 2 CAGR:**
```
CAGR2 = CAGR1 × Growth_Decay
```

**Step 3 — Trend price at year t:**
```
If t ≤ 5:  Trend(t) = Current_Price × (1 + CAGR1)^t
If t > 5:  Trend(t) = Anchor_2030 × (1 + CAGR2)^(t−5)
```

**Step 4 — Cyclical overlay:**

Bitcoin's 4-year halving cycle creates a rough pattern (last halving: April 2024):
- Halving year +1 (2025, 2029, 2033, 2037, 2041): bull market peaks
- Halving year +2 (2026, 2030, 2034, 2038, 2042): bear market troughs

A cosine wave with 4-year period, zero phase shift, aligns: peak at t=0 (2025), trough at t=2 (2027), peak at t=4 (2029), etc.

```
cycle_number = floor(t / 4)
effective_amplitude = Base_Amplitude × (1 − Amplitude_Decay)^cycle_number
Cycle_Multiplier(t) = 1 + effective_amplitude × cos(2π × t / 4)
```

**Step 5 — Final price:**
```
Price(t) = Trend(t) × Cycle_Multiplier(t)
```
Floor at $1.

### 5.3 Output Format

| Year | Pess Trend | Pess Price | Med Trend | Med Price | Opt Trend | Opt Price | YoY Change (Med) |
|------|-----------|-----------|----------|----------|----------|----------|-------------------|
| 2025 | $75,000 | $75,000 | $75,000 | $75,000 | $75,000 | $75,000 | — |
| 2026 | ... | ... | ... | ... | ... | ... | ... |

### 5.4 Example Calibration

With defaults: Current $75,000, Median anchor $500,000, Growth decay 30%.

- Phase 1 CAGR: (500K/75K)^0.2 − 1 ≈ 46.1%
- Phase 2 CAGR: 46.1% × 30% ≈ 13.8%
- 2045 trend: 500K × 1.138^15 ≈ $3.46M

### 5.5 Anchor Default Sources

| Scenario | 2030 Anchor | Source Cluster |
|----------|-------------|----------------|
| Pessimistic | $100,000 | Binance algorithmic (~$91K), CoinCodex (~$166K), muted growth |
| Median | $500,000 | Standard Chartered, YouHodler bull case, institutional consensus |
| Optimistic | $1,000,000 | ARK Invest base ($750K, rounded), Bernstein 2033 target |

Users should set their own anchors. The model illustrates what happens *if* those prices occur — it does not predict them.

---

## 6. Tab 3 — Leveraged Position

Year-by-year tracking of the collateral, debt, and risk position. This tab is scenario-independent in its structure but the user can switch which scenario's prices feed it (or view all three via the Summary tab).

### 6.1 Annual Cycle

```
Start of year:
  1. BTC price updates from Tab 2
  2. Collateral value recalculated
  3. Renewal check: if effective LTV > margin call threshold (70%), flag renewal risk — platform may require top-up
  4. Rebalancing decision: borrow more, repay debt, or maintain (per rebalance rule)
  5. If borrowing more: new USD/stablecoins borrowed, swapped for BTC, BTC holding increases
  6. If repaying: BTC sold to repay debt, BTC holding decreases

During year:
  7. Borrow interest accrues on outstanding debt
  8. Platform monitors LTV; if LTV reaches margin call (70%), user must top up collateral or partially repay (modeled as a flag)
  9. If LTV reaches liquidation (80%), position is liquidated

End of year (before next rebalance):
 10. Excess return calculated: (total BTC × price_change) − (interest + fees)
 11. Mode decision: income withdrawn or reinvested (feeds Tab 4)
```

### 6.2 Column Definitions

| Column | Description |
|--------|-------------|
| Year | Calendar year |
| BTC price | From Tab 2 (selected scenario) |
| Collateral BTC | BTC deposited as collateral (starts at user's holdings) |
| Collateral value (USD) | Collateral BTC × BTC price |
| Target LTV | User's chosen LTV (or dynamic suggestion) |
| Outstanding debt (USD) | Total stablecoin debt carried into this year |
| New borrowing (USD) | Additional borrowed this year (per rebalance rule; $0 or negative if repaying) |
| BTC bought/sold | New borrowing ÷ BTC price (BTC acquired) or debt repaid ÷ BTC price (BTC sold) |
| Total leveraged BTC | Collateral BTC + cumulative borrowed BTC bought (net of any sold for repayment) |
| Gross position value | Total leveraged BTC × BTC price |
| Net equity (USD) | Gross position value − outstanding debt |
| Net equity (BTC) | Net equity ÷ BTC price (what the user actually owns after repaying debt) |

| Annual interest cost | Outstanding debt × borrow_APR |
| Annual platform fee | Collateral value × platform_fee_rate |
| Total annual cost | Interest + platform fee + (origination fee in year 1 only) |

| BTC price change ($) | Current price − prior year price |
| Appreciation on position | Total leveraged BTC (start of year) × price change |
| Excess return (USD) | Appreciation − Total annual cost |
| Excess return (BTC) | Excess return ÷ BTC price |

**Real-value columns (visible when "Show real values" is enabled in Tab 1):**

| Column | Description |
|--------|-------------|
| Real collateral value | Collateral value ÷ (1 + inflation)^t |
| Real outstanding debt | Outstanding debt ÷ (1 + inflation)^t |
| Debt erosion this year | Real debt (t−1) − Real debt (t) — the amount of debt "written off" by inflation |
| Real net equity (USD) | Net equity ÷ (1 + inflation)^t |
| Real excess return | Excess return ÷ (1 + inflation)^t |
| Real effective borrowing cost | Nominal APR − Inflation rate (approximate, for reference) |

| Effective LTV | Outstanding debt ÷ Collateral value |
| Margin call threshold | User's margin call LTV input (Ledn default: 70%) |
| Liquidation threshold | User's liquidation LTV input (Ledn default: 80%) |
| Safety buffer | Liquidation threshold − Effective LTV (percentage points) |
| Risk status | Green: buffer > safety margin. Amber: 0 < buffer ≤ safety margin OR effective LTV > margin call threshold. Red: effective LTV ≥ liquidation threshold. |
| Renewal risk | Flag: at year-end, if effective LTV exceeds margin call threshold, the loan may not be renewable without topping up collateral or repaying. |
| LTV suggestion | Model's recommended LTV for next year (see §6.3) |

### 6.3 Dynamic LTV Suggestion

Applied at year-end. Conservative — prioritizes survival over maximizing exposure.

| Price movement (YoY) | Suggestion |
|----------------------|------------|
| Rose >50% | Maintain current dollar debt (LTV drifts down). Do not borrow more. The windfall should strengthen the position, not expand risk. |
| Rose 10–50% | Maintain dollar debt. Modest gains don't warrant more leverage. |
| Flat (±10%) | Maintain dollar debt. |
| Fell 10–30% | Reduce dollar debt to return effective LTV to target. |
| Fell 30–50% | Aggressively deleverage: target LTV = max(current effective LTV − 10pp, 10%). |
| Fell >50% | Emergency: repay as much as possible. If effective LTV exceeds 56% (80% of the margin call threshold at 70%), the suggestion is "PAUSE — do not borrow; repay from reserve if possible." At 70% LTV the platform issues a margin call. At 80% LTV the position is liquidated. |

### 6.4 Liquidation

If effective LTV reaches or exceeds the liquidation threshold in any year:

- The position is marked **LIQUIDATED** for that year and all subsequent years
- The model records: year of liquidation, BTC lost (collateral seized), total income taken before failure, net gain/loss
- All subsequent rows show zero values with a note
- In the Summary tab, the scenario shows "Failed — Year X" instead of cumulative returns

This is the most important output. It tells the user whether their chosen LTV survives the worst drawdown in each scenario.

### 6.5 BTC-Denominated Borrowing (Alternative)

If the user selects "BTC" as borrow currency:
- Debt is denominated in BTC, not USD
- Borrow interest is paid in BTC
- LTV dynamics change: both collateral and debt move together with BTC price, so LTV is relatively stable
- Excess return formula changes: the debt appreciates in USD terms along with the collateral, reducing net gain
- The model adjusts all formulas accordingly and adds a warning that BTC-denominated borrowing typically carries higher APR and offers less natural deleveraging

---

## 7. Tab 4 — Income / Accumulation

This tab uses the excess return figures from Tab 3 and applies the chosen mode.

### 7.1 Accumulation Mode

All excess return is kept in the position. Each year:
- Excess return (BTC) is added to total leveraged BTC
- This additional BTC generates further appreciation in future years
- The position compounds: more BTC → more appreciation → more excess return → more BTC

| Column | Description |
|--------|-------------|
| Year | Calendar year |
| Excess return (BTC) | From Tab 3 |
| Cumulative BTC from excess return | Running total of excess return accumulated |
| Total leveraged BTC (end of year) | Starting leveraged BTC + BTC bought via rebalancing + excess return reinvested |
| Net BTC owned (after repaying all debt) | (Total leveraged BTC × BTC price − outstanding debt) ÷ BTC price |
| BTC accumulation multiple | Net BTC owned ÷ starting BTC holdings (e.g., 1.5x means the user effectively has 1.5× their original BTC after repaying debt) |
| Equivalent "passive hold" BTC | Starting BTC (what they'd have if they never leveraged — always = starting amount) |
| Cumulative outperformance (BTC) | Net BTC owned − starting BTC |

### 7.2 Income Mode

A portion of excess return is sold for USD and withdrawn. The remainder stays in the position.

| Column | Description |
|--------|-------------|
| Year | Calendar year |
| Excess return (USD) | From Tab 3 |
| Withdrawal rule applied | Fixed $X or Y% of excess |
| Income withdrawn (USD) | Amount taken out this year |
| BTC sold for income | Income withdrawn ÷ BTC price |
| Remaining excess (USD) | Excess return − income withdrawn |
| Remaining excess reinvested (BTC) | Remaining excess ÷ BTC price |
| Cumulative income withdrawn | Running total |
| Net BTC owned (after withdrawals + debt) | Position BTC − BTC sold for income − (debt ÷ BTC price) |
| Annual income as % of starting capital | Income ÷ (starting_BTC × starting_price) |
| Sustainable? | Flag: is the withdrawal rate below the position's net growth rate? If income > net position growth, the user is eating into capital. |

**Real-value columns (visible when "Show real values" is enabled in Tab 1):**

| Column | Description |
|--------|-------------|
| Real income withdrawn | Income withdrawn ÷ (1 + inflation)^t |
| Cumulative real income | Running total of inflation-adjusted income |
| Real net BTC owned | Net BTC owned with debt discounted by inflation (debt burden shrinks in real terms) |
| Real annual income as % of capital | Income in today's dollars ÷ starting capital in today's dollars |

### 7.3 Income Mode Constraints

- If excess return is **negative** in a year (BTC fell and interest costs exceeded any gains), income withdrawal is $0. You cannot withdraw income from a losing position without selling collateral — the model flags this but does not force it.
- If the user has set a fixed dollar withdrawal that exceeds excess return even in good years, the model shows a warning: "Withdrawal rate exceeds sustainable level — position will deplete over time."
- A **minimum equity floor** can be set: if net BTC would fall below this level, income is reduced rather than dipping below the floor.

---

## 8. Tab 5 — Summary

One table covering all three price scenarios and both modes.

| Metric | Acc-Pess | Acc-Med | Acc-Opt | Inc-Pess | Inc-Med | Inc-Opt |
|--------|----------|---------|---------|----------|---------|---------|
| Starting BTC | 2.0 | 2.0 | 2.0 | 2.0 | 2.0 | 2.0 |
| Starting net worth (USD) | | | | | | |
| Survived full 20 years? | | | | | | |
| Year of liquidation (if any) | | | | | | |
| Total income withdrawn | N/A | N/A | N/A | | | |
| Average annual income | N/A | N/A | N/A | | | |
| Net BTC owned at end (after debt) | | | | | | |
| vs. passive hold (BTC) | 2.0 | 2.0 | 2.0 | 2.0 | 2.0 | 2.0 |
| BTC accumulation multiple | | | | | | |
| Net worth at end (USD, after debt) | | | | | | |
| vs. passive hold (USD) | | | | | | |
| Worst effective LTV reached | | | | | | |
| Years in amber / red zone | | | | | | |
| Maximum debt carried | | | | | | |
| Total interest paid | | | | | | |
| Effective net CAGR on capital | | | | | | |

**Real-value rows (when inflation adjustment enabled):**

| Metric | Acc-Pess | Acc-Med | Acc-Opt | Inc-Pess | Inc-Med | Inc-Opt |
|--------|----------|---------|---------|----------|---------|---------|
| Real net worth at end (today's $) | | | | | | |
| Real total income (today's $) | N/A | N/A | N/A | | | |
| Real avg annual income (today's $) | N/A | N/A | N/A | | | |
| Cumulative debt erosion from inflation | | | | | | |
| Real effective borrow cost (APR − inflation) | | | | | | |

### 8.1 Key Charts

- **Price projection chart:** Three scenario lines with cyclical overlay visible
- **Net BTC accumulation chart:** Net BTC owned over time (both modes) vs. passive hold flat line
- **Income chart (income mode only):** Annual USD income per scenario
- **LTV risk chart:** Effective LTV over time vs. liquidation threshold and safety margin

---

## 9. Key Risks Modeled

| Risk | How Modeled |
|------|-------------|
| BTC price decline → liquidation | Effective LTV tracks against liquidation threshold every year. Price scenario with cyclical drawdowns tests worst-case. |
| Borrow rate exceeding BTC appreciation | Excess return goes negative in those years. In accumulation mode, this erodes prior gains. In income mode, income stops. |
| Compounding debt in multi-year bear | Interest accrues even when BTC is down. The model tracks cumulative interest and shows debt growth during drawdown periods. |
| Over-withdrawal in income mode | If withdrawal exceeds sustainable rate, the model flags it and shows position depletion. |

---

## 10. Risks NOT Modeled (User Must Consider)

- **Platform/smart-contract risk:** The borrowing platform could be hacked, become insolvent, or freeze withdrawals. If collateral is lost, the user loses the BTC and still technically owes the debt. Note: Ledn's custodied model (collateral never lent out, held 1:1 in segregated addresses) substantially reduces but does not eliminate this risk — regulatory action or a cybersecurity breach could still affect collateral access.
- **Stablecoin depeg risk:** If the borrowed stablecoin loses its dollar peg, the debt's real value changes unpredictably.
- **Regulatory risk:** Platforms may be shut down, geoblocked, or forced to freeze positions by regulators.
- **Oracle/manipulation risk:** The price feed used to determine LTV could be manipulated, triggering false liquidations.
- **Renewal risk:** Ledn loans are 12-month terms. If at renewal time the LTV exceeds the margin call threshold (70%), the platform may require additional collateral or partial repayment before renewing. The model flags this but does not simulate collateral top-ups from external reserves.
- **Tax implications:** Interest costs may or may not be deductible. Selling BTC for income (or to repay debt) is a taxable event in most jurisdictions. Not modeled.

**Mitigation suggestions** (not modeled, but noted in documentation):
- Split collateral across multiple platforms
- Keep a portion of BTC in cold storage (not all as collateral)
- Use platforms with insurance funds or established track records
- Monitor LTV actively rather than annually during volatile periods

---

## 11. What This Model Does NOT Do

- No tax calculations
- No comparison to conventional retirement strategies
- No Monte Carlo or stochastic simulation
- No BTC price prediction — scenario-based only
- No recursive/looping leverage (borrow → buy BTC → deposit as collateral → borrow more → repeat). Single layer of borrowing only for v1.
- No platform-specific rates or platform comparison

---

## 12. Future Enhancements (v2+)

- Monthly or quarterly granularity
- Recursive leverage looping
- Multiple LTV tiers (conservative core + aggressive satellite position)
- Profit-taking rules (e.g., "when BTC doubles, sell 25% of levered position gains into stablecoins and hold as dry powder")
- Variable borrow rates tied to market cycle
- Multi-platform allocation with risk scoring
- Tax-aware net income

---

## 13. Sources for Default Anchor Points and Platform Parameters

### Price Anchors

Based on institutional and algorithmic forecasts published 2024–2025:

- **ARK Invest:** $750K base / $1.5M optimistic by 2030
- **Standard Chartered:** $500K by 2030
- **Bernstein:** $200K near-term / $1M by 2033
- **Binance algorithmic model:** ~$91K by 2030
- **CoinCodex:** ~$166K by 2030
- **YouHodler:** $250K–$500K by 2030

These are third-party forecasts. The model does not endorse any of them. Replace with your own price outlook.

### Platform Parameters

Default borrowing parameters are calibrated to **Ledn** (ledn.io), a Bitcoin-backed lending platform operating since 2018 with over $10B in loan originations:

- **Initial LTV:** 50%
- **Margin call:** 70% LTV
- **Liquidation:** 80% LTV
- **Rate structure:** Tiered simple interest, 9.75%–11.49% APR depending on loan size
- **Loan term:** 12 months, renewable if LTV remains healthy
- **Origination fee:** None
- **Prepayment penalty:** None
- **Credit check:** None
- **Minimum loan:** $500 USD
- **Collateral model:** Custodied — BTC is held 1:1 in segregated addresses, never lent out for yield
- **Auto top-up:** Available to automatically add collateral when LTV approaches margin call
- **B2X product:** Ledn offers a "B2X" loan specifically designed to double Bitcoin exposure by using borrowed funds to purchase additional BTC — directly implementing the strategy modeled here

Users can adjust any of these defaults to reflect other platforms they use. The model is platform-agnostic.

---

## 14. Implementation Notes

- **Framework:** Google Sheets or Excel. All formulas use standard functions (POWER, COS, IF, SUM, etc.). No scripting or macros needed.
- **One source of truth:** Every numeric value outside Tab 1 is a formula referencing Tab 1 or a prior calculation. The only constants are mathematical (pi, 4-year cycle, etc.).
- **Conditional formatting:** LTV risk column (Tab 3) uses green/amber/red. Income sustainability column (Tab 4) uses a warning highlight.
- **Scenario selector:** Tab 3 and Tab 4 reference a single scenario at a time (dropdown in Tab 1). Tab 5 shows all scenarios simultaneously. Alternatively, Tab 3 and Tab 4 can duplicate columns for each scenario if screen real estate permits.
- **Charts:** Price projection (3 lines), net BTC accumulation (2 lines per scenario: levered vs. passive), annual income (3 bars per scenario).