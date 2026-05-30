# btc-gear Web App MVP Implementation Plan

> For Hermes: use `subagent-driven-development` or direct TDD implementation task-by-task. Delegate Codex/subagents for isolated engine, store, UI, and review tasks when useful.

Goal: Build a local-first React/TypeScript btc-gear web app with a pure strategy engine, honest tests, profile export/import, dashboard, what-if, and review workflows.

Architecture: Pure TypeScript engine first, then local-first stores, then UI. No backend for MVP. Netlify deployment from GitHub.

Tech stack: Vite, React, TypeScript strict, Tailwind, Recharts, Vitest, React Testing Library, Netlify.

## Current status and handoff notes

Last updated: 2026-05-30, after Stage 2 completion

Current branch state checked by Hermes:
- Branch: `main`
- Remote: `origin/main`
- Latest verified implementation commit in this checkout: `ca9af23 feat: add profile export import helpers`
- Local branch state at time of update: ahead of `origin/main` by local progress commits that may still need pushing
- Local tracked changes at time of update: this plan file only
- Ignored/noise directories may appear untracked: `model_v2/__pycache__/`, `scripts/__pycache__/`, `tests/__pycache__/`, `tmp/`

Verified quality gate before this update:
- `npm test -- --run` -> 15 test files passed, 93 tests passed
- `npm run build` -> passed

Progress summary:
- [x] Stage 0: App skeleton and page placeholders are implemented.
- [x] Stage 1: Pure TypeScript engine is implemented through ARVA Guardrails and golden fixtures.
- [x] Stage 2: Local-first data is complete.
- [ ] Stage 3: Dashboard UI is next. Start with summary cards and chart data helpers.
- [ ] Stage 4: Strategy / Inputs UI waits for store-backed config editing.
- [ ] Stage 5: What If UI waits for scenario store.
- [ ] Stage 6: Review UI waits for review store and baseline operations.
- [ ] Stage 7: Deployment and final quality gate waits for MVP feature completion.

Immediate next task:
1. Start Stage 3.1: implement Dashboard summary cards using engine projection output.
2. Keep chart/card data helpers unit-tested separately from React/Recharts rendering.
3. Keep stores local-first and avoid direct localStorage access in components.

Resume command checklist:
```bash
git status --short --branch
npm test -- --run
npm run build
```

---

## [x] Stage 0: App skeleton

Progress note: Stage 0 is complete. The Vite/React app, navigation, page placeholders, placeholder UI tests, production build, and test command have been verified.


### [x] Task 0.1: Create Vite React TypeScript app structure

Files:
- Create/modify package.json, tsconfig files, src/main.tsx, src/App.tsx

Acceptance:
- `npm run build` passes
- `npm test -- --run` passes with placeholder test

### [x] Task 0.2: Add routing and page placeholders

Pages:
- Dashboard
- Strategy
- What If
- Review
- Profile

Acceptance:
- Navigation renders each page in a UI test

## [x] Stage 1: Pure engine

Progress note: Stage 1 is complete through golden fixtures. Engine types, risk formulas, price paths, projection lifecycle, Fixed Draw, Supplemental Guardrail, ARVA, ARVA Guardrails, and independently reviewable golden fixtures are implemented and tested.


### [x] Task 1.1: Define engine types

Files:
- `src/engine/types.ts`
- `src/engine/__tests__/types.test.ts`

Acceptance:
- Config, strategy, row, and summary types compile under strict TS

### [x] Task 1.2: Implement risk formulas with TDD

Files:
- `src/engine/risk.ts`
- `src/engine/__tests__/risk.test.ts`

Tests first:
- LTV
- liquidation price
- drop-to-liquidation
- max safe debt
- available safe draw
- net BTC after debt

### [x] Task 1.3: Implement price paths with TDD

Files:
- `src/engine/pricePaths.ts`
- `src/engine/__tests__/pricePaths.test.ts`

Tests first:
- flat path
- annual growth path
- explicit path
- named bear/recovery path

### [x] Task 1.4: Implement annual projection lifecycle with fixed draw only

Files:
- `src/engine/projection.ts`
- `src/engine/strategies.ts`
- `src/engine/__tests__/projectionLifecycle.test.ts`

Tests first:
- interest accrues on starting debt only
- new draw accrues interest next year
- constrained draw records skipped income

### [x] Task 1.5: Implement Supplemental Guardrail

Files:
- `src/engine/strategySupplementalGuardrail.ts`
- tests in `src/engine/__tests__/strategySupplementalGuardrail.test.ts`

Tests first:
- full draw in green year
- partial draw when constrained
- zero draw when unsafe
- resume after recovery
- never breaches required buffer

### [x] Task 1.6: Implement ARVA

Files:
- `src/engine/strategyArva.ts`
- tests in `src/engine/__tests__/strategyArva.test.ts`

Tests first:
- raw annuity calculation
- terminal reserve reduces draw
- shorter horizon increases draw all else equal
- safety cap overrides ARVA

### [x] Task 1.7: Implement ARVA Guardrails

Files:
- `src/engine/strategyArva.ts`
- tests in `src/engine/__tests__/strategyArvaGuardrails.test.ts`

Tests first:
- increase cap
- decrease cap
- safety override beats decrease cap
- zero safe capacity means zero draw

### [x] Task 1.8: Add golden fixtures

Files:
- `src/engine/fixtures/*.json`
- `src/engine/__tests__/golden.test.ts`

Acceptance:
- all required fixtures from `docs/web-app/test-strategy.md` pass
- expected values are not generated by the implementation under test

## [x] Stage 2: Local-first data

Progress note: Stage 2 is complete. Stage 2.1 added storage adapters and profile config persistence with tests. Stage 2.2 added saved scenario persistence. Stage 2.3 added review/baseline operations and the previously deferred review/rebaseline fixture coverage. Stage 2.4 added schema-versioned profile export/import helpers with import preview and validation.


### [x] Task 2.1: Implement profile store abstraction

Progress note: Complete in `c1d8870 feat: add local-first profile store`. Added `src/store/storage.ts`, `src/store/profileStore.ts`, memory/browser storage adapters, default config load/save/reset, malformed JSON fallback, wrong-shape fallback, and defensive copy behavior.

Files:
- `src/store/storage.ts`
- `src/store/profileStore.ts`
- tests

Acceptance:
- in-memory storage adapter tests pass
- localStorage implementation isolated

### [x] Task 2.2: Implement scenarios store

Progress note: Complete in `dde971e feat: add saved scenario store`. Added `src/store/scenarioStore.ts`, `SavedScenario`, list/load/save/rename/delete operations, malformed storage fallback, wrong-shape fallback, and defensive copy behavior.

Acceptance:
- save, rename, delete, load scenario tests pass

### [x] Task 2.3: Implement review store and baseline operations

Progress note: Complete in `d140200 feat: add review baseline store`, with fixture coverage in `639e9cd test: add review rebaseline fixture coverage`. Added `src/store/reviewStore.ts`, review add/delete/latest operations, baseline lock/clear/rebaseline operations, strategy fingerprint change detection, schema fallback behavior, defensive copies, and review/rebaseline integration coverage.

Acceptance:
- add/delete review
- lock baseline
- clear baseline
- rebaseline
- strategy change detection

### [x] Task 2.4: Implement export/import profile

Progress note: Complete in `ca9af23 feat: add profile export import helpers`. Added `src/store/profileExport.ts`, schema-versioned `BtcGearProfileExportV1`, export creation, import parsing/validation, import preview counts, unsupported schema rejection, invalid app rejection, and defensive copy behavior.

Acceptance:
- export/import round trip preserves config, scenarios, reviews, baseline
- invalid app/schema rejected
- import preview returns counts

## [ ] Stage 3: Dashboard UI

### [ ] Task 3.1: Summary cards

Acceptance:
- dashboard renders current BTC price, debt, LTV, buffer, income, final net BTC
- changing config updates cards

### [ ] Task 3.2: Core projection charts

Charts:
- BTC price vs liquidation price
- LTV bands
- income drawn vs skipped
- net BTC after debt

Acceptance:
- chart data helpers are unit tested separately from Recharts rendering

### [ ] Task 3.3: Strategy Tradeoff Map

Acceptance:
- scenario grid generation tested
- current scenario marker included
- best tradeoff scoring tested

## [ ] Stage 4: Strategy / Inputs UI

Acceptance:
- user can edit position, loan terms, price path, strategy params
- strategy-specific fields appear only for selected strategy
- app persists config locally

## [ ] Stage 5: What If UI

Acceptance:
- sandbox starts from current config
- sandbox edits do not mutate live profile
- scenario save/load works
- scenario comparison table/chart works
- heatmap data helper tested

## [ ] Stage 6: Review UI

Acceptance:
- user saves review actuals
- actual history charts update
- revised projection starts from latest actuals
- strategy-changed warning appears
- rebaseline works
- export backup prompt appears after review save

## [ ] Stage 7: Deployment and quality gate

Acceptance:
- `npm test -- --run` passes
- `npm run build` passes
- no TypeScript errors
- Netlify config present
- README updated with local dev, build, privacy, export/import notes

## Commit discipline

Commit after each coherent task or stage.

Suggested messages:
- `docs: add web app implementation specs`
- `feat: add web app engine risk formulas`
- `feat: add supplemental guardrail strategy`
- `feat: add local-first profile export`

## Delegation guidance

Good Codex/subagent tasks:
- engine risk formulas and tests
- ARVA strategy and golden fixtures
- local-first store/export-import
- chart data helpers
- Review page store integration

Do not delegate vague tasks like "build dashboard" without passing the relevant spec sections and exact acceptance tests.

## Additional gates and deferred work

These tasks were added during review. Completed items are marked; incomplete items should be picked up in the stage noted below.

### [x] Task 0.3: Add config validation and percent normalization tests

Acceptance:
- invalid ranges are rejected
- percent fields are normalized once at engine boundary
- tests prove `50` means 50%

### [x] Task 0.4: Add distress/liquidation lifecycle tests before strategies

Acceptance:
- already over safe debt prevents borrowing
- liquidation status has precedence
- post-liquidation rows draw zero

### [x] Task 0.5: Add baseline/review schema tests before Review UI

Progress note: Complete through Stage 2.2/2.3 store tests. `SavedScenario`, `ReviewSnapshot`, and `BaselineSnapshot` storage shapes are validated; strategy fingerprint changes are detected; latest review wins for revised projection/rebaseline.

Acceptance:
- `BaselineSnapshot`, `ReviewSnapshot`, and `SavedScenario` schemas are validated
- strategy fingerprint changes pause variance
- latest review wins for revised projection

### [x] Task 1.9: Add implementation-readiness review gate

After Stage 1 engine work, run an independent review focused on:
- safety cap enforcement
- ARVA target vs borrowable capacity
- ARVA guardrail recovery after safety override
- honest golden fixtures
- no input mutation
