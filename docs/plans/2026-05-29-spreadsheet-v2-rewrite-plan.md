# BTC-Backed Loan Spreadsheet v2 Rewrite Plan

> For Hermes: use subagent-driven-development for implementation tasks where useful. Use Codex CLI for larger mechanical refactors after the spec/tests are stable, not for deciding financial logic.

Goal: Rebuild the spreadsheet around two separate strategy engines: recursive BTC accumulation and borrow-funded income.

Architecture: The v2 source of truth is a written spec plus a pure Python reference model with tests. The Excel workbook is generated from the reference design and must expose separate Accumulation and Income engine tabs rather than a single mode-sensitive lifecycle.

Tech Stack: Python 3.12, openpyxl, pytest via uv, optional LibreOffice headless if available for workbook formula verification.

Related spec: docs/spreadsheet-v2-model-specification.md

---

## Guiding decision

Do not patch the current financial model in-place. Keep the current script as formatting/reference scaffolding only. Rewrite the model/spec/tests around v2.

Salvage:
- openpyxl workbook setup patterns
- styling helpers
- price projection concepts
- risk threshold labels
- high-level Summary/Charts presentation ideas

Rewrite:
- Inputs semantics
- Rebalancing enums
- Leveraged Position tab
- Income-Accumulation tab
- Summary formulas
- debt/collateral lifecycle
- income model

---

## Task 1: Create v2 reference model package skeleton

Objective: Add a testable Python model layer independent of Excel.

Files:
- Create: model_v2/__init__.py
- Create: model_v2/types.py
- Create: model_v2/prices.py
- Create: model_v2/accumulation.py
- Create: model_v2/income.py
- Create: model_v2/risk.py
- Create: tests/test_v2_audit_examples.py

Steps:
1. Create package and empty modules.
2. Define dataclasses/enums in types.py:
   - BorrowTerms
   - RiskThresholds
   - PricePoint
   - AccumulationConfig
   - AccumulationRow
   - IncomeConfig
   - IncomeRow
3. Add placeholder tests for audit examples marked xfail or asserting functions are not implemented yet.
4. Run:
   - uv run --with pytest pytest tests/test_v2_audit_examples.py -q
5. Expected initially: controlled failures/xfails only.

Commit message:
- feat: add v2 model package skeleton

---

## Task 2: Implement shared risk formulas with tests

Objective: Validate effective LTV, debt BTC equivalent, net BTC after debt, margin-call price, and liquidation price.

Files:
- Modify: model_v2/risk.py
- Modify: tests/test_v2_audit_examples.py

Required formulas:

```python
effective_ltv = debt_usd / (collateral_btc * btc_price)
debt_btc_equivalent = debt_usd / btc_price
net_btc_after_debt = total_btc - debt_usd / btc_price
margin_call_price = debt_usd / (collateral_btc * margin_call_ltv)
liquidation_price = debt_usd / (collateral_btc * liquidation_ltv)
```

Test cases:
- Sats-style example: 2.66666667 BTC collateral, $40,000 debt, $60,000 BTC price, 75% liquidation threshold => liquidation price $20,000.
- Zero debt returns zero LTV and zero liquidation/margin prices.
- Invalid zero collateral raises ValueError for LTV/price calculations.

Run:
- uv run --with pytest pytest tests/test_v2_audit_examples.py -q

Commit message:
- test: cover v2 risk formulas

---

## Task 3: Implement recursive accumulation setup

Objective: Model the year-0 recursive leverage setup using target effective LTV or leverage multiple.

Files:
- Modify: model_v2/accumulation.py
- Modify: model_v2/types.py
- Modify: tests/test_v2_audit_examples.py

Required formulas:

```python
target_ltv = 1 - 1 / leverage_multiple
final_collateral_btc = starting_btc / (1 - target_ltv)
debt_usd = target_ltv * final_collateral_btc * btc_price
btc_purchased = final_collateral_btc - starting_btc
```

Test:
- starting_btc=2, price=60000, target_ltv=0.25:
  - final collateral 2.66666667
  - purchased 0.66666667
  - debt 40000
  - effective LTV 0.25
  - liquidation price 20000 at 75% liquidation LTV

Run:
- uv run --with pytest pytest tests/test_v2_audit_examples.py -q

Commit message:
- feat: implement recursive accumulation setup

---

## Task 4: Implement annual accumulation lifecycle

Objective: Produce year-by-year accumulation rows after setup.

Files:
- Modify: model_v2/accumulation.py
- Modify: model_v2/types.py
- Create: tests/test_v2_accumulation.py

Timing convention:
- Year 0/setup is a separate row using current BTC price.
- Annual rows accrue interest only on debt outstanding at the start of the row.
- New borrowing in a row begins accruing interest in the following row.

Lifecycle:
1. Carry forward collateral BTC, total BTC, and debt.
2. Accrue interest.
3. Compute pre-action LTV and liquidation price.
4. If safe and below target, borrow recursively to target effective LTV:

```python
borrow = max(0, (target_ltv * collateral_btc * price - debt_after_interest) / (1 - target_ltv))
btc_bought = borrow / price
collateral_btc_end = collateral_btc + btc_bought
debt_end = debt_after_interest + borrow
```

5. If above threshold, flag warning; do not auto-sell by default.
6. Compute ending metrics.

Tests:
- Price up year creates borrowing and BTC purchase if below target.
- Price down year creates no new borrowing and raises warning if buffer narrows.
- Capitalized interest increases debt.
- Paid-external interest does not increase debt but reports external interest.
- Borrowing uses `min(target_ltv, max_effective_ltv, liquidation_ltv * (1 - minimum_liquidation_buffer))`.
- Recursive accumulation keeps `total_btc_end == collateral_btc_end` for initial v2.

Run:
- uv run --with pytest pytest tests/test_v2_accumulation.py tests/test_v2_audit_examples.py -q

Commit message:
- feat: implement v2 accumulation lifecycle

---

## Task 5: Implement borrow-funded income lifecycle

Objective: Model annual income funded by borrowing stablecoins against BTC collateral.

Files:
- Modify: model_v2/income.py
- Modify: model_v2/types.py
- Create: tests/test_v2_income.py

Lifecycle:
1. Carry forward collateral BTC and debt.
2. Accrue interest.
3. Compute max safe debt as the minimum of the LTV ceiling and liquidation-buffer ceiling:

```python
ltv_limit_debt = collateral_btc * price * income_ltv_ceiling
buffer_limit_debt = collateral_btc * price * liquidation_ltv * (1 - minimum_liquidation_buffer)
max_safe_debt = min(ltv_limit_debt, buffer_limit_debt)
available_capacity = max(0, max_safe_debt - debt_after_interest)
income_borrowed = min(requested_income, available_capacity)
unfunded_income = requested_income - income_borrowed
debt_end = debt_after_interest + income_borrowed
```

4. BTC is unchanged by default.
5. Compute risk and sustainability status.

Tests:
- Income capacity example from spec:
  - 2 BTC, $100k price, $30k debt, 35% ceiling, $50k requested -> $40k funded, $10k unfunded, $70k debt end.
- Liquidation-buffer constraint limits income even when the LTV ceiling alone would allow more borrowing.
- Full income funded when capacity is enough.
- No income funded when debt after interest already exceeds ceiling.
- Capitalized vs externally paid interest.
- Status precedence: LIQUIDATED > MARGIN CALL > WARNING > CONSTRAINED > FAILED > SAFE.

Run:
- uv run --with pytest pytest tests/test_v2_income.py tests/test_v2_audit_examples.py -q

Commit message:
- feat: implement v2 income lifecycle

---

## Task 6: Build v2 workbook generator scaffold

Objective: Create a new spreadsheet builder instead of mutating the old one in place.

Files:
- Create: scripts/build_spreadsheet_v2.py
- Optionally modify: README.md to mention v2 draft builder

Requirements:
- Output path configurable:

```bash
uv run --with openpyxl python3 scripts/build_spreadsheet_v2.py --output generated-v2.xlsx
```

- Create tabs:
  - Inputs
  - Price Projection
  - Accumulation Engine
  - Income Engine
  - Risk & Alerts
  - Summary
  - Audit Examples

- Use Linux-safe default output path:
  - generated-v2.xlsx

- Do not include Windows-specific sys.path hacks.

Run:
- uv run --with openpyxl python3 scripts/build_spreadsheet_v2.py --output generated-v2.xlsx

Expected:
- generated-v2.xlsx exists
- openpyxl can reopen it
- required sheet names exist

Commit message:
- feat: scaffold v2 spreadsheet generator

Codex suitability: high. This is a good Codex task after Tasks 1-5 define the model and tests.

---

## Task 7: Generate v2 workbook formulas from reference model structure

Objective: Populate Excel formulas matching the v2 spec.

Files:
- Modify: scripts/build_spreadsheet_v2.py
- Create: tests/test_v2_workbook_structure.py

Requirements:
- Inputs tab uses named/centralized cell references.
- Accumulation Engine mirrors v2 lifecycle.
- Income Engine mirrors v2 lifecycle.
- Risk & Alerts summarizes both engines.
- Summary pulls from engine tabs only; no hidden mode switch.
- Audit Examples tab displays expected values and workbook formula outputs.

Verification:
- Generate workbook.
- Reopen with openpyxl.
- Check formulas exist in expected cells.
- Check sheet dimensions and headers.

Run:
- uv run --with pytest --with openpyxl pytest tests/test_v2_workbook_structure.py -q
- uv run --with openpyxl python3 scripts/build_spreadsheet_v2.py --output generated-v2.xlsx

Commit message:
- feat: generate v2 workbook formulas

Codex suitability: medium/high. Use Codex for mechanical formula generation only after controller writes exact formula map.

---

## Task 8: Validate workbook against audit examples

Objective: Confirm visible workbook examples match the spec.

Files:
- Modify: tests/test_v2_workbook_structure.py
- Possibly create: tests/test_v2_workbook_audit.py

Approach:
- If LibreOffice is available, use headless calculation:

```bash
libreoffice --headless --convert-to xlsx --outdir /tmp generated-v2.xlsx
```

- If not available, validate formulas structurally with openpyxl and validate Python reference outputs numerically.

Required checks:
- Audit Examples tab contains Sats-style $40k / 2.66666667 BTC / 25% LTV / $20k liquidation price example.
- Income capacity example values are present.
- Summary references engine outputs, not old mode-sensitive formulas.

Run:
- uv run --with pytest --with openpyxl pytest tests/ -q

Commit message:
- test: validate v2 workbook audit examples

---

## Task 9: Final review and deprecate old artifacts

Objective: Make it clear which files are v1 and which are v2.

Files:
- Modify: README.md
- Optionally rename: scripts/build_spreadsheet.py -> scripts/build_spreadsheet_v1.py, only if acceptable
- Modify: docs/spreadsheet-specification.md or add a header pointing to v2 draft

Requirements:
- README explains v2 status.
- Old spreadsheet spec is marked superseded if v2 is accepted.
- Old generated workbook artifacts are not accidentally committed.

Run:
- git status --short
- uv run --with pytest --with openpyxl pytest tests/ -q
- uv run --with openpyxl python3 scripts/build_spreadsheet_v2.py --output generated-v2.xlsx

Commit message:
- docs: mark spreadsheet v2 as active rewrite

---

## Subagent / Codex usage plan

Use Hermes delegate_task subagents for:
- spec review,
- formula review,
- code quality review,
- final integration review.

Use Codex CLI for:
- mechanical implementation of the model package after tests/spec are clear,
- workbook generator scaffold,
- repetitive formula/header wiring.

Do not use Codex as the authority for financial logic. The controller should provide exact formulas from the v2 spec and then review the output.

Suggested first Codex task after this plan:

```bash
codex exec --full-auto 'Implement Tasks 1 and 2 from docs/plans/2026-05-29-spreadsheet-v2-rewrite-plan.md only. Follow the spec in docs/spreadsheet-v2-model-specification.md. Add tests for risk formulas and run them. Do not modify the old build_spreadsheet.py.'
```

---

## Final acceptance criteria

- v2 spec exists and is internally coherent.
- Python model tests pass with no unexpected xfail/skip.
- Generated v2 workbook exists.
- Workbook has separate Accumulation and Income engine tabs.
- Audit examples are visible.
- Summary clearly reports strategy-vs-passive deltas.
- Old v1/v3 logic is either deprecated or untouched as a historical reference.
- Numerical tolerances are enforced: BTC within 1e-8, USD within $0.01 for reference tests, LTV within 0.0001.
- Formula verification is either calculated with LibreOffice headless or structurally checked against expected formula strings generated from the formula map.
