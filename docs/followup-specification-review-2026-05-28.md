# BTC Gear follow-up specification review — 2026-05-28

Reviewed files:

- `/tmp/btc-gear/docs/spreadsheet-specification.md`
- `/tmp/btc-gear/docs/webapp-specification.md`
- `/tmp/btc-gear/README.md`

Overall: the update is a substantial improvement. Most of the big conceptual issues from the first review have been addressed: stablecoin-only borrowing is now explicit, BTC quantity growth is correctly tied to rebalancing rather than mark-to-market appreciation, purchased BTC collateral treatment is defined, “real BTC” has been removed, disclaimers/accessibility/validation/error-state sections were added, and the web app now acknowledges deferred items.

I would move the docs from “not safe to implement yet” to “close, but still needs one tightening pass before engine work.”

Updated readiness score:

- Product clarity: 8.5/10
- Architecture clarity: 8/10
- UI/UX scope definition: 8/10
- Testing intent: 8/10
- Financial model precision: 7/10
- Implementation readiness: 7/10

The remaining issues are narrower than before, but several still affect implementation correctness.

## Key remaining findings

### 1. The spreadsheet spec still has conflicting annual calculation order

Section 2.1 says the deterministic annual cycle is:

1. price update
2. collateral value
3. pre-interest LTV
4. liquidation check
5. margin call check
6. interest accrues and is added to debt
7. rebalancing
8. mode action
9. end-of-year state

But section 6.1 says:

1. price update
2. collateral value
3. renewal check
4. rebalancing decision
5. borrow/repay
6. interest accrues during year
7. platform monitors LTV
8. liquidation
9. excess return
10. mode decision

These are materially different.

Example difference:

- If interest is added before rebalancing, rebalancing borrows less, because some LTV capacity is consumed by interest.
- If rebalancing happens before interest, the year may end above target LTV after interest accrues.
- Liquidation before vs after interest also changes whether a borderline year fails.

The numerical example in §2.5 follows the §2.1 order: interest first, then rebalance to 35%.

Fix needed:

Make §6.1 match §2.1 exactly. I would use the §2.1 order as canonical and delete/rewrite the older start/during/end wording in §6.1.

Suggested canonical fields:

- debtStart
- preInterestLtv
- interestAccrued
- debtAfterInterest
- rebalanceBorrowingUsd
- rebalanceRepaymentUsd
- debtEnd
- effectiveLtvEnd

### 2. The price projection example has incorrect numbers because amplitude decay is applied inconsistently

The formula says:

```text
cycle_number = floor(t / 4)
effective_amplitude = Base_Amplitude × (1 − Amplitude_Decay)^cycle_number
Raw_Multiplier(t) = 1 + effective_amplitude × cos(2π × t / 4)
Cycle_Multiplier(t) = Raw_Multiplier(t) / (1 + effective_amplitude)
```

With amplitude 40% and decay 15%:

- t=4 has effective amplitude 0.40 × 0.85 = 0.34, so Raw Mult = 1.34, not 1.40
- t=5 has effective amplitude 0.34, so Cycle Mult = 1 / 1.34 = 0.746, not 0.714
- Therefore 2030 displayed price is about $373K, not $357K

I verified this calculation.

Current table says:

- 2029 Raw Mult = 1.40
- 2030 Cycle Mult = 0.714
- 2030 Displayed Price = $357K

Those numbers ignore amplitude decay for t=4 and t=5.

Fix options:

A. Keep current formula and update the table:

- 2029 Raw Mult: 1.34
- 2030 Cycle Mult: 0.746
- 2030 Displayed Price: $373K

B. Change the formula so amplitude decay applies only after completing the 2025–2029 cycle, not at t=4.

Either is fine, but formula and example must agree.

### 3. Spreadsheet default LTV is still inconsistent

In spreadsheet spec §4.2, the Inputs table says:

- LTV target default: 50%

But later §18 says:

- The spreadsheet default LTV is 35%, the “Standard” risk profile

The web app spec also defaults to 35%.

Fix needed:

Change §4.2 LTV target default to 35%, while keeping the description that Ledn offers 50% initial LTV.

Suggested wording:

“Default: 35% Standard profile. Ledn offers up to 50% initial LTV, available via the Aggressive preset.”

### 4. The web Config and JSON example still use “% of excess”, while the type uses “% of equity gain”

In `webapp-specification.md`:

The TypeScript Config says:

```ts
withdrawalRule: 'Fixed $' | '% of equity gain';
```

But the JSON export example uses:

```json
"withdrawalRule": "% of excess"
```

The defaults table also says:

```text
withdrawalRule | % of excess
```

Spreadsheet validation says:

“% of excess” or “% of equity gain” in updated terminology

This will create an implementation mismatch if copied literally.

Fix needed:

Standardize everywhere on one enum value. I recommend:

```text
% of equity gain
```

Then update:

- JSON example
- defaults table
- validation table
- UI copy if needed

If backward compatibility with old exports matters, migration can map `% of excess` to `% of equity gain`.

### 5. PositionRow lacks enough debt fields to implement the canonical sequence safely

The web spec currently has:

```ts
outstandingDebt: number; // Start of year before interest + rebalancing
newBorrowing: number;
effectiveLtv: number; // outstandingDebt(after rebalance) ÷ collateralValue
```

But if outstandingDebt means start-of-year debt, it cannot also be used for net equity, end-of-year LTV, summary max debt, income mode, and subsequent-year carryforward.

This ambiguity will leak into implementation.

Fix needed:

Split debt into explicit lifecycle fields:

```ts
debtStart: number;
preInterestLtv: number;
annualInterest: number;
debtAfterInterest: number;
rebalanceBorrowingUsd: number;
rebanceRepaymentUsd: number;
debtEnd: number;
effectiveLtvEnd: number;
```

Then define:

- netEquityUsd = totalLeveragedBtcEnd × btcPrice − debtEnd
- effectiveLtvEnd = debtEnd / collateralValue
- next row debtStart = previous row debtEnd

This is probably the most important implementation-facing fix.

### 6. New borrowing and repayment should not share one overloaded field

The spreadsheet spec says:

“New borrowing (USD): Additional borrowed this year; $0 or negative if repaying.”

The web type says:

```ts
newBorrowing: number;
btcBoughtFromRebalancing: number;
```

This works poorly for repayment years. A negative newBorrowing implies negative BTC bought, but repayment means BTC sold, not “negative bought.”

Fix needed:

Use separate fields:

```ts
rebalanceBorrowingUsd: number;   // >= 0
btcBoughtFromRebalancing: number; // >= 0
rebalanceRepaymentUsd: number;   // >= 0
btcSoldForRepayment: number;     // >= 0
```

Then total leveraged BTC can be updated clearly:

```ts
totalLeveragedBtcEnd =
  totalLeveragedBtcStart
  + btcBoughtFromRebalancing
  - btcSoldForRepayment
  - btcSoldForIncome;
```

### 7. Income mode is still underspecified around what BTC is sold

The docs now say income is taken by selling BTC, which is good. But because the model also says only original BTC is collateral and purchased BTC is held separately, the spec should say which BTC is sold first.

Likely rule:

- Sell non-collateral/purchased BTC first.
- Do not sell original collateral BTC unless explicitly allowed.
- If requested income exceeds available non-collateral BTC or would push net BTC below some threshold, cap income and flag “insufficient non-collateral BTC.”

Right now §2.4 says:

“The user cannot withdraw from a shrinking position without selling collateral, which the model flags but does not force.”

But if the model sells BTC for income in good years, does it sell only purchased BTC? Can it ever sell original collateral? What if cumulative sold BTC exceeds cumulative purchased BTC?

Fix needed:

Add a “sale source order” and cap rule.

Example:

“Income withdrawals sell only purchased/non-collateral BTC. Original collateral BTC is never sold by the model except liquidation. If requested income would require selling original collateral, cap income to available purchased BTC and show a warning.”

### 8. Net BTC terminology is inconsistent between web IncomeRow and spreadsheet income table

Spreadsheet §7.2 defines:

“Net BTC owned (after withdrawals + debt) = Total BTC − debt ÷ BTC price”

But web IncomeRow has:

```ts
netBtcAfterWithdrawals: number; // After selling for income (if Income) or after rebalancing (if Accum)
btcAccumulationMultiple: number; // netBtc / startingBtc
```

This sounds like netBtcAfterWithdrawals excludes income sales but may not subtract debt. If it does not subtract debt, it is not “net BTC owned”; it is gross BTC after withdrawal.

Fix needed:

Use two explicit fields:

```ts
grossBtcEnd: number;       // actual BTC held before debt payoff
netBtcAfterDebt: number;   // grossBtcEnd - debtEnd / btcPrice
```

Then summary should use netBtcAfterDebt for “net BTC end” and accumulation multiple.

### 9. “Equity gain” still has two definitions in different places

In §2.2:

```text
Equity gain = net_equity(t) − net_equity(t−1)
```

In §6.2:

```text
Excess return = Appreciation − Total annual cost
```

In §6.1:

```text
Excess return calculated = (total BTC × price_change) − (interest + fees)
```

Those can diverge if:

- rebalancing changes BTC quantity during the year
- income withdrawal sells BTC
- repayment sells BTC
- debt changes due to interest and borrowing
- fees/origination are included differently

The docs now correctly prefer “equity gain”, but the older “excess return” formula remains and may reintroduce ambiguity.

Fix needed:

Either remove “excess return” as an implementation field or define it as a display-only diagnostic.

Recommended:

- Primary field: equityGainUsd = netEquityEndBeforeIncome − netEquityPreviousEnd
- Diagnostic field: markToMarketReturnUsd = btcStart × priceChange − interest − fees
- Do not use “excess return” for withdrawals unless it is exactly defined.

### 10. Fixture strategy is still deferred, but now explicitly so

This is acceptable if the project is still in spec phase, but it remains a practical implementation blocker.

The docs say fixtures are derived from the verified spreadsheet, but the spreadsheet is not in the repo and fixtures are not yet present.

That is okay if the next step is “build fixtures during Phase 1,” but the first engine implementation will still need independently verified expected values.

Minimum recommendation before coding:

Add at least one hand-verified appendix or JSON fixture for:

- default config
- price path first 6 years
- year 0 setup
- year 1 standard 35% example
- one down-year repayment example
- one income-mode example

The current §2.5 example is a strong start, but it should be machine-translatable.

### 11. README is fine, but it now refers to a src tree that does not exist yet

This is not a serious issue because status is “pre-alpha,” but it may confuse a reader browsing the repo.

Optional fix:

Add:

“The source tree shown below is planned; implementation has not started yet.”

## Bottom line

The docs are much improved and the major conceptual flaw — treating appreciation as directly reinvestable BTC — has been corrected.

However, I would still not start full engine implementation until the remaining sequencing and field-definition ambiguities are fixed. The main risk has shifted from “the economic model is conceptually wrong” to “the implementation may choose the wrong interpretation of debt timing, rebalancing, repayment, and income-sale mechanics.”

Highest-priority fixes before development:

1. Make §6.1 annual cycle match §2.1.
2. Fix the price projection example table for amplitude decay.
3. Resolve default LTV: 35% vs 50%.
4. Standardize withdrawalRule enum: “% of equity gain”.
5. Split debt fields into start/intermediate/end values.
6. Separate borrow-vs-repay and BTC-bought-vs-BTC-sold fields.
7. Define income sale source/cap rules.
8. Clarify gross BTC vs net BTC after debt.

After those are fixed, I would consider the specs good enough to begin Phase 1 engine work with golden tests.
