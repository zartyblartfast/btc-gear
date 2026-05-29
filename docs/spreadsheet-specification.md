# Bitcoin Leveraged Accumulation & Income Model — Specification v3

## 1. Purpose

A spreadsheet model that projects outcomes when a Bitcoin holder uses their BTC as collateral to borrow and acquire *more* Bitcoin. The bet is simple: if Bitcoin's long-term price appreciation exceeds the cost of borrowing, the leveraged position builds equity faster than simply holding. That equity can be withdrawn as retirement income or kept in the position to accumulate more BTC via rebalancing.

This is **not** a lending-yield model. The user is the borrower, not the lender. There is no "lending APY" to earn — the profit comes from the spread between BTC's CAGR and the borrowing rate, applied to a larger BTC position than the user could otherwise hold.

## 2. The Core Strategy

### 2.1 Mechanics

```
Year 0 (setup):
  1. User deposits N BTC as collateral on a borrowing platform
  2. User borrows stablecoins worth N × BTC_price × LTV%
  3. User swaps borrowed stablecoins for BTC
  4. User now holds N (collateral) + borrowed_BTC (purchased), with debt = borrowed_stablecoins
     IMPORTANT: Only the original N BTC serves as collateral. Purchased BTC is held separately
     and does NOT increase the collateral pool. LTV = debt / (N × price).

Each subsequent year (deterministic cycle, in this order):
  1. BTC price updates from the price projection tab
  2. Collateral value recalculated: N × new_price
  3. Pre-interest LTV computed: debt / collateral_value
  4. Liquidation check: if LTV >= liquidation_threshold, position is liquidated (collateral seized)
  5. Margin call check: if LTV >= margin_call_threshold, position flagged (must top up to renew)
  6. Interest accrues: interest = debt × APR  (simple interest, added to debt)
  7. Rebalancing: per the rebalance rule, borrow more or repay debt
  8. Mode action (accumulation or income — see §2.4)
     - Accumulation: no BTC is sold for income
     - Income: sell purchased/non-collateral BTC only, capped by available purchased BTC
  9. End-of-year state: ending BTC, debt, equity, LTV
     Next year's starting BTC equals this year's ending BTC after any income sale.
```

### 2.2 Where the Return Comes From — Two Separate Concepts

The strategy generates value through two DISTINCT mechanisms. They are often conflated but must
be kept separate.

**Concept A: Equity Gain (USD)**

The user's net worth increases when BTC appreciates faster than borrowing costs erode it.
This is mark-to-market — it changes USD equity but does NOT create new BTC.

| Component | Formula | Nature |
|-----------|---------|--------|
| Starting net worth (USD) | N × initial_price | |
| Gross position value | total_BTC_held × current_price | Mark-to-market |
| Outstanding debt | accumulated borrowings + accrued interest | Fixed in USD |
| **Net equity (USD)** | Gross position value − debt | Mark-to-market |
| Annual interest cost | debt × APR | Cash cost, added to debt |
| **Equity gain (USD)** | net_equity(t) − net_equity(t−1) | Change in mark-to-market wealth |

Equity gain can be positive (BTC rose faster than interest costs) or negative (BTC fell or
interest outpaced appreciation). It is NOT a cashflow — you cannot spend it directly, and
you cannot use it to buy more BTC without borrowing or selling.

**Concept B: BTC Accumulated (BTC)**

The user acquires additional BTC by borrowing more against appreciated collateral. This is
the ONLY way BTC quantity increases in the model (aside from the initial purchase at year 0).

| Component | Formula |
|-----------|---------|
| Initial borrowed BTC | (N × initial_price × LTV) / initial_price | One-time at setup |
| Additional BTC from rebalancing | new_borrowing / current_price | Each year, if collateral rose |
| **Total BTC accumulated** | initial_borrowed_BTC + sum of rebalancing_BTC | Cumulative |

When BTC rises and LTV improves, the rebalancing rule may borrow additional stablecoins to
restore the target LTV. Those stablecoins buy more BTC. In accumulation mode, this is the
compound-growth engine — more BTC → more appreciation → lower LTV → borrow more → more BTC.

**The key insight:** BTC quantity grows from REBALANCING, not from appreciation. Appreciation
creates the *capacity* to borrow more (by lowering LTV), but the actual BTC acquisition
requires taking on additional debt.

### 2.3 Why Borrow Stablecoins (Not BTC)

The model assumes borrowing **stablecoins** (USDC, USDT) and swapping for BTC. Reason: the debt
is fixed in USD terms while the collateral is in BTC. When BTC price rises, the collateral
grows but the debt stays the same — LTV improves naturally and the user gains equity AND
borrowing capacity. When BTC price falls, LTV worsens and liquidation risk increases.

If the user borrowed BTC directly, both collateral and debt would rise together in USD terms —
no natural deleveraging from price appreciation, and the debt itself appreciates, erasing
the benefit of leverage. Stablecoin borrowing is also the standard product across platforms
(Aave, Compound, Morpho, centralized lenders including Ledn).

BTC-denominated borrowing is out of scope for v1.

#### Inflation Tailwind

Borrowing stablecoins carries an additional advantage: **fiat inflation erodes the real value
of the debt over time.** A $52,500 loan today is worth about $29,000 in purchasing power after
20 years at 3% annual inflation — even before making a single payment. Meanwhile, BTC is a
hard asset whose price should, over long timeframes, reflect monetary debasement.

```
Real borrow cost ≈ Nominal APR − Inflation rate
```

At 11.49% nominal APR with 3% inflation, the real cost is roughly 8.5%. The spread between
BTC's real appreciation and this real borrowing cost is the true economic return.

The model optionally displays real (inflation-adjusted) values alongside nominal figures.
When enabled, all USD-denominated values are discounted by the user's inflation assumption
so they reflect constant purchasing power. BTC values are NOT inflation-adjusted — BTC is
a hard asset, not a fiat purchasing-power claim.

### 2.4 Two Modes

The user chooses one mode in the Inputs tab:

**Accumulation Mode:** The user never takes income. Each year, when BTC rises and LTV improves,
the rebalancing rule borrows more stablecoins (up to the target LTV) and uses them to buy
additional BTC. This compounds the leveraged position: more BTC → more appreciation → lower
LTV → borrow more → more BTC. Over time, total BTC held grows beyond what a passive holder
would own. No USD is ever withdrawn.

**Income Mode:** Each year, after interest accrues and rebalancing, the user withdraws a
portion of the leveraged position's gains. Mechanically, this means selling some BTC for
stablecoins and withdrawing those stablecoins. The user specifies either a fixed dollar
amount or a percentage of that year's equity gain. The remaining value stays in the
position. If equity gain is negative (BTC fell), income is $0 for that year — the user
cannot withdraw from a shrinking position without selling original collateral, which is
out of scope for v1.

**Income sale rules (order of which BTC is sold):**
1. **Sell purchased BTC first.** BTC acquired through borrowing and rebalancing is sold
   before any original collateral is touched.
2. **Do not sell original collateral BTC in v1.** Original collateral BTC is reserved
   for maintaining the borrowing position and is only lost by the model during liquidation.
   Selling original collateral for income is a future enhancement because it changes the
   LTV denominator and requires additional collateral-management rules.
3. **Cap income to available purchased BTC.** If the requested income withdrawal would
   require selling more BTC than the user holds outside collateral, income is capped at
   the USD value of available purchased BTC, and a warning is shown: "Income capped —
   insufficient non-collateral BTC."
4. **Feed the sale back into future years.** BTC sold for income reduces ending BTC for
   the year. The next year's starting BTC uses this post-income balance. Income withdrawal
   does not repay debt unless a separate repayment action is specified by the rebalance rule.
5. **Cumulative tracking.** The model tracks cumulative BTC sold for income and cumulative
   purchased BTC. In v1, cumulative BTC sold for income must never exceed cumulative
   purchased BTC; the cap in rule 3 enforces this.

In both modes, the underlying mechanism is the same: borrow against BTC, buy more BTC, let
appreciation do the work. The mode only determines what happens to the gains at year-end.

### 2.5 Numerical Example (Standard Profile, 35% LTV)

| | Year 0 (setup) | Year 1 (BTC +40%) |
|---|---|---|
| BTC price | $75,000 | $105,000 |
| Collateral BTC (only original) | 2.0 | 2.0 |
| Collateral value | $150,000 | $210,000 |
| LTV target | 35% | 35% |
| **Borrowing** | | |
| Initial debt (year 0) | $52,500 | — |
| Interest accrued (11.49%) | — | $52,500 × 11.49% = $6,032.25 |
| Debt after interest | — | $58,532.25 |
| Pre-rebalance LTV | — | $58,532.25 / $210,000 = 27.87% |
| New borrowing to restore 35% LTV | — | $210,000 × 0.35 − $58,532.25 = $14,967.75 |
| Year-end debt | $52,500 | $73,500 |
| **BTC position** | | |
| BTC bought at setup | 0.700000 | — |
| BTC bought from rebalancing | — | $14,967.75 / $105,000 = 0.142550 |
| Total leveraged BTC | 2.700000 | 2.842550 |
| **Wealth** | | |
| Gross position value | $202,500 | $298,467.75 |
| Net equity (USD) | $150,000 | $224,967.75 |
| Equity gain (USD) | — | $74,967.75 |
| **Passive hold comparison** | | |
| Passive hold BTC | 2.00 | 2.00 |
| Passive hold value | $150,000 | $210,000 |
| Passive gain | — | $60,000 |
| **Leverage benefit** | | $74,967.75 − $60,000 = $14,967.75 |

Key observations:
- BTC grew from 2.700000 to 2.842550 — the growth came from REBALANCING ($14,967.75 new borrowing →
  0.142550 BTC), not from appreciation
- The $74,967.75 equity gain is mark-to-market wealth, not spendable cash. In accumulation mode
  it stays in the position. In income mode, a portion can be withdrawn by selling BTC.
- The leverage added $14,967.75 beyond passive holding — the spread between appreciation on
  the borrowed 0.70 BTC ($21,000) and the interest cost ($6,032.25)
- After rebalancing, LTV returns to exactly 35% ($73,500 / $210,000)
- If BTC had fallen, LTV would have risen, and the rebalancing rule might require repaying
  debt (selling BTC) to avoid approaching the margin call threshold

---

## 3. Spreadsheet Structure

| Tab | Name | Purpose |
|-----|------|---------|
| 1 | **Inputs** | All user-configurable parameters |
| 2 | **Price Projection** | Three BTC price scenarios (20 years) |
| 3 | **Leveraged Position** | Year-by-year: position value, debt lifecycle, equity gain, LTV, liquidation risk |
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
| LTV target | Target loan-to-value ratio. App default: 35% (Standard risk profile). Ledn offers up to 50% initial LTV, available via the Aggressive preset. | 35% | % |
| Borrow APR | Annual interest rate on borrowed funds. Ledn tiered rates: 11.49% (loans <$250K), 10.49% ($250K+), 9.99% ($500K+), 9.75% ($1M+). Simple interest, not compounding. | 11.49% | % |
| Origination fee | One-time fee on initial loan. Ledn charges none. | 0.0% | % |
| Annual platform fee | Ongoing custody or management fee. Ledn charges none. | 0.0% | % |
| Borrow currency | "Stablecoins/USD" (fixed in v1 — BTC-denominated borrowing out of scope) | Stablecoins/USD | fixed |
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
| Withdrawal rule | "Fixed $" (withdraw fixed USD/year) or "% of equity gain" | % of equity gain | toggle |
| Withdrawal amount | Fixed dollar amount (if fixed $) or % of equity gain (if %) | 50% | USD or % |

### 4.4 Rebalancing Behavior

| Input | Description | Default | Unit |
|-------|-------------|---------|------|
| Rebalance rule | How to adjust borrowing each year | Maintain target LTV | choice |

Options for rebalancing:
- **Maintain target LTV:** Each year, adjust the borrowed amount up or down to return to the target LTV after interest accrues. When BTC rises, borrow more. When BTC falls, repay debt to avoid liquidation.
- **Never increase debt:** Borrow only at year 0. Do not borrow additional stablecoins after setup. Let LTV drift down as BTC rises. Repay only if end-of-year effective LTV would exceed the safety trigger defined in §6.3.
- **Dynamic (follow model suggestions):** Use the deterministic target-debt rules in §6.3 based on year-over-year price movement.

**Repayment source rule for v1:** any repayment required by a rebalance rule sells purchased/non-collateral BTC first. Original collateral BTC is not sold for repayment in v1. If available purchased BTC is insufficient to fund the required repayment, the repayment is capped at the USD value of available purchased BTC, the row is flagged `REPAYMENT CAPPED`, and the remaining shortfall is shown as an external top-up requirement. This avoids circular LTV math from shrinking the collateral denominator.

**Fee handling for v1:** defaults are zero. If nonzero fees are entered, origination fee and annual platform fee are treated as external cash costs for reporting only: they increase `totalAnnualCost` and reduce diagnostic/equity-return metrics, but they are not added to debt and do not force BTC sales. A future version may model fee financing explicitly.

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

**Two-phase compound growth with a normalized 4-year cyclical overlay.**

Phase 1 (Years 0–5): Compound at the rate needed to hit the user's 2030 anchor on the trend line.

Phase 2 (Years 5–20): Compound at a reduced rate (Phase 1 × decay factor), reflecting market maturation.

A dampened cosine wave overlays the trend to model Bitcoin's ~4-year halving cycle. The
wave is **normalized** so that year 0 always equals the current price — the cycle multiplier
at t=0 is exactly 1.0. This preserves the cycle's shape (peaks and troughs in the right
years) while anchoring the starting point.

**Important: Anchor vs displayed price.** The 2030 anchor applies to the **trend line**, not
the final cycle-adjusted price. At year 5, the trend line exactly equals the anchor, but the
displayed price will differ due to the cycle overlay. For example, a $500K median anchor
produces Trend(5) = $500K, but Price(5) is ~$373K under the default amplitude decay.
The anchor represents the user's long-term conviction about where the trend sits; the cycle
overlay adds realistic short-term variation around that trend.

### 5.2 Calculation Steps (per scenario)

**Step 1 — Phase 1 CAGR (calibrated to hit 2030 anchor on the trend line):**
```
CAGR1 = (Anchor_2030 / Current_Price)^(1/5) − 1
```

**Step 2 — Phase 2 CAGR (post-2030, diminished returns):**
```
CAGR2 = CAGR1 × Growth_Decay
```

**Step 3 — Trend price at year t:**
```
If t ≤ 5:  Trend(t) = Current_Price × (1 + CAGR1)^t
If t > 5:  Trend(t) = Anchor_2030 × (1 + CAGR2)^(t−5)
```
Trend(5) = Anchor_2030 exactly (by construction).

**Step 4 — Normalized cyclical overlay:**

The raw cycle uses a cosine with 4-year period. Without normalization, t=0 produces
multiplier = 1 + amplitude (e.g., 1.4), incorrectly inflating the starting price.
We normalize by dividing through by the t=0 value:

```
cycle_number = floor(t / 4)
effective_amplitude = Base_Amplitude × (1 − Amplitude_Decay)^cycle_number
Raw_Multiplier(t) = 1 + effective_amplitude × cos(2π × t / 4)
Cycle_Multiplier(t) = Raw_Multiplier(t) / (1 + effective_amplitude)
```

At t=0: Raw_Multiplier = 1 + amp → Cycle_Multiplier = 1.0 (preserves current price).
At t=2: cos(π) = −1 → Raw = 1 − amp → Cycle ≈ (1−amp)/(1+amp) (trough).
At t=4: cos(2π) = 1 → Raw = 1 + amp → Cycle returns to 1.0.

The cosine wave naturally produces peaks at t=0,4,8,... and troughs at t=2,6,10,...
aligning with Bitcoin's historical rhythm where halving+1 years (2025, 2029) tend to be
strong and halving+2 years (2027, 2031) tend to correct.

**Step 5 — Final price:**
```
Price(t) = Trend(t) × Cycle_Multiplier(t)
```
Floor at $1. If the cycle multiplier would push Price(t) below $1, clamp to $1.

### 5.3 Output Format

| Year | Pess Trend | Pess Price | Med Trend | Med Price | Opt Trend | Opt Price | YoY Change (Med) |
|------|-----------|-----------|----------|----------|----------|----------|-------------------|
| 2025 | $75,000 | $75,000 | $75,000 | $75,000 | $75,000 | $75,000 | — |
| 2026 | ... | ... | ... | ... | ... | ... | ... |

### 5.4 Example Calibration

With defaults: Current $75,000, Median anchor $500,000, Growth decay 30%, Amplitude 40%.

- Phase 1 CAGR: (500K/75K)^0.2 − 1 ≈ 46.1%
- Phase 2 CAGR: 46.1% × 30% ≈ 13.8%
- 2045 trend: 500K × 1.138^15 ≈ $3.46M

**Cycle-adjusted prices at key years (median scenario, with amplitude decay applied):**

| Year | t | Cycle # | Eff. Amp | Raw Mult | Cycle Mult | Trend | Displayed Price |
|------|---|---------|----------|----------|------------|-------|-----------------|
| 2025 | 0 | 0 | 0.40 | 1.40 | 1.000 | $75K | $75K |
| 2026 | 1 | 0 | 0.40 | 1.00 | 0.714 | $110K | $78K |
| 2027 | 2 | 0 | 0.40 | 0.60 | 0.429 | $160K | $69K |
| 2028 | 3 | 0 | 0.40 | 1.00 | 0.714 | $234K | $167K |
| 2029 | 4 | 1 | 0.34 | 1.34 | 1.000 | $342K | $342K |
| 2030 | 5 | 1 | 0.34 | 1.00 | 0.746 | $500K | $373K |

Note: Amplitude decay applies per cycle (floor(t/4)). At t=4 (2029), the effective amplitude
drops to 0.40 × 0.85 = 0.34, changing the raw multiplier from 1.40 to 1.34. At t=5 (2030),
the normalized cycle multiplier becomes 1/1.34 = 0.746, making the displayed price $373K.
Trend(5) still hits $500K exactly; the cycle overlay only affects the displayed price.

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

The deterministic cycle follows §2.1 exactly. Each year executes in this order:

```
1. BTC price updates from Tab 2
2. Collateral value recalculated: collateral_BTC × new_price
3. Pre-interest LTV computed: debtStart / collateral_value
4. Liquidation check: if pre-interest LTV ≥ liquidation_threshold, position is
   liquidated — collateral seized, all subsequent rows marked LIQUIDATED
5. Renewal/margin call check: if pre-interest LTV ≥ margin_call_threshold, flag
   renewal risk — platform may require collateral top-up to renew
6. Interest accrues: annualInterest = debtStart × APR (simple interest).
   debtAfterInterest = debtStart + annualInterest.
7. Rebalancing: per the selected rebalance rule (§6.3).
   - Each rule first computes targetDebt and requiredRepaymentUsd
   - If borrowing: rebalanceBorrowingUsd = MAX(0, targetDebt − debtAfterInterest)
   - If repaying: rebalanceRepaymentUsd = MIN(requiredRepaymentUsd, availableRepayment)
   - externalTopUpRequired = MAX(0, requiredRepaymentUsd − availableRepayment)
8. End-of-year debt: debtEnd = debtAfterInterest + rebalanceBorrowingUsd − rebalanceRepaymentUsd
9. BTC position update before income:
   - btcBoughtFromRebalancing = rebalanceBorrowingUsd / btcPrice
   - btcSoldForRepayment = rebalanceRepaymentUsd / btcPrice
   - totalLeveragedBtcBeforeIncome = priorEndingBtc + btcBoughtFromRebalancing − btcSoldForRepayment
10. Mode action (accumulation or income — feeds Tab 4):
    - grossPositionValueBeforeIncome = totalLeveragedBtcBeforeIncome × btcPrice
    - netEquityUsdBeforeIncome = grossPositionValueBeforeIncome − debtEnd
    - equityGainUsd = netEquityUsdBeforeIncome − priorNetEquityUsdEnd
    - requestedIncome = 0 if equityGainUsd ≤ 0; otherwise fixed amount or equityGainUsd × withdrawal%
    - Accumulation: btcSoldForIncome = 0
    - Income: btcSoldForIncome = MIN(requestedIncome / btcPrice, purchasedBtcAvailableBeforeIncome)
    - totalLeveragedBtcEnd = totalLeveragedBtcBeforeIncome − btcSoldForIncome
11. End-of-year metrics: effectiveLtvEnd = debtEnd / collateralValue.
    Next year's debtStart = this year's debtEnd.
    Next year's priorEndingBtc = this year's totalLeveragedBtcEnd.
    Next year's priorNetEquityUsdEnd = this year's netEquityUsdEnd.
    Risk status determined from effectiveLtvEnd.
```

Key design decisions encoded in this order:
- **Interest accrues before rebalancing.** This means rebalancing accounts for accrued
  interest when computing how much additional borrowing is needed to restore target LTV.
- **Liquidation is checked before interest.** A position that is borderline may survive
  if interest hasn't been added yet, but this is conservative — it avoids a false
  liquidation trigger from interest alone.
- **Repayment and borrowing are separate non-negative fields.** A year either borrows
  or repays, never both. This avoids negative-quantity ambiguities in BTC tracking.

### 6.2 Column Definitions

Each column maps to one field in the annual cycle. Fields are shown in cycle order.

| Column | Field | Formula |
|--------|-------|---------|
| Year | — | Calendar year |
| BTC price | btcPrice | From Tab 2 |
| Collateral BTC | collateralBtc | Original holdings. Constant in v1 unless liquidation occurs. |
| Collateral value (USD) | collateralValue | collateralBtc × btcPrice |
| Target LTV | targetLtv | User's chosen LTV |
| **Debt lifecycle** | | |
| Debt start-of-year | debtStart | Prior year's debtEnd (year 0: collateralValue × LTV) |
| Pre-interest LTV | preInterestLtv | debtStart / collateralValue |
| Annual interest | annualInterest | debtStart × APR ($0 in year 0) |
| Debt after interest | debtAfterInterest | debtStart + annualInterest |
| Target debt | targetDebt | Desired debt after rebalancing, from the selected rule in §6.3. |
| Required repayment (USD) | requiredRepaymentUsd | MAX(0, debtAfterInterest − targetDebt). Before v1 cap is applied. |
| Rebalance borrowing (USD) | rebalanceBorrowingUsd | MAX(0, targetDebt − debtAfterInterest). Always ≥ 0. |
| Rebalance repayment (USD) | rebalanceRepaymentUsd | Required repayment from rebalance rule, capped to available purchased BTC × btcPrice in v1. Always ≥ 0. |
| Repayment capped? | repaymentCapped | TRUE if requiredRepaymentUsd > available purchased BTC × btcPrice. |
| External top-up required | externalTopUpRequired | requiredRepaymentUsd − rebalanceRepaymentUsd. Report-only; not assumed to be paid. |
| Debt end-of-year | debtEnd | debtAfterInterest + rebalanceBorrowingUsd − rebalanceRepaymentUsd |
| **BTC position** | | |
| BTC bought (rebalancing) | btcBoughtFromRebalancing | rebalanceBorrowingUsd / btcPrice. Always ≥ 0. |
| BTC sold (repayment) | btcSoldForRepayment | rebalanceRepaymentUsd / btcPrice. Always ≥ 0. |
| Total leveraged BTC before income | totalLeveragedBtcBeforeIncome | Prior ending BTC + btcBoughtFromRebalancing − btcSoldForRepayment (year 0: collateralBtc + initial_borrowed_BTC) |
| Gross value before income | grossPositionValueBeforeIncome | totalLeveragedBtcBeforeIncome × btcPrice. Used to compute equity gain and requested income. |
| Net equity before income | netEquityUsdBeforeIncome | grossPositionValueBeforeIncome − debtEnd. Used to compute equity gain and requested income. |
| Equity gain (USD) | equityGainUsd | netEquityUsdBeforeIncome − priorNetEquityUsdEnd. If negative, requested income is $0. |
| BTC sold for income | btcSoldForIncome | From §7.2. Zero in accumulation mode. Capped to purchased BTC available. |
| Total leveraged BTC end | totalLeveragedBtcEnd | totalLeveragedBtcBeforeIncome − btcSoldForIncome. This becomes next year's prior ending BTC. |
| Gross position value end | grossPositionValueEnd | totalLeveragedBtcEnd × btcPrice |
| Net equity end (USD) | netEquityUsdEnd | grossPositionValueEnd − debtEnd. This becomes next year's priorNetEquityUsdEnd. |
| Net equity end (BTC) | netEquityBtcEnd | netEquityUsdEnd / btcPrice |
| **Costs** | | |
| Annual platform fee | annualFee | collateralValue × annualPlatformFee. External cash cost in v1; not added to debt. |
| Total annual cost | totalAnnualCost | annualInterest + annualFee (+ origination fee in year 0 only) |
| **Diagnostics** | | |
| Price change ($) | priceChange | btcPrice − prior year btcPrice |
| Mark-to-market return | markToMarketReturnUsd | priorEndingBtc × priceChange − totalAnnualCost. Diagnostic only — NOT used for income or accumulation decisions. |
| **Risk** | | |
| Effective LTV (end of year) | effectiveLtvEnd | debtEnd / collateralValue |
| Margin call threshold | marginCallThreshold | From Inputs |
| Liquidation threshold | liquidationThreshold | From Inputs |
| Safety buffer | safetyBuffer | liquidationThreshold − effectiveLtvEnd (percentage points) |
| Risk status | riskStatus | SAFE / WARNING / MARGIN CALL / LIQUIDATED (based on effectiveLtvEnd) |
| Renewal risk | renewalRisk | TRUE if preInterestLtv ≥ marginCallThreshold at the annual renewal check. |
| Suggested LTV | suggestedLtv | Model's recommendation for next year (§6.3) |

### 6.3 Rebalance Rule Formulas

All rebalance rules operate after interest accrues and before income withdrawal. Define:

```
maintainTargetDebt = collateralValue × targetLtv
safetyTriggerLtv   = marginCallThreshold − safetyMargin
safetyTargetDebt   = collateralValue × targetLtv
availableRepayment = purchasedBtcAvailableBeforeRepayment × btcPrice
```

`purchasedBtcAvailableBeforeRepayment` equals cumulative BTC bought through the initial
borrow and prior rebalancing, minus prior income sales and prior repayment sales. It excludes
original collateral BTC.

After repayment, the income cap uses:

```
purchasedBtcAvailableBeforeIncome = purchasedBtcAvailableBeforeRepayment
                                    + btcBoughtFromRebalancing
                                    − btcSoldForRepayment
```

After income, the carried-forward balance is:

```
purchasedBtcAvailableEnd = purchasedBtcAvailableBeforeIncome − btcSoldForIncome
```

Repayments are capped in v1:

```
rebalanceRepaymentUsd = MIN(requiredRepaymentUsd, availableRepayment)
externalTopUpRequired = MAX(0, requiredRepaymentUsd − availableRepayment)
```

#### Maintain target LTV

```
targetDebt = maintainTargetDebt
rebalanceBorrowingUsd = MAX(0, targetDebt − debtAfterInterest)
requiredRepaymentUsd  = MAX(0, debtAfterInterest − targetDebt)
```

#### Never increase debt

Borrow only in year 0. After setup:

```
rebalanceBorrowingUsd = 0
if debtAfterInterest / collateralValue <= safetyTriggerLtv:
    requiredRepaymentUsd = 0
else:
    requiredRepaymentUsd = MAX(0, debtAfterInterest − safetyTargetDebt)
```

This lets LTV drift lower in bull markets but deleverages if the position approaches the
margin-call zone. With defaults, `safetyTriggerLtv = 70% − 10pp = 60%`.

#### Dynamic

Dynamic is deterministic; it converts the year-over-year BTC price move into a target debt:

| Price movement (YoY) | Target debt rule |
|----------------------|------------------|
| Rose >50% | `targetDebt = debtAfterInterest` (no new borrowing; let LTV improve) |
| Rose 10–50% | `targetDebt = debtAfterInterest` |
| Flat (±10%) | `targetDebt = debtAfterInterest` |
| Fell 10–30% | `targetDebt = maintainTargetDebt` |
| Fell 30–50% | `targetLtvDynamic = MAX(preInterestLtv − 0.10, 0.10)`; `targetDebt = collateralValue × targetLtvDynamic` |
| Fell >50% | `targetDebt = 0`; repayment is capped to available purchased BTC and any shortfall is flagged as external top-up required |

Then:

```
rebalanceBorrowingUsd = MAX(0, targetDebt − debtAfterInterest)
requiredRepaymentUsd  = MAX(0, debtAfterInterest − targetDebt)
```

The displayed `suggestedLtv` is `targetDebt / collateralValue`. Dynamic mode never sells
original collateral in v1; if purchased BTC cannot fund a required repayment, the model flags
that external reserves would be needed to fully follow the suggestion.

### 6.4 Liquidation

If pre-interest LTV reaches or exceeds the liquidation threshold at the liquidation check step (§6.1 step 4):

- The position is marked **LIQUIDATED** for that year and all subsequent years
- The model records: year of liquidation, BTC lost (collateral seized), total income taken before failure, net gain/loss
- All subsequent rows show zero values with a note
- In the Summary tab, the scenario shows "Failed — Year X" instead of cumulative returns

This is the most important output. It tells the user whether their chosen LTV survives the worst drawdown in each scenario.

---

## 7. Tab 4 — Income / Accumulation

This tab uses the position data from Tab 3 and applies the chosen mode. In income mode, the sale of BTC is not merely a display calculation: it reduces `totalLeveragedBtcEnd`, and that post-income BTC balance feeds the next year's Tab 3 starting position.

### 7.1 Accumulation Mode

In accumulation mode, all value stays in the position. BTC quantity grows through rebalancing:
each year, if BTC rose and LTV improved, the rebalance rule borrows more stablecoins (up to
target LTV) and uses them to buy additional BTC. No USD is ever withdrawn. Equity gain is
mark-to-market only — the user's net worth increases on paper but no cash is realized.

| Column | Description |
|--------|-------------|
| Year | Calendar year |
| Starting total BTC | Total leveraged BTC from prior year-end |
| Rebalance borrowing | New stablecoins borrowed this year (from Tab 3) |
| BTC bought from rebalancing | Rebalance borrowing ÷ current BTC price |
| Total leveraged BTC (end of year) | Starting BTC + BTC bought from rebalancing − BTC sold for repayment. No income sale in accumulation mode. |
| Net BTC owned (after repaying all debt) | (Total BTC × price − debt) ÷ price |
| BTC accumulation multiple | Net BTC owned ÷ starting BTC holdings |
| Passive hold BTC | Starting BTC (constant) |
| Cumulative BTC outperformance | Net BTC owned − starting BTC |
| Equity gain (USD) | Net equity(t) − net equity(t−1) — mark-to-market |

### 7.2 Income Mode

In income mode, after interest accrues and rebalancing, the user sells a portion of the
position's BTC for stablecoins and withdraws them as income. The user specifies either a
fixed dollar amount or a percentage of that year's equity gain. The remaining value stays
in the position.

| Column | Description |
|--------|-------------|
| Year | Calendar year |
| Equity gain (USD) | From Tab 3 — mark-to-market wealth change |
| Withdrawal rule applied | Fixed $X or Y% of equity gain |
| Income withdrawn (USD) | Amount taken out this year. $0 if equity gain is negative. |
| BTC sold for income | Income withdrawn ÷ BTC price |
| Remaining equity (USD) | Equity gain − income withdrawn (retained in position) |
| Total BTC after withdrawal | Position BTC before income − BTC sold for income. This is the next year's starting BTC. |
| Cumulative income withdrawn | Running total |
| Net BTC owned (after withdrawals + debt) | Total BTC − (debt ÷ BTC price) |
| Annual income as % of starting capital | Income ÷ (starting_BTC × starting_price) |
| Sustainable? | Flag: if income > 0 and equity gain was positive → SUSTAINABLE. If income > equity gain → DRAINING CAPITAL. If equity gain negative → NO INCOME (BTC fell). |

**Real-value columns (visible when "Show real values" is enabled in Tab 1):**

| Column | Description |
|--------|-------------|
| Real income withdrawn | Income withdrawn ÷ (1 + inflation)^t |
| Cumulative real income | Running total of inflation-adjusted income |
| Real debt burden | Outstanding debt ÷ (1 + inflation)^t — shows inflation erosion |
| Real annual income as % of capital | Income in today's dollars ÷ starting capital in today's dollars |

### 7.3 Income Mode Constraints

- If equity gain is **negative** in a year (BTC fell and interest exceeded any appreciation),
  income withdrawal is $0. The user cannot withdraw from a shrinking position without selling
  original collateral, which is out of scope for v1.
- Income is capped to purchased/non-collateral BTC available. If requested income exceeds
  that cap, the model withdraws the capped amount and sets the income-capped warning.
- If the user has set a fixed dollar withdrawal that exceeds the typical equity gain in good
  years, the model shows a warning: "Withdrawal rate exceeds sustainable level — position
  will deplete over time."
- The model does NOT include a minimum equity floor. The user can adjust their withdrawal
  amount downward to preserve capital.

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
| Borrow rate exceeding BTC appreciation | Equity gain goes negative in those years. In accumulation mode, this erodes prior paper gains. In income mode, income stops ($0 for the year). |
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

---

## 15. Validation Rules

All inputs must pass validation before the model computes. The following rules apply:

| Field | Rule |
|-------|------|
| BTC Holdings | > 0 |
| Current BTC Price | > 0 |
| LTV Target | 0 ≤ LTV ≤ 0.50 (Ledn max). Must be < margin_call_LTV < liquidation_LTV |
| Borrow APR | ≥ 0 |
| Origination Fee | 0 ≤ fee ≤ 0.05 |
| Annual Platform Fee | 0 ≤ fee ≤ 0.05 |
| Margin Call LTV | 0 < margin_call_LTV < liquidation_LTV ≤ 1.0 |
| Liquidation LTV | margin_call_LTV < liquidation_LTV ≤ 1.0 |
| Safety Margin | ≥ 0 and < (liquidation_LTV − LTV) |
| Mode | Must be "Accumulation" or "Income" |
| Withdrawal Rule | Must be "Fixed $" or "% of equity gain" |
| Withdrawal Amount | ≥ 0 |
| Rebalance Rule | Must be "Maintain LTV", "Never Increase", or "Dynamic" |
| Anchor prices (all 3) | > 0 |
| Growth Decay | 0 ≤ decay ≤ 1.0 |
| Cycle Amplitude | 0 ≤ amp < 1.0 so multiplier never reaches 0 |
| Amplitude Decay | 0 ≤ decay ≤ 1.0 |
| Start Year | Integer ≥ 2009 |
| Projection Length | Integer 1–50 |
| Inflation Rate | −0.10 ≤ rate ≤ 0.20 (allows deflation) |
| Show Real Values | Must be "Yes" or "No" |

Imported JSON must reject NaN, Infinity, null, strings in numeric fields, and missing required keys.

## 16. Precision and Rounding Policy

- **Internal calculations:** Full JavaScript/Excel floating-point precision. No intermediate rounding.
- **Displayed USD values:** Nearest dollar (`$#,##0`)
- **Displayed BTC values:** 8 decimal places (`0.00000000`)
- **Displayed percentages:** 1 decimal place for LTV, APR, rates (`0.0%`). 2 decimal places for safety buffer.
- **Displayed multiples:** 2 decimal places (`0.00x`)
- **Test tolerances:** Golden tests use absolute tolerance of $1 for USD values and 0.000001 for BTC values. CAGR calibration tests use $1 tolerance on the 2030 anchor.

## 17. Golden Test Fixtures

Before engine development begins, the following minimum fixture set must exist. Each fixture
is a JSON file containing `{ config: Config, expectedOutput: {...} }` validated against the
reference spreadsheet.

| Fixture | What it validates |
|---------|-------------------|
| `default-config.json` | Canonical default Config object |
| `price-path-median.json` | Full 21-year median price path matches spreadsheet |
| `year1-standard-ltv.json` | Single-year position at 35% LTV, 40% price rise |
| `year1-income-mode.json` | Income mode withdrawal at 50% of equity gain |
| `income-feedback.json` | BTC sold for income reduces the next year's starting BTC |
| `year1-accumulation-mode.json` | Accumulation mode: no withdrawal, BTC from rebalancing |
| `liquidation-case.json` | Price path that triggers liquidation at year 3 |
| `rebalance-maintain.json` | Maintain LTV rebalancing over 3 years |
| `rebalance-never-increase.json` | Never-increase rule over 3 years |
| `repayment-cap.json` | Repayment sells purchased BTC only and flags external top-up if capped |
| `inflation-adjusted.json` | Real values match nominal / (1+inflation)^t |

## 18. LTV Default Rationale

The spreadsheet default LTV is 35% (the "Standard" risk profile), not Ledn's maximum 50%.
Rationale: the app's purpose is conservative retirement planning, not maximum leverage.
The Standard profile balances meaningful return amplification with a margin call buffer
that requires a 50% BTC drop — severe but survivable with active management. Users can
increase LTV to 50% (Aggressive) but the default errs on the side of safety.

## 19. Disclaimers

The spreadsheet and web application must display or include:

- This tool is for **educational purposes only**. It does not constitute financial advice,
  investment recommendations, or tax advice.
- All projections are based on **user-provided assumptions** about future BTC prices and
  borrowing rates. Actual results will differ, possibly substantially.
- **Leveraged BTC positions carry risk of total loss** through liquidation. The model
  illustrates liquidation scenarios but cannot predict market behavior.
- **Past BTC price cycles do not guarantee future patterns.** The cyclical overlay is a
  modeling convenience, not a prediction.
- **Platform risk is not modeled.** Counterparty failure, smart contract exploits, and
  regulatory action can result in loss of collateral regardless of LTV.
- **Tax implications are not modeled.** Borrowing, selling BTC, and earning yield may
  constitute taxable events. Consult a tax professional.
- Users should verify calculations independently before making financial decisions.

## 20. References

- **Spreadsheet reference implementation:** `btc_leveraged_model.xlsx` (not in repo; available on request)
- **Web app specification:** `docs/webapp-specification.md` (in the `btc-gear` repository)
- **This document:** `docs/spreadsheet-specification.md`
- **Platform defaults:** Ledn (ledn.io)
- **Price anchor sources:** ARK Invest, Standard Chartered, Bernstein, Binance, CoinCodex, YouHodler (2024–2025)