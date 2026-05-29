# btc-gear Review, Local-First Data, and Dashboard Specification

Status: Draft for AI-assisted implementation
Date: 2026-05-29
Audience: AI coding agents and human reviewers

## 1. Review page purpose

The Review page is the control loop for real-world use:

```text
Plan -> Draw or skip income -> Observe actual BTC/debt state -> Review -> Recalculate -> Recommend next period -> Rebaseline if needed
```

It is inspired by the Retirement Income Planner review pattern, adapted for BTC-backed borrowing.

## 2. Review snapshot schema

MVP review snapshot:

```ts
export type ReviewSnapshot = {
  id: string;
  reviewDate: string; // YYYY-MM-DD or YYYY-MM

  btcPriceUsd: number;
  btcPriceSource: 'fetched' | 'manual';

  totalBtcHeld: number;
  collateralBtc: number;
  debtUsd: number;

  actualIncomeDrawnUsd: number;
  interestPaidOrAccruedUsd?: number;
  principalRepaidUsd?: number;
  collateralAddedBtc?: number;
  collateralRemovedBtc?: number;

  strategyKind: string;
  strategyParams: Record<string, unknown>;

  notes: string;
};
```

## 3. Review workflow

1. App fetches current BTC price where possible.
2. User confirms/edits BTC holdings, collateral BTC, debt, and income drawn.
3. App saves review snapshot locally.
4. App compares actuals against locked baseline if strategy is unchanged.
5. App generates revised projection from latest actual state.
6. App recommends next-period draw under current strategy.
7. App offers export backup after saving review.

## 4. Baseline and rebaseline

Baseline:
- A locked config/projection used as reference for plan-vs-actual.

Rebaseline:
- Replace baseline with current config and latest actual state.

Rules:
- If strategy changes, direct baseline variance is paused.
- Historical actual review dots remain visible.
- UI should show: "Strategy changed. Plan-vs-actual comparison is paused until rebaseline."

## 5. Plan-vs-actual charts

Review page must support these charts:

1. BTC Price: baseline vs actual vs revised path.
2. Debt: planned vs actual vs revised.
3. LTV: planned vs actual vs revised, with warning/liquidation bands.
4. Income: planned draw vs actual draw vs revised future draw.
5. Net BTC after debt: planned vs actual vs revised.

## 6. BTC-specific attribution

When possible, explain why risk changed since last review.

Attribution examples:
- BTC price movement increased LTV.
- Interest accrual increased debt.
- Actual income draw increased debt.
- Skipped income preserved LTV headroom.
- Added collateral improved buffer.

MVP can implement attribution as deterministic deltas in a helper function with tests.

## 7. Local-first data model

All user data is stored locally in browser storage for MVP.

Stores:

```text
profileStore      current config and preferences
scenarioStore     saved what-if scenarios
reviewStore       review snapshots and baseline
priceCacheStore   optional fetched BTC prices
```

Do not scatter direct localStorage calls throughout components. Use store modules.

## 8. Export/import profile

Export is mandatory for MVP.

Bundle format:

```ts
export type BtcGearProfileExportV1 = {
  app: 'btc-gear';
  schemaVersion: 1;
  exportedAt: string;
  appVersion?: string;
  config: BtcGearConfig;
  scenarios: SavedScenario[];
  reviews: ReviewSnapshot[];
  baseline?: BaselineSnapshot | null;
  preferences?: Record<string, unknown>;
};
```

Export filename:

```text
btc-gear-profile-YYYY-MM-DD.json
```

Import rules:
- Validate `app === 'btc-gear'`.
- Validate supported schema version.
- Validate required fields.
- Preview import summary before replacing local data.
- For MVP, replace profile after confirmation.
- Create local pre-import backup in memory/localStorage if practical.

## 9. Privacy copy

App must include clear local-first wording:

"btc-gear stores your holdings, debt, scenarios, and reviews in this browser. They are not uploaded to a server. Export your profile to back up or move devices. Clearing browser data may delete your profile."

## 10. Dashboard specification

Dashboard purpose:
- Show current strategy health and the most important tradeoffs at a glance.

Required cards:
- BTC price
- collateral BTC
- debt
- LTV
- drop-to-liquidation
- total projected income
- skipped income
- final net BTC after debt
- status / first warning year

Required charts:

1. BTC price vs liquidation price
2. LTV with risk bands
3. Annual income drawn vs skipped
4. Net BTC after debt
5. Strategy Tradeoff Map

## 11. Strategy Tradeoff Map

This is the signature overview chart.

Default axes:
- X: minimum drop-to-liquidation buffer over projection
- Y: total income funded over projection

Encoding:
- color: status (`green`, `warning`, `constrained`, `liquidated`)
- size: final net BTC after debt
- marker/outline: current scenario
- star marker: recommended or best-scoring scenario
- shape or grouping: strategy family

Quadrants:
- top-right: Best Tradeoff
- top-left: High Income / High Risk
- bottom-right: Conservative
- bottom-left: Weak Tradeoff

Tooltip fields:
- strategy
- annual target/draw rule
- BTC price path
- total income funded
- skipped income
- min drop-to-liquidation
- max LTV
- final net BTC
- first warning/constrained/liquidation year

Scenario generation for MVP:
- vary desired income draw
- vary required buffer
- vary income LTV ceiling
- vary BTC growth/stress path

## 12. Heatmaps

Initial heatmaps:

1. Desired Income x BTC Growth -> status or final net BTC.
2. Desired Income x Required Buffer -> total income funded or min buffer.
3. Income LTV Ceiling x Required Buffer -> safe draw capacity.

Heatmaps are support tools. They do not replace the Strategy Tradeoff Map.

## 13. UI acceptance criteria

1. Dashboard updates when config changes.
2. Strategy switch changes visible inputs and projection output.
3. What If sandbox does not mutate live profile until explicitly saved/applied.
4. Review snapshots update actual-history charts.
5. Export/import round trip preserves config, scenarios, reviews, and baseline.
6. Strategy-changed state pauses baseline variance.
7. No user financial data is sent to a server in MVP.

## 14. Implementation readiness clarifications

### 14.1 Baseline snapshot schema

Use an explicit baseline object:

```ts
export type BaselineSnapshot = {
  id: string;
  createdAt: string;
  startYear: number;
  config: BtcGearConfig;
  projectionRows: ProjectionYear[];
  summary: ProjectionSummary;
  strategyFingerprint: string;
};
```

The strategy fingerprint includes:
- strategy kind
- strategy params
- loan constraints
- planning age / horizon

If fingerprint differs from the locked baseline, pause baseline variance until rebaseline.

### 14.2 Review date matching

Add `projectionYear` to review snapshots for deterministic joins.

```ts
projectionYear: number;
```

UI may derive it from `reviewDate`, but stored reviews should not rely only on month/date matching.

Multiple reviews in one projection year are allowed. For variance cards, latest review in that year wins. For income history, actual income may be summed by year.

### 14.3 Authoritative actual debt

`debtUsd` in `ReviewSnapshot` is authoritative actual ending debt at the review date.

Component fields such as income drawn, interest, repayments, and collateral changes are attribution-only in MVP. They must not be recomputed into debt for revised projection, otherwise income/debt can be double-counted.

### 14.4 Price path anchoring after review

When revised projection starts from a review:
- annual growth path: review BTC price becomes new starting price
- explicit path: future explicit prices remain unless user selects re-anchor
- re-anchored explicit path: multiply future planned prices by `actualReviewPrice / plannedReviewPrice`
- named stress path: restart the named stress path from the review date using review BTC price as base

### 14.5 Recommendation scoring for Strategy Tradeoff Map

MVP recommendation rule:
- exclude liquidated scenarios
- exclude scenarios with `minDropToLiquidationPct < requiredDropBufferPct`
- exclude Max Safe Capacity from recommendation unless user explicitly enables diagnostic recommendations
- if no scenario qualifies, show: "No recommended scenario under selected assumptions."

Default score among qualifying scenarios:

```text
score = 0.40 * normalizedIncome
      + 0.35 * normalizedSafetyBuffer
      + 0.25 * normalizedFinalNetBtc
```

Persona-specific weights may come later. Tests must prove unsafe high-income scenarios are not starred.

### 14.6 Import validation and atomicity

Import must be atomic:
- invalid import leaves current local profile unchanged
- malformed JSON is rejected
- unsupported schema is rejected
- invalid numeric fields are rejected
- pre-import backup may be stored under `btc-gear:pre-import-backup`

Validation must reject non-finite numbers and invalid dates/IDs.

### 14.7 Saved scenario schema

```ts
export type SavedScenario = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: BtcGearConfig;
  notes?: string;
};
```

Rules:
- saving stores a copy of sandbox config
- applying to live profile requires confirmation
- editing saved scenarios does not alter baseline
- comparisons use immutable config snapshots
