# BTC Gear — Web Application Specification v1.0

## 1. Overview

**BTC Gear** is a client-side web application that models the long-term outcomes of using Bitcoin as collateral to borrow stablecoins and acquire more Bitcoin. If BTC's price appreciation exceeds the cost of borrowing, the leveraged position builds equity faster than simply holding. That equity can remain in the position to accumulate more BTC (via rebalancing) or can be partially withdrawn as retirement income by selling a portion of the leveraged gains.

The app replaces and extends the `btc_leveraged_model.xlsx` spreadsheet. All calculations run in the browser. No data leaves the user's device. No accounts, no servers, no analytics.

**Name rationale:** A gear ratio determines mechanical advantage — how much output you get per unit of input. LTV is the financial equivalent. Shifting gears (changing LTV) trades safety for amplification.

## 2. Architecture

### 2.1 Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18+ (Vite) | Component model, fast dev loop, ecosystem |
| Language | TypeScript (strict) | Type safety for financial calculations |
| Charts | Recharts | React-native, good for line/area charts |
| Styling | Tailwind CSS | Rapid UI, no CSS file management |
| State | React context + `useReducer` | Single config object, predictable updates |
| Persistence | `localStorage` (auto-save) + JSON file export/import | Local-first, zero server dependency |
| Testing | Vitest | Fast, Vite-native, Jest-compatible |
| Deployment | Netlify (GitHub auto-deploy) | Free tier, instant rollbacks, PR previews |
| CI | GitHub Actions | Run tests on every push and PR |

### 2.2 Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                       React App                           │
│                                                           │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ Config    │──▶│ Calculation  │──▶│ Results (typed)  │  │
│  │ Panel     │   │ Engine       │   │                  │  │
│  │ (inputs)  │   │ (pure fns)   │   │ • pricePath[]    │  │
│  │           │   │              │   │ • position[]     │  │
│  │  • sliders│   │ projectPrices│   │ • income[]       │  │
│  │  • toggles│   │ computePos   │   │ • summary        │  │
│  │  • number │   │ computeInc   │   │ • ltvSensitivity │  │
│  │  • preset │   │ computeSum   │   │                  │  │
│  │           │   │ ltvSensitivity│   └────────┬─────────┘  │
│  └─────┬─────┘   └──────┬───────┘            │            │
│        │                │                     ▼            │
│        ▼                │              ┌──────────────┐   │
│  ┌──────────┐           │              │ Charts        │   │
│  │localStor │◀──auto-save──▶           │ • Price       │   │
│  │(auto)    │                          │ • Position    │   │
│  └──────────┘                          │ • Income      │   │
│        │                               │ • LTV sweep   │   │
│        ▼                               │ • Summary     │   │
│  ┌──────────┐                          └──────────────┘   │
│  │JSON file │ (manual export/import)                       │
│  │.json     │                                              │
│  └──────────┘                                              │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Project Structure

```
btc-gear/
├── public/
│   └── favicon.svg
├── src/
│   ├── engine/                  # Pure calculation functions (NO React)
│   │   ├── prices.ts            # Price projection: trend + cycle
│   │   ├── position.ts          # Year-by-year leveraged position
│   │   ├── income.ts            # Income/accumulation tracking
│   │   ├── summary.ts           # Aggregate metrics
│   │   ├── sensitivity.ts       # LTV sweep (calls prices → position → summary)
│   │   ├── types.ts             # All TypeScript interfaces
│   │   └── __tests__/           # Golden tests
│   │       ├── prices.test.ts
│   │       ├── position.test.ts
│   │       ├── income.test.ts
│   │       ├── summary.test.ts
│   │       └── fixtures/        # JSON test fixtures (golden inputs/outputs)
│   ├── components/
│   │   ├── App.tsx
│   │   ├── ConfigPanel/
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── BTCSection.tsx
│   │   │   ├── BorrowSection.tsx
│   │   │   ├── ModeSection.tsx
│   │   │   ├── PriceAnchors.tsx
│   │   │   ├── InflationSection.tsx
│   │   │   ├── RiskPresets.tsx
│   │   │   ├── SaveLoad.tsx
│   │   │   └── ConfigPanel.test.tsx
│   │   ├── Charts/
│   │   │   ├── PriceChart.tsx
│   │   │   ├── PositionChart.tsx
│   │   │   ├── IncomeChart.tsx
│   │   │   └── LTVSensitivityChart.tsx
│   │   └── Summary/
│   │       └── SummaryMetrics.tsx
│   ├── state/
│   │   ├── configReducer.ts     # useReducer for config state
│   │   ├── configDefaults.ts    # Default values (Ledn-calibrated)
│   │   ├── configStore.ts       # localStorage read/write + JSON export/import
│   │   └── configValidation.ts  # Validate imported JSON
│   ├── hooks/
│   │   ├── useProjection.ts     # Calls engine, returns typed results
│   │   └── useSensitivity.ts    # LTV sweep
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── vitest.config.ts
├── netlify.toml
└── README.md
```

## 3. Calculation Engine (Pure Functions)

The engine is the heart of the application. Every function is pure: same inputs → same outputs. No side effects, no DOM access, no randomness. This makes the engine testable in isolation.

### 3.1 Type Definitions (`types.ts`)

```typescript
// ── Input Configuration ──

interface Config {
  version: number;               // Schema version. Starts at 2 because v1 was the
                                 // spreadsheet; v2 is the first web-app schema.
  btcHoldings: number;           // BTC, > 0
  currentBtcPrice: number;       // USD, > 0
  ltvTarget: number;             // 0.0 – 0.5 (Ledn max). App default: 0.35 (Standard).
  borrowApr: number;             // 0.0975 – 0.1149 (Ledn tiered range)
  originationFee: number;        // 0.0 – 0.02
  annualPlatformFee: number;     // 0.0 – 0.02
  marginCallLtv: number;         // default 0.70 (Ledn)
  liquidationLtv: number;        // default 0.80 (Ledn)
  safetyMargin: number;          // percentage points, default 0.10
  mode: 'Accumulation' | 'Income';
  withdrawalRule: 'Fixed $' | '% of equity gain';
  withdrawalAmount: number;      // dollars (if Fixed $) or fraction (if %)
  rebalanceRule: 'Maintain LTV' | 'Never Increase' | 'Dynamic';
  anchorPessimistic: number;     // 2030 trend-line price, > 0
  anchorMedian: number;          // 2030 trend-line price, > 0
  anchorOptimistic: number;      // 2030 trend-line price, > 0
  growthDecay: number;           // 0.0 – 0.5
  cycleAmplitude: number;        // 0.0 – 0.6. Must be < 1.0 so normalized multiplier stays positive.
  amplitudeDecay: number;        // 0.0 – 0.3
  startYear: number;             // integer ≥ 2009
  projectionLength: number;      // integer 1–50
  showRealValues: boolean;
  inflationRate: number;         // −0.10 – 0.20 (allows deflation)
  scenario: 'pessimistic' | 'median' | 'optimistic';
  // NOTE: borrowCurrency is intentionally absent from v2.
  // Only stablecoin/USD borrowing is supported (matches Ledn and most platforms).
  // BTC-denominated borrowing is out of scope for v2.
}

// ── Price Projection ──

interface PricePoint {
  year: number;
  trend: number;                 // Trend-line price (Phase 1 or Phase 2 CAGR)
  cycleMultiplier: number;      // Normalized: t=0 always equals 1.0
  price: number;                // trend × cycleMultiplier
}

// ── Position Tracking (one row per projection year) ──

interface PositionRow {
  year: number;
  // Price
  btcPrice: number;
  // Collateral (original BTC only; purchased BTC is NOT collateral)
  collateralBtc: number;
  collateralValue: number;       // collateralBtc × btcPrice
  // Debt
  targetLtv: number;
  outstandingDebt: number;       // Start of year (before interest + rebalancing)
  newBorrowing: number;          // Additional borrowed this year (rebalancing)
  btcBoughtFromRebalancing: number;  // newBorrowing ÷ btcPrice
  // Position
  totalLeveragedBtc: number;     // collateralBtc + cumulative purchased BTC
  grossPositionValue: number;    // totalLeveragedBtc × btcPrice
  netEquityUsd: number;         // grossPositionValue − outstandingDebt
  netEquityBtc: number;         // netEquityUsd ÷ btcPrice (after debt)
  // Costs
  annualInterest: number;       // outstandingDebt(start) × borrowApr
  annualFee: number;            // collateralValue × annualPlatformFee (+ origination in year 0)
  totalAnnualCost: number;      // interest + fee
  // Year-over-year changes
  priceChange: number;           // btcPrice(t) − btcPrice(t−1)
  equityGainUsd: number;        // Mark-to-market: netEquityUsd(t) − netEquityUsd(t−1)
                                 // NOT a cashflow. Changes paper wealth, not BTC quantity.
  // Risk
  effectiveLtv: number;          // outstandingDebt(after rebalance) ÷ collateralValue
  marginCallThreshold: number;
  liquidationThreshold: number;
  safetyBuffer: number;          // liquidationThreshold − effectiveLtv (pp)
  riskStatus: 'SAFE' | 'WARNING' | 'MARGIN CALL' | 'LIQUIDATED';
  renewalRisk: boolean;         // true if LTV exceeds margin call threshold at year end
  suggestedLtv: number;         // Model's recommended LTV for next year
}

// ── Income / Accumulation ──

interface IncomeRow {
  year: number;
  // Wealth tracking
  equityGainUsd: number;        // From PositionRow — mark-to-market gain this year
  // Income mode only
  incomeWithdrawn: number;      // $0 if Accumulation mode or equityGainUsd < 0
  btcSoldForIncome: number;     // incomeWithdrawn ÷ btcPrice
  cumulativeIncome: number;     // Running total
  sustainable: boolean;         // true if incomeWithdrawn ≤ equityGainUsd and equityGainUsd > 0
  // Accumulation mode only
  btcFromRebalancing: number;   // BTC bought with new borrowing this year
  totalLeveragedBtc: number;    // End-of-year after rebalancing
  // Both modes
  netBtcAfterWithdrawals: number; // After selling for income (if Income) or after rebalancing (if Accum)
  btcAccumulationMultiple: number; // netBtc / startingBtc
  passiveHoldBtc: number;       // Constant = config.btcHoldings
  cumulativeBtcOutperformance: number; // netBtc − passiveHoldBtc
}

// ── Summary (one selected scenario + mode at a time) ──
// The web app summarizes ONE scenario/mode combination. The spreadsheet
// Summary tab covers all three scenarios — the web app equivalent is the
// scenario selector dropdown that recomputes the summary for the selected
// scenario. Multi-scenario comparison is deferred to v2.

interface Summary {
  survived: boolean;
  liquidationYear: number | null;
  totalIncome: number;           // $0 if Accumulation mode
  averageAnnualIncome: number;
  netBtcEnd: number;
  btcAccumulationMultiple: number;
  netWorthEnd: number;
  netWorthPassiveHold: number;   // What passive hold would be worth
  worstEffectiveLtv: number;
  yearsInWarningZone: number;    // Count of WARNING + MARGIN CALL + LIQUIDATED years
  maxDebt: number;
  totalInterest: number;
  netBtcAccumulated: number;     // netBtcEnd − startingBtc
  equityGainTotal: number;       // Sum of all annual equity gains
  // Real (inflation-adjusted) values — present iff config.showRealValues
  realNetWorthEnd?: number;
  realTotalIncome?: number;
  realAverageIncome?: number;
  cumulativeDebtErosion?: number; // Total inflation-driven debt reduction
}

// ── LTV Sensitivity Sweep ──

interface SensitivityPoint {
  ltv: number;
  survived: boolean;
  liquidationYear: number | null;
  netBtcEnd: number;
  btcAccumulationMultiple: number;
  netWorthEnd: number;
  equityGainTotal: number;
  worstEffectiveLtv: number;
}
```

### 3.2 Function Signatures

```typescript
// prices.ts
function projectPrices(config: Config): PricePoint[]
  // Generates 3 scenarios internally; returns the selected one

// position.ts  
function computePosition(config: Config, prices: PricePoint[]): PositionRow[]

// income.ts
function computeIncome(
  config: Config,
  positions: PositionRow[]
): IncomeRow[]

// summary.ts
function computeSummary(
  config: Config,
  positions: PositionRow[],
  income: IncomeRow[]
): Summary

// sensitivity.ts — runs projection for each LTV in sweep
function ltvSensitivity(
  config: Config,
  ltvRange: number[]   // e.g. [0.10, 0.15, 0.20, ..., 0.50]
): SensitivityPoint[]
```

### 3.3 Golden Tests

Each engine function has a corresponding test file with **golden test fixtures** — known input/output pairs derived from the verified spreadsheet.

Tests validate:

| Test | What it proves |
|------|---------------|
| CAGR hits anchor exactly | Trend(5) = anchor_median ± $1 |
| Normalized cycle at t=0 | Year 0 price = current BTC price exactly |
| Year 0 debt calculation | 2 BTC, $75K, 35% LTV → debt = $52,500 |
| Year 0 total BTC | 2.7 BTC (2 original + 0.7 borrowed) |
| Year 1 equity gain | Hand-computed from spreadsheet: appreciation − interest |
| Year 1 BTC from rebalancing | BTC grows only via new borrowing, not from appreciation |
| Liquidation triggers | Price drops to liquidation threshold → riskStatus = 'LIQUIDATED' |
| Income mode withdrawal | 50% of equity gain → income = 0.5 × equity gain. $0 if equity gain negative. |
| Accumulation mode | income = $0, BTC grows via rebalancing only |
| Summary aggregation | 20-year totals match spreadsheet |
| LTV sensitivity | 50% LTV liquidates earlier than 10% LTV |
| Inflation adjustment | Real USD values = nominal / (1+inflation)^t; BTC values NOT adjusted |

## 4. UI Components

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  BTC Gear                               [Save] [Load]   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  CONFIG      │  CHARTS                                  │
│  PANEL       │                                          │
│              │  ┌─ [Price] [Position] [Income] [LTV] ─┐ │
│  BTC         │  │                                      │ │
│  Holdings    │  │         Active Chart                 │ │
│  Price       │  │                                      │ │
│              │  │                                      │ │
│  Borrow      │  └──────────────────────────────────────┘ │
│  LTV ───●──  │                                          │
│  APR         │  ┌─ Scenario: [Pess] [Med] [Opt] ──────┐ │
│  MargCall%   │  │ Summary Metrics                     │ │
│  Liq%        │  │                                      │ │
│              │  │ Net BTC | Income | LTV | Interest    │ │
│  Mode        │  │                                      │ │
│  [Accum]     │  └──────────────────────────────────────┘ │
│  [Income]    │                                          │
│              │                                          │
│  Anchors     │                                          │
│  Pess $100K  │                                          │
│  Med  $500K  │                                          │
│  Opt  $1M    │                                          │
│              │                                          │
│  Inflation   │                                          │
│  [x] Show    │                                          │
│  Rate 3%     │                                          │
│              │                                          │
│  Risk Profile│                                          │
│  [Consv]     │                                          │
│  [Mod] [Std] │                                          │
│  [Aggr]      │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  Footer: Built with React · Calculations local · No data │
│  leaves your browser                                     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Config Panel

Left sidebar, scrollable. Sections:

1. **BTC Position** — two number inputs (Holdings, Current Price)
2. **Borrowing Parameters** — LTV slider (0–50%) with margin call/liquidation markers, APR input, margin call %, liquidation %, safety margin
3. **Risk Profile Presets** — 4 buttons (Conservative 10%, Moderate 25%, Standard 35%, Aggressive 50%). Clicking one sets LTV and shows the corresponding liquidation trigger price.
4. **Mode** — toggle between Accumulation and Income. When Income is selected, show withdrawal rule dropdown and amount input.
5. **Price Anchors** — three number inputs for 2030 anchors (Pessimistic, Median, Optimistic), plus advanced section for growth decay, cycle amplitude, amplitude decay
6. **Inflation** — toggle + number input
7. **Projection Length** — number input (1–50 years) + scenario selector for which price path feeds the main charts

### 4.3 Save/Load

Two buttons in the header:

- **Save** — triggers browser download of `btc-gear-config-YYYY-MM-DD.json`. File contains the full `Config` object.
- **Load** — file picker that accepts `.json` files. Validates structure before loading. Shows error if invalid.

Additional behavior:
- `localStorage` auto-saves on every config change (debounced 500ms)
- On app load, restores from `localStorage` if present
- `localStorage` key: `btc-gear-config`
- JSON file includes `version` field. Future versions can migrate old configs.

### 4.4 Charts

Four chart tabs, selectable via tabs above the chart area:

| Tab | Chart | Description |
|-----|-------|-------------|
| **Price** | Line chart | Median price path + trend line. Three-scenario toggle to overlay all 3. |
| **Position** | Dual-axis line | Net equity (USD) and effective LTV over time. LTV line has warning/liquidation threshold markers. |
| **Income** | Bar + line | Annual income withdrawn (bars) + cumulative income (line). Hidden in Accumulation mode. |
| **LTV Sensitivity** | Scatter/line | Terminal net BTC vs LTV (x-axis). Each point = one LTV value. Red = liquidated before year 20, green = survived. Hover shows liquidation year. |

**LTV Sensitivity Chart details:**
- X-axis: LTV from 5% to 50% in 5% steps (10 data points)
- Y-axis: Net BTC at end of projection (or at liquidation)
- Color: green dots survived full term, red dots liquidated
- Tooltip on hover: LTV, net BTC, liquidation year (if applicable), worst LTV reached
- Passive hold reference line at 2.0 BTC
- This chart is the most valuable for decision-making — it instantly shows the risk/reward frontier

### 4.5 Summary Metrics

Below the charts, a grid of key metrics:

| Left column | Right column |
|-------------|-------------|
| Starting BTC | Net BTC at end |
| Starting net worth | Net worth at end |
| Survived full term? | vs passive hold |
| Years in warning zone | Worst effective LTV |
| Total income (income mode) | Average annual income |
| Total interest paid | Max debt carried |
| BTC accumulation multiple | Net BTC accumulated |

If real values are enabled, a second row of inflation-adjusted equivalents appears below.

## 5. Configuration Persistence

### 5.1 localStorage

- Key: `btc-gear-config`
- Updated on every config change (debounced to 500ms to avoid excessive writes)
- Restored on app mount
- If no stored config exists, use defaults

### 5.2 JSON Export

```json
{
  "version": 2,
  "exportedAt": "2026-05-28T14:30:00Z",
  "btcHoldings": 2.0,
  "currentBtcPrice": 75000,
  "ltvTarget": 0.35,
  "borrowApr": 0.1149,
  "originationFee": 0.0,
  "annualPlatformFee": 0.0,
  "marginCallLtv": 0.70,
  "liquidationLtv": 0.80,
  "safetyMargin": 0.10,
  "mode": "Accumulation",
  "withdrawalRule": "% of excess",
  "withdrawalAmount": 0.50,
  "rebalanceRule": "Maintain LTV",
  "anchorPessimistic": 100000,
  "anchorMedian": 500000,
  "anchorOptimistic": 1000000,
  "growthDecay": 0.30,
  "cycleAmplitude": 0.40,
  "amplitudeDecay": 0.15,
  "startYear": 2025,
  "projectionLength": 20,
  "showRealValues": true,
  "inflationRate": 0.03,
  "scenario": "median"
}
```

### 5.3 JSON Import

1. User clicks Load → file picker opens
2. File parsed as JSON
3. Validation function checks:
   - All required keys present
   - All values are correct types
   - Numeric values within valid ranges
   - Enum values match allowed options
4. If valid: load config into state, save to localStorage
5. If invalid: show error message with specific field issues

### 5.4 Version Migration

```typescript
function migrate(config: Record<string, unknown>): Config {
  const version = (config.version as number) || 1;
  
  if (version === 1) {
    // v1 → v2: added margin call LTV, renamed some fields
    config = migrateV1toV2(config);
  }
  
  return config as Config;
}
```

## 6. Default Values (Ledn-Calibrated)

All defaults match the Ledn platform as of May 2026:

| Parameter | Default |
|-----------|---------|
| btcHoldings | 2.0 BTC |
| currentBtcPrice | $75,000 |
| ltvTarget | 35% |
| borrowApr | 11.49% |
| originationFee | 0% |
| annualPlatformFee | 0% |
| marginCallLtv | 70% |
| liquidationLtv | 80% |
| safetyMargin | 10 pp |
| mode | Accumulation |
| withdrawalRule | % of excess |
| withdrawalAmount | 50% |
| rebalanceRule | Maintain LTV |
| anchorPessimistic | $100,000 |
| anchorMedian | $500,000 |
| anchorOptimistic | $1,000,000 |
| growthDecay | 30% |
| cycleAmplitude | 40% |
| amplitudeDecay | 15% |
| startYear | 2025 |
| projectionLength | 20 |
| showRealValues | true |
| inflationRate | 3% |
| scenario | median |

## 7. Testing Strategy

### 7.1 Golden Tests (Engine)

- Extract known input/output pairs from the verified spreadsheet
- Store as JSON fixtures in `src/engine/__tests__/fixtures/`
- Each engine function test loads the fixture, runs the function, and asserts exact output match
- Run before every commit via Git hooks and in CI

### 7.2 Unit Tests (Components)

- Config panel: changing a slider updates state correctly
- Save/Load: invalid JSON produces error message
- Risk presets: clicking a preset sets the correct LTV value
- Charts: verify correct data shape is passed to Recharts components

### 7.3 Integration Tests

- Full projection with default config produces >0 excess return
- Changing LTV from 10% to 50% changes liquidation risk status
- Income mode produces non-zero income values
- Switching scenarios changes price paths

### 7.4 CI Pipeline

```yaml
# .github/workflows/test.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test -- --coverage
      - run: npm run build
```

## 8. Deployment

### 8.1 Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 8.2 Deployment Flow

1. Push to `main` → Netlify auto-deploys production
2. PR → Netlify creates preview deploy with unique URL
3. Preview URLs shared for review before merge

### 8.3 Environment

- No environment variables needed (no API keys, no backend)
- Build output: static HTML + JS + CSS bundle (~200KB gzipped)
- Serves from CDN edge nodes worldwide

## 9. What the App Does NOT Do

- No user accounts or authentication
- No server-side computation or data storage
- No analytics, tracking, or telemetry
- No API calls to external services
- No live BTC price feeds (user enters price manually)
- No platform comparison (Ledn is the reference platform; user adjusts inputs for others)
- No tax calculations
- No Monte Carlo simulation
- No recursive/looping leverage modeling

## 10. Development Phases

### Phase 1: Engine + Tests (days 1–2)
- Implement `types.ts`, `prices.ts`, `position.ts`, `income.ts`, `summary.ts`, `sensitivity.ts`
- Write golden tests against spreadsheet-verified values
- Achieve 100% test coverage on engine

### Phase 2: Core UI (days 3–4)
- Config panel with all inputs
- `localStorage` persistence
- JSON export/import
- Basic chart rendering (Price + Position)

### Phase 3: Full Charts + Polish (days 5–6)
- Income chart
- LTV Sensitivity chart
- Summary metrics display
- Risk profile presets
- Scenario switching
- Responsive layout

### Phase 4: Deployment + Docs (day 7)
- Netlify setup
- README with usage instructions
- Deploy and share

## 11. Accessibility Requirements

- All form inputs have associated `<label>` elements (visible or `aria-label`)
- Keyboard navigation: Tab through inputs, Enter/Space to activate toggles and dropdowns
- Visible focus states on all interactive elements (custom `:focus-visible` ring)
- Risk status is conveyed by BOTH color and text label (never color alone)
- Charts are accompanied by data summary tables (hidden but screen-reader accessible)
- Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- Error messages announced via `aria-live` region

## 12. Responsive Layout Requirements

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1024px) | Sidebar config panel (320px fixed) + main chart area |
| Tablet (768–1023px) | Collapsible sidebar (hamburger toggle) + full-width charts |
| Mobile (<768px) | Stacked: config section scrolls above charts. Charts full-width. Summary as cards. |

Charts resize to container width. Config panel inputs use full-width on mobile for easier touch targets.

## 13. Error and Empty States

| State | Behavior |
|-------|----------|
| Invalid input (out of range) | Inline validation message below the field. Field border turns red. |
| Liquidation reached | Chart ends at liquidation year. Summary shows "FAILED — Year X". Income columns grayed out. |
| Negative BTC price (bad cycle settings) | Clamp to $1. Show warning: "Cycle amplitude too high — prices clamped." |
| JSON import failure | Modal/notification with specific error: which field failed and why. Config unchanged. |
| localStorage parse failure | Silent fallback to defaults. Console warning logged. |
| Chart has no valid data | Show placeholder: "No data to display — adjust inputs." |
| First load (no saved config) | Load defaults. No error. |

## 14. Disclaimers

The application must prominently display (footer or dedicated section):

- This tool is for **educational purposes only**. It does not constitute financial advice, investment recommendations, or tax advice.
- All projections are based on **user-provided assumptions**. Actual results will differ.
- **Leveraged BTC positions carry risk of total loss** through liquidation.
- **Platform risk is not modeled.** Counterparty failure can result in collateral loss.
- **Tax implications are not modeled.** Consult a tax professional.

## 15. Review Accountability — Remaining Items

The following items from the specification review (2026-05-28) have been noted
but not yet implemented in either spec. They are tracked for the pre-development
hardening pass.

| Review item | Status | Reasoning |
|-------------|--------|-----------|
| Item 13: Formal per-field formula specs for computePosition | Deferred | Column tables exist; exact formulas will be extracted from spreadsheet cells during engine implementation and documented in code comments |
| Item 14: Formal per-field formula specs for computeIncome | Deferred | Same as above — derived from spreadsheet during implementation |
| Item 12: Canonical default Config JSON/TS object | Deferred | Defaults table exists (§6). The actual `defaultConfig` export will be created as `configDefaults.ts` during Phase 1 implementation |
| Item 10: Actual fixture JSON files | Deferred | Fixture names specified (§17 of spreadsheet spec). Files created during Phase 1 alongside golden tests |
| Item 24: "Simple interest" vs "compounding debt" wording | Acknowledged | Interest is simple (debt × APR, not compounded). But interest is ADDED to debt, so debt grows year-over-year. The spreadsheet spec §9 wording updated to clarify this |
| Item 25: 56% emergency threshold justification | Acknowledged | 56% = 80% of the 70% margin call threshold. Arbitrary safety heuristic. Will be made user-configurable in v2 |
| Item 26: Single-scenario vs multi-scenario summary | Acknowledged | Web app summarizes one scenario at a time (through scenario selector). Multi-scenario comparison deferred to v2. Clarified in Summary type comment (§3.1) |

## 16. References

- **Spreadsheet reference model:** `docs/spreadsheet-specification.md` (in this repository)
- **Web app specification:** `docs/webapp-specification.md` (this document)
- **Reference spreadsheet:** `btc_leveraged_model.xlsx` (not in repo; available on request for fixture generation)
- **Platform defaults:** Ledn (ledn.io) — 50% max LTV, 70% margin call, 80% liquidation, 9.75%–11.49% APR tiered rates
- **Price anchors:** ARK Invest, Standard Chartered, Bernstein, Binance, CoinCodex, YouHodler (2024–2025 publications)
