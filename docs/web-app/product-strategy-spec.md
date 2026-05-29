# btc-gear Web App Product and Strategy Specification

Status: Draft for AI-assisted implementation
Date: 2026-05-29
Audience: AI coding agents and human reviewers

## 1. Product goal

btc-gear helps users model Bitcoin-backed borrowing strategies for accumulation, retirement income, and collateral preservation.

The web app must answer three questions:

1. How much income or extra BTC exposure can this position support?
2. What happens to debt, LTV, liquidation risk, and net BTC over time?
3. Which strategy is most appropriate given the user's priority: income, flexibility, or collateral preservation?

The app must be transparent, local-first, and testable. It must not present risky borrowing strategies as safe because a chart looks good under optimistic BTC assumptions.

## 2. Product principles

1. Strategy-first, not spreadsheet-first.
   - Users choose a strategy policy.
   - The engine applies that policy over a BTC price path.
   - The UI explains the policy outcome.

2. Safety constraints are first-class.
   - LTV, liquidation price, and drop-to-liquidation buffer are not secondary metrics.
   - Safety caps override income smoothing and income targets.

3. Local-first privacy.
   - User holdings, debt, reviews, and scenarios are stored locally in the browser.
   - No login or backend is required for MVP.
   - Export/import profile is mandatory.

4. Honest projections.
   - Smooth growth paths are not enough.
   - The app must support stress paths and review/rebaseline workflows.

5. Inspectable calculations.
   - Core engine is pure TypeScript with deterministic inputs/outputs.
   - Important scenarios have golden tests and independently reviewable expected values.

## 3. Initial user personas

### 3.1 Collateral preservation user

Profile:
- Already owns BTC.
- Has other retirement income.
- Wants supplemental income only when safe.
- Top priority is avoiding forced sale/liquidation of collateral BTC.

Preferred strategies:
- Supplemental Guardrail
- Capital Preservation

### 3.2 Smart spenddown user

Profile:
- Wants to use BTC wealth to increase retirement spending.
- Has a planning age, e.g. 92 or 95.
- Does not require large capital left at the end.
- Accepts flexible income if investment/BTC performance is weak.

Preferred strategies:
- ARVA
- ARVA with Guardrails

### 3.3 Accumulation user

Profile:
- Wants to model borrowing against BTC to buy more BTC.
- Needs risk visibility under price drawdowns.

Preferred strategies:
- Accumulation engine
- Max Safe Capacity / leverage capacity view

## 4. Strategy spectrum

Strategies should sit on a visible spectrum:

```text
Preserve BTC  <----->  Flexible Income  <----->  Smart Spenddown  <----->  Max Income
```

MVP strategy families:

1. Fixed Draw
   - Borrow a fixed annual target if capacity allows.
   - Useful baseline.

2. Supplemental Guardrail
   - Borrow desired supplemental income only when safety buffer permits.
   - Partial or zero draw is acceptable.
   - No catch-up in MVP.

3. ARVA
   - Annually recalculated virtual annuity.
   - Recalculates income from current spendable net equity and remaining planning horizon.
   - Aims to spend down toward terminal reserve by planning age.

4. ARVA with Guardrails
   - ARVA plus caps on year-to-year income increases/decreases.
   - BTC-specific rule: safety override beats smoothing.

5. Max Safe Capacity
   - Diagnostic capacity view, not a recommended retirement strategy.
   - Shows the maximum draw permitted by constraints.

Later strategy families:
- Capital Preservation Target
- Catch-up Supplemental Income
- Monte Carlo Optimized Recommendation

## 5. Required product definitions

Use these names consistently in code, docs, UI, and tests.

- `btcPriceUsd`: BTC spot or projected price in USD.
- `collateralBtc`: BTC posted or assumed available as collateral.
- `totalBtcHeld`: total BTC owned by user, may equal collateral BTC in MVP.
- `debtUsd`: outstanding USD/stablecoin loan debt.
- `collateralValueUsd`: `collateralBtc * btcPriceUsd`.
- `ltv`: `debtUsd / collateralValueUsd`.
- `liquidationLtv`: lender liquidation threshold.
- `liquidationPriceUsd`: BTC price where debt reaches liquidation LTV.
- `dropToLiquidationPct`: percentage BTC can fall before liquidation.
- `requiredDropBufferPct`: minimum acceptable drop-to-liquidation buffer.
- `netEquityUsd`: `totalBtcHeld * btcPriceUsd - debtUsd`.
- `netBtcAfterDebt`: `totalBtcHeld - debtUsd / btcPriceUsd`.
- `actualDrawUsd`: income actually borrowed in a period.
- `targetDrawUsd`: desired income target before constraints.
- `skippedIncomeUsd`: `targetDrawUsd - actualDrawUsd`, floor 0.
- `terminalReserveBtc`: BTC-equivalent target to retain at planning end.
- `planningAge`: user-chosen age through which the strategy is planned.

## 6. Product pages

### 6.1 Dashboard

Purpose:
- Show current strategy, risk status, projection summary, and overview charts.

Must include:
- position summary cards
- income summary cards
- LTV / buffer status
- BTC price vs liquidation price
- income drawn vs skipped
- net BTC after debt
- Strategy Tradeoff Map scattergram

### 6.2 Strategy / Inputs

Purpose:
- Configure starting position, loan terms, price path, and strategy.

Must include:
- BTC holdings
- collateral BTC
- current debt
- current BTC price
- APR
- liquidation LTV
- required buffer
- projection start year / years
- strategy selection and params

### 6.3 What If

Purpose:
- Sandbox strategies without changing the live profile.

Must include:
- editable sandbox config
- save scenario
- compare scenarios
- heatmap / scattergram exploration

### 6.4 Review

Purpose:
- Update actuals, compare plan vs actual, recalculate forward strategy, and optionally rebaseline.

Must include:
- review snapshot form
- plan-vs-actual charts
- revised projection from latest actual state
- strategy-changed warning
- rebaseline action

### 6.5 Profile

Purpose:
- Manage local-first data.

Must include:
- export profile
- import profile
- reset local data
- privacy explanation
- schema/app version display

## 7. Deployment and architecture decisions

MVP stack:
- React + TypeScript + Vite
- Tailwind
- Recharts initially; add Plotly/ECharts only if needed for heatmaps/scatter density
- Vitest for engine and store tests
- React Testing Library for UI tests
- Netlify static deployment from GitHub

No backend in MVP.

BTC price data:
- Fetch public BTC spot/history where possible.
- Manual override must always be available.
- Do not require secret API keys in browser.
- If keyed API becomes necessary later, use Netlify Functions or user-supplied local key.

## 8. Non-goals for MVP

- No user accounts.
- No server-side database.
- No tax advice.
- No automated broker/lender integration.
- No guarantee that borrowing is safe.
- No stochastic Monte Carlo in first implementation unless deterministic engine is already stable.

## 9. Acceptance criteria

The product spec is satisfied when:

1. A user can configure BTC position, debt, and loan terms locally.
2. A user can choose at least Fixed Draw, Supplemental Guardrail, ARVA, and ARVA Guardrails.
3. The engine produces deterministic year rows with risk and income fields.
4. The dashboard shows safety, income, debt, and net BTC outcomes.
5. What If can compare saved scenarios.
6. Review can record actuals and rebaseline.
7. Profile export/import works and is schema-versioned.
8. Test suite includes strategy concept tests, not only arithmetic unit tests.
