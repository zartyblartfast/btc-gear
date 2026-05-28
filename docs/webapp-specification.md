# BTC Gear — Web Application Specification v1.0

## 1. Overview

**BTC Gear** is a client-side web application that models the long-term outcomes of using Bitcoin as collateral to borrow and accumulate more Bitcoin. The core bet: if BTC's price appreciation exceeds the cost of borrowing, the leveraged position generates excess return that can be withdrawn as income or reinvested to accumulate more BTC than simply holding.

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
  version: number;               // Schema version (starts at 2)
  btcHoldings: number;           // BTC
  currentBtcPrice: number;       // USD
  ltvTarget: number;             // 0.0 – 0.5
  borrowApr: number;             // 0.0975 – 0.1149
  originationFee: number;        // 0.0 – 0.02
  annualPlatformFee: number;     // 0.0 – 0.02
  marginCallLtv: number;         // default 0.70
  liquidationLtv: number;        // default 0.80
  safetyMargin: number;          // percentage points, default 0.10
  mode: 'Accumulation' | 'Income';
  withdrawalRule: 'Fixed $' | '% of excess';
  withdrawalAmount: number;      // dollars or fraction
  rebalanceRule: 'Maintain LTV' | 'Never Increase' | 'Dynamic';
  anchorPessimistic: number;     // 2030 price
  anchorMedian: number;          // 2030 price
  anchorOptimistic: number;      // 2030 price
  growthDecay: number;           // 0.0 – 0.5
  cycleAmplitude: number;        // 0.0 – 0.6
  amplitudeDecay: number;        // 0.0 – 0.3
  startYear: number;
  projectionLength: number;      // years
  showRealValues: boolean;
  inflationRate: number;
  scenario: 'pessimistic' | 'median' | 'optimistic'; // which price path to display
}

// ── Price Projection ──

interface PricePoint {
  year: number;
  trend: number;
  cycleMultiplier: number;
  price: number;
}

// ── Position Tracking ──

interface PositionRow {
  year: number;
  btcPrice: number;
  collateralBtc: number;
  collateralValue: number;
  outstandingDebt: number;
  newBorrowing: number;
  btcBoughtSold: number;
  totalLeveragedBtc: number;
  grossPositionValue: number;
  netEquityUsd: number;
  netEquityBtc: number;
  annualInterest: number;
  annualFee: number;
  totalAnnualCost: number;
  priceChange: number;
  appreciation: number;
  excessReturnUsd: number;
  excessReturnBtc: number;
  effectiveLtv: number;
  riskStatus: 'SAFE' | 'WARNING' | 'MARGIN CALL' | 'LIQUIDATED';
  liquidationYear: boolean;
}

// ── Income / Accumulation ──

interface IncomeRow {
  year: number;
  excessReturnBtc: number;
  incomeWithdrawn: number;
  btcSoldForIncome: number;
  remainingExcessUsd: number;
  remainingReinvestedBtc: number;
  cumulativeIncome: number;
  netBtcAfterWithdrawals: number;
  btcAccumulationMultiple: number;
  passiveHoldBtc: number;
  cumulativeOutperformance: number;
  sustainable: boolean;
}

// ── Summary ──

interface Summary {
  survived: boolean;
  liquidationYear: number | null;
  totalIncome: number;
  averageAnnualIncome: number;
  netBtcEnd: number;
  btcAccumulationMultiple: number;
  netWorthEnd: number;
  worstEffectiveLtv: number;
  yearsInWarningZone: number;
  maxDebt: number;
  totalInterest: number;
  netBtcAccumulated: number;
  // Real (inflation-adjusted) values
  realNetWorthEnd?: number;
  realTotalIncome?: number;
  realAverageIncome?: number;
  cumulativeDebtErosion?: number;
}

// ── Sensitivity ──

interface SensitivityPoint {
  ltv: number;
  survived: boolean;
  liquidationYear: number | null;
  excessReturnTotal: number;
  netBtcEnd: number;
  btcAccumulationMultiple: number;
  netWorthEnd: number;
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
| CAGR hits anchor exactly | `projectPrices` with anchor $500K → year 5 trend = $500,000 ± $1 |
| Cycle math at known angles | cos(π/2) = 0 → year 1 cycle multiplier = 1.0 |
| Year 0 debt calculation | 2 BTC, $75K, 35% LTV → debt = $52,500 |
| Year 0 total BTC | 2.7 BTC (original 2 + 0.7 borrowed) |
| Excess return after 1 year | Hand-computed value matches engine output |
| Liquidation triggers | Price drops to trigger → riskStatus = 'LIQUIDATED' |
| Income mode withdrawal | Mode='Income', 50% → income = 50% of excess |
| Accumulation mode | Mode='Accumulation' → income = $0, excess reinvested |
| Summary aggregation | 20-year totals match spreadsheet |
| LTV sensitivity | 50% LTV liquidates earlier than 10% LTV |
| Inflation adjustment | Real values match nominal / (1+inflation)^t |

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

## 11. References

- **Spreadsheet reference implementation:** `btc_leveraged_model.xlsx`
- **Model specification:** `specification.md` (in the same repository)
- **Platform defaults:** Ledn (ledn.io) — 50% max LTV, 70% margin call, 80% liquidation, 9.75%–11.49% APR tiered rates
- **Price anchors:** ARK Invest, Standard Chartered, Bernstein, Binance, CoinCodex, YouHodler (2024–2025 publications)
