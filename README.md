# BTC Gear

Bitcoin leveraged accumulation and retirement income projector. Borrow against BTC, model income strategies, review actual BTC/debt outcomes, and compare what-if scenarios over forward price paths. The MVP is local-first: calculations and profile data stay in your browser unless you export and move them yourself.

## Status

MVP web app implemented through Dashboard, Strategy / Inputs, What If, Review, and local-first profile data foundations.

## Documentation

- [Web App Product & Strategy Spec](docs/web-app/product-strategy-spec.md) — goals, user personas, strategy spectrum, pages, deployment stance
- [Web App Engine & Strategy Spec](docs/web-app/engine-and-strategy-spec.md) — canonical lifecycle, risk formulas, strategy rules
- [Review, Local-First Data & Dashboard Spec](docs/web-app/review-local-first-and-dashboard-spec.md) — review/rebaseline flow, profile export/import, dashboard charts
- [Web App Test Strategy](docs/web-app/test-strategy.md) — honest test layers, strategy concept tests, golden fixtures
- [Web App MVP Implementation Plan](docs/plans/web-app-mvp-implementation.md) — staged AI-coding plan
- [Spreadsheet v2 Model Spec](docs/spreadsheet-v2-model-specification.md) — formula-native workbook/reference model

## Web app architecture

```text
src/
├── dashboard/       # Dashboard summary, chart, and tradeoff-map data helpers
├── engine/          # Pure strategy/risk/projection engine and golden fixtures
├── pages/           # React pages: Dashboard, Strategy, What If, Review, Profile
├── review/          # Review/rebaseline chart-data helpers
├── store/           # Local-first storage, profile, scenario, review, export helpers
└── whatif/          # What-if heatmap helpers
```

All strategy calculations live in pure TypeScript helpers under `src/engine`. React pages use injected/default local-first stores; components should not call `localStorage` directly.

## Stack

Vite · React · TypeScript strict · Recharts · Vitest · React Testing Library · Netlify

## Local development

```bash
npm install
npm run dev          # Vite dev server, usually http://localhost:5173
npm test -- --run    # one-shot Vitest suite
npm run build        # TypeScript check + production build
npm run preview      # serve the production build locally
```

If running the dev server on a VPS, keep it private and tunnel from your laptop:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
ssh -L 5173:127.0.0.1:5173 <user>@<vps-host>
```

Then open `http://localhost:5173` on the laptop.

## Build and deploy

Production build output goes to `dist/`.

```bash
npm run build
npm run preview
```

Netlify is configured by `netlify.toml`:

- build command: `npm run build`
- publish directory: `dist`
- SPA fallback: `/* -> /index.html`

For GitHub-connected Netlify deploys, set the build command and publish directory from `netlify.toml` or let Netlify detect them.

## Privacy and local-first data

btc-gear stores your holdings, debt, scenarios, reviews, and baseline data in this browser. They are not uploaded to a server by the app. Clearing browser/site data can delete your profile.

Use profile export/import to back up or move devices. Review saves also prompt you to export a backup so real-world review history is not stranded in one browser profile.

## Profile export/import

The profile export bundle is schema-versioned JSON containing:

- current config
- saved what-if scenarios
- review snapshots
- locked baseline, when present
- optional preferences

Imports validate the app marker, schema version, and required fields before accepting profile data. Keep exported files private: they contain financial position and debt information.

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
