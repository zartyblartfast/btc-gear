# BTC Gear

Bitcoin leveraged accumulation and retirement income projector. Borrow against BTC to acquire more — see how different LTV strategies play out over 20-year price scenarios. All calculations run in your browser. No accounts, no servers.

## Status

🚧 **Pre-alpha** — specification and planning phase.

## Documentation

- [Web App Product & Strategy Spec](docs/web-app/product-strategy-spec.md) — goals, user personas, strategy spectrum, pages, deployment stance
- [Web App Engine & Strategy Spec](docs/web-app/engine-and-strategy-spec.md) — canonical lifecycle, risk formulas, strategy rules
- [Review, Local-First Data & Dashboard Spec](docs/web-app/review-local-first-and-dashboard-spec.md) — review/rebaseline flow, profile export/import, dashboard charts
- [Web App Test Strategy](docs/web-app/test-strategy.md) — honest test layers, strategy concept tests, golden fixtures
- [Web App MVP Implementation Plan](docs/plans/web-app-mvp-implementation.md) — staged AI-coding plan
- [Spreadsheet v2 Model Spec](docs/spreadsheet-v2-model-specification.md) — formula-native workbook/reference model

## Architecture

> **Note:** The source tree shown below is planned. Implementation has not started yet.

```
btc-gear/
├── docs/                  # Specifications and documentation
├── src/
│   ├── engine/            # Pure calculation functions (no React)
│   │   ├── __tests__/     # Golden tests
│   │   │   └── fixtures/  # Test input/output pairs
│   │   ├── prices.ts
│   │   ├── position.ts
│   │   ├── income.ts
│   │   ├── summary.ts
│   │   ├── sensitivity.ts
│   │   └── types.ts
│   ├── components/        # React UI
│   │   ├── ConfigPanel/
│   │   ├── Charts/
│   │   └── Summary/
│   ├── hooks/
│   └── state/
└── public/
```

## Stack

React 18+ (Vite) · TypeScript (strict) · Recharts · Tailwind CSS · Vitest · Netlify

## Local Development

```bash
npm install
npm run dev      # Vite dev server
npm test         # Vitest (when tests exist)
npm run build    # Production build
```

## Build the spreadsheet

The canonical spreadsheet is generated from the v2 Python reference model:

```bash
uv run --with openpyxl python3 scripts/build_spreadsheet.py --output btc_leveraged_model_v2.xlsx
```

`scripts/build_spreadsheet.py` is a compatibility entrypoint that delegates to
`scripts/build_spreadsheet_v2.py`. The generated Inputs tab should show
`Max Available Annual Income (Year 1)` and `Selected Annual Income Draw`, not
the legacy `Annual Income Target` label.

The default price path is a flat base case. Edit `Current BTC Price` and
`Annual BTC Price Growth` on the Inputs tab to drive the Price Projection tab.

## Reference

Default borrowing parameters are calibrated to [Ledn](https://www.ledn.io/) — a Bitcoin-backed lending platform with over $10B in loan originations since 2018.

## License

MIT
