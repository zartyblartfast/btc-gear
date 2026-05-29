# btc-gear Web App Engine and Strategy Specification

Status: Draft for AI-assisted implementation
Date: 2026-05-29
Audience: AI coding agents and human reviewers

## 1. Engine architecture

The calculation engine must be pure TypeScript with no React, DOM, localStorage, or network dependencies.

Suggested files:

```text
src/engine/types.ts
src/engine/risk.ts
src/engine/pricePaths.ts
src/engine/projection.ts
src/engine/strategies.ts
src/engine/strategyFixedDraw.ts
src/engine/strategySupplementalGuardrail.ts
src/engine/strategyArva.ts
src/engine/strategyMaxSafe.ts
src/engine/fixtures/
src/engine/__tests__/
```

Every exported engine function must be deterministic for identical inputs.

## 2. Core input types

Define an explicit config type. Do not pass loosely shaped objects through the engine.

Minimum MVP fields:

```ts
export type BtcGearConfig = {
  startYear: number;
  projectionYears: number;
  currentAge?: number;
  planningAge?: number;

  position: {
    totalBtcHeld: number;
    collateralBtc: number;
    debtUsd: number;
    btcPriceUsd: number;
  };

  loan: {
    aprPct: number;
    liquidationLtvPct: number;
    incomeLtvCeilingPct: number;
    requiredDropBufferPct: number;
  };

  pricePath: PricePathConfig;

  strategy: StrategyConfig;
};
```

## 3. Core output types

Each projection returns rows and summary.

```ts
export type ProjectionYear = {
  index: number;
  year: number;
  age?: number;
  btcPriceUsd: number;

  startingDebtUsd: number;
  interestUsd: number;
  debtAfterInterestUsd: number;

  targetDrawUsd: number;
  actualDrawUsd: number;
  skippedIncomeUsd: number;
  endingDebtUsd: number;

  collateralBtc: number;
  totalBtcHeld: number;
  collateralValueUsd: number;
  netEquityUsd: number;
  netBtcAfterDebt: number;

  ltvPct: number;
  liquidationPriceUsd: number;
  dropToLiquidationPct: number;

  maxSafeDebtUsd: number;
  availableSafeDrawUsd: number;

  status: 'green' | 'warning' | 'constrained' | 'liquidated';
  reasonCodes: string[];
};
```

## 4. Annual lifecycle

For income/retirement strategies, each annual row must use this sequence:

1. Start row with previous ending debt.
2. Apply BTC price for this year.
3. Calculate interest on debt outstanding at start of row.
4. Calculate debt after interest.
5. Strategy calculates target draw and desired behavior using current state.
6. Risk engine calculates max safe debt and available safe draw.
7. Actual draw is capped by safety and strategy rules.
8. Ending debt = debt after interest + actual draw.
9. Compute ending risk metrics and status.
10. Carry ending debt into next row.

Critical rule:
- New borrowing in year N does not accrue interest until year N+1.

## 5. Risk formulas

Use decimal internally. Convert to percent only for display.

```ts
collateralValueUsd = collateralBtc * btcPriceUsd
ltv = debtUsd / collateralValueUsd
liquidationPriceUsd = debtUsd / (collateralBtc * liquidationLtv)
dropToLiquidation = max(0, 1 - liquidationPriceUsd / btcPriceUsd)
netEquityUsd = totalBtcHeld * btcPriceUsd - debtUsd
netBtcAfterDebt = totalBtcHeld - debtUsd / btcPriceUsd
```

Max safe debt is the minimum of:

```ts
maxDebtByIncomeLtv = collateralBtc * btcPriceUsd * incomeLtvCeiling
maxDebtByBuffer = collateralBtc * btcPriceUsd * liquidationLtv * (1 - requiredDropBuffer)
maxSafeDebt = min(maxDebtByIncomeLtv, maxDebtByBuffer)
availableSafeDraw = max(0, maxSafeDebt - debtAfterInterestUsd)
```

If `debtUsd >= collateralBtc * btcPriceUsd * liquidationLtv`, status is `liquidated`.

## 6. Price paths

MVP must support deterministic paths:

1. Flat / annual growth
2. Explicit annual prices
3. Named stress paths
   - bear then recovery
   - bull then crash
   - flat decade

Do not make flexible strategies depend only on smooth annual growth. At least one adverse path must be used in tests.

## 7. Strategy: Fixed Draw

Description:
- Attempts to borrow a fixed annual income amount.

Inputs:
```ts
{ kind: 'fixedDraw'; annualDrawUsd: number }
```

Rule:
```ts
targetDrawUsd = annualDrawUsd
actualDrawUsd = min(targetDrawUsd, availableSafeDrawUsd)
skippedIncomeUsd = targetDrawUsd - actualDrawUsd
```

Reason codes:
- `draw_full`: full target funded
- `draw_capped_by_safety`: partial draw
- `draw_zero_no_capacity`: zero draw

## 8. Strategy: Supplemental Guardrail

Description:
- Draws supplemental income only when safety buffer permits.
- Designed for users with other retirement income who prioritize avoiding forced BTC sale.

Inputs:
```ts
{
  kind: 'supplementalGuardrail';
  desiredDrawUsd: number;
  minimumDrawUsd?: number; // default 0
  allowCatchUp?: false;    // MVP fixed false
}
```

Rule:
```ts
targetDrawUsd = desiredDrawUsd
actualDrawUsd = min(desiredDrawUsd, availableSafeDrawUsd)
if actualDrawUsd < minimumDrawUsd then actualDrawUsd = 0
skippedIncomeUsd = desiredDrawUsd - actualDrawUsd
```

No catch-up in MVP. Missed income is recorded but not automatically added later.

Must hold:
- If full draw would breach required buffer, draw must be reduced.
- If no draw preserves buffer, draw must be zero.
- The strategy must never intentionally breach its own safety buffer.

## 9. Strategy: ARVA

Description:
- Annually Recalculated Virtual Annuity.
- Recalculates sustainable spending from current spendable net equity and remaining planning horizon.
- Targets depletion toward terminal reserve at planning age.

Inputs:
```ts
{
  kind: 'arva';
  assumedRealReturnPct: number;
  terminalReserveBtc: number;
  incomeCapUsd?: number;
}
```

Remaining years:
```ts
remainingYears = max(1, planningAge - currentAge + 1)
```

Spendable equity:
```ts
terminalReserveUsd = terminalReserveBtc * btcPriceUsd
spendableEquityUsd = max(0, netEquityUsd - terminalReserveUsd)
```

Annual payment:
```ts
if abs(r) < epsilon:
  rawArvaDraw = spendableEquityUsd / remainingYears
else:
  rawArvaDraw = spendableEquityUsd * r / (1 - (1 + r) ** -remainingYears)
```

Actual draw:
```ts
targetDrawUsd = min(rawArvaDraw, incomeCapUsd ?? Infinity)
actualDrawUsd = min(targetDrawUsd, availableSafeDrawUsd)
```

Must hold:
- ARVA draw changes as net equity and remaining horizon change.
- ARVA must not borrow against terminal reserve.
- Safety cap overrides raw ARVA draw.

## 10. Strategy: ARVA with Guardrails

Description:
- ARVA with annual income smoothing.

Inputs:
```ts
{
  kind: 'arvaGuardrails';
  assumedRealReturnPct: number;
  terminalReserveBtc: number;
  maxAnnualIncreasePct: number;
  maxAnnualDecreasePct: number;
  incomeCapUsd?: number;
}
```

Rule:
1. Calculate raw ARVA draw.
2. If first year, guardrailed draw = raw ARVA draw.
3. Else clamp raw draw between:
   - previousActualDraw * (1 - maxAnnualDecrease)
   - previousActualDraw * (1 + maxAnnualIncrease)
4. Apply optional income cap.
5. Apply safety cap.

Critical BTC-specific rule:
- Safety cap beats guardrails.
- If guardrailed draw is 36,000 but safe capacity is 15,000, actual draw is 15,000.
- If safe capacity is zero, actual draw is zero.

Reason codes:
- `arva_raw`
- `guardrail_increase_cap`
- `guardrail_decrease_cap`
- `safety_override`

## 11. Strategy: Max Safe Capacity

Description:
- Diagnostic. Shows the maximum draw permitted by safety constraints.

Rule:
```ts
targetDrawUsd = availableSafeDrawUsd
actualDrawUsd = availableSafeDrawUsd
```

Do not label this as recommended by default.

## 12. Summary metrics

Projection summary must include:

- totalIncomeDrawnUsd
- totalSkippedIncomeUsd
- finalDebtUsd
- finalNetBtcAfterDebt
- finalNetEquityUsd
- maxLtvPct
- minDropToLiquidationPct
- firstWarningYear
- firstConstrainedYear
- liquidationYear
- safeAllYears boolean

## 13. Review/rebaseline engine behavior

A review actual state can become the new projection starting state.

Rules:
- Latest review actual debt replaces modeled debt for revised projection.
- Latest review collateral BTC replaces modeled collateral BTC.
- Latest review BTC price replaces or anchors current price path.
- Actual income drawn is recorded historically; it must not be double-counted as future target income.
- If strategy changes, baseline variance should be paused until rebaseline.

## 14. Engine acceptance criteria

Engine work is acceptable only when:

1. All strategies produce complete `ProjectionYear[]` rows.
2. Strategy concept tests pass for favorable and adverse BTC paths.
3. Golden fixtures are human-inspectable.
4. Safety constraints are tested as overriding income targets and guardrails.
5. Same inputs always produce same outputs.
6. No React/UI code is required to test the engine.

## 15. Implementation readiness clarifications

These rules resolve ambiguity before coding.

### 15.1 Percent units

Engine boundary rule:
- Config fields ending in `Pct` are human percent values, e.g. `50` means 50%.
- Normalize once at the engine boundary into decimal values.
- Internal helpers must use decimal values only.
- Tests must prove `50` is treated as 50%, not 5000% or 0.5%.

### 15.2 Config validation ranges

Reject invalid config before projection:
- `btcPriceUsd > 0`
- `totalBtcHeld >= 0`
- `0 <= collateralBtc <= totalBtcHeld`
- `debtUsd >= 0`
- `aprPct >= 0`
- `0 < liquidationLtvPct <= 100`
- `0 <= incomeLtvCeilingPct < liquidationLtvPct`
- `0 <= requiredDropBufferPct < 100`
- `projectionYears >= 1`, MVP cap 100
- if present, `planningAge >= currentAge`
- `terminalReserveBtc >= 0`

### 15.3 Status precedence

Each row has one primary status, plus multiple reason codes.

Status precedence:
1. `liquidated` if ending debt is at or above liquidation threshold.
2. `constrained` if `actualDrawUsd < targetDrawUsd` because safety capacity limited the draw.
3. `warning` if ending buffer is below required buffer or ending LTV exceeds income LTV ceiling.
4. `green` otherwise.

Reason codes must preserve all applicable details even when primary status is singular.

### 15.4 Distress and liquidation lifecycle

If `debtAfterInterestUsd >= collateralBtc * btcPriceUsd * liquidationLtv`:
- row status is `liquidated`
- `availableSafeDrawUsd = 0`
- `actualDrawUsd = 0`
- `endingDebtUsd = debtAfterInterestUsd`
- subsequent rows continue as diagnostic projections unless a later product decision models forced collateral sale
- reason codes include `liquidation_threshold_breached` and `post_liquidation_no_draw`

If debt is above max safe debt but below liquidation:
- not automatically liquidated
- no additional borrowing is allowed unless safe capacity becomes positive
- reason code includes `already_over_safe_debt`

### 15.5 ARVA equity basis

MVP rule:
- ARVA target is based on total net equity from `totalBtcHeld`.
- Actual borrowing remains capped by collateral safety from `collateralBtc`.
- Therefore ARVA target is a wealth-plan desired income, not guaranteed borrowable income.
- UI copy must explain that ARVA income may be constrained by collateral capacity.

Tests must include `totalBtcHeld > collateralBtc` to prove this distinction.

### 15.6 ARVA guardrail reference basis

Store three ARVA values per row:
- `rawArvaDrawUsd`
- `guardrailedTargetDrawUsd`
- `actualDrawUsd`

Guardrail smoothing uses the previous year's `guardrailedTargetDrawUsd`, not previous `actualDrawUsd`.

Reason:
- A safety override to zero must not permanently trap future ARVA income at zero after recovery.
- Safety still caps actual borrowing each year.

Tests must cover crash-to-zero safety override followed by recovery.

### 15.7 Named stress paths

MVP named paths are multipliers applied to starting BTC price:
- `flatDecade`: `[1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]`
- `bearThenRecovery`: `[1.0, 0.6, 0.5, 0.7, 0.9, 1.1, 1.25, 1.4, 1.55, 1.7]`
- `bullThenCrash`: `[1.0, 1.5, 2.0, 0.8, 0.9, 1.1, 1.25, 1.35, 1.45, 1.55]`

If projection length exceeds the multiplier list, continue from the last multiplier using the configured annual growth assumption or flat growth if not configured.
