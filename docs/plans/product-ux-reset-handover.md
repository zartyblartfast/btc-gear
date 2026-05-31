# btc-gear Product/UX Reset Handover

Last updated: 2026-05-31

Purpose: hand over the new way of working for the next Hermes session. Do not resume UI implementation from the previous MVP plan without first completing the product/UX reset gates below.

## Current repo state

- Repo: `/tmp/btc-gear`
- Branch: `main`
- Remote: `origin/main`
- Current checked state when this handover was written: `main` even with `origin/main`
- Tracked working tree before this handover file: clean
- Existing untracked noise to ignore unless deliberately cleaning: `model_v2/__pycache__/`, `scripts/__pycache__/`, `tests/__pycache__/`, `tmp/`
- Existing implemented web app is now considered a technical prototype/reference implementation, not an accepted product baseline.

## Why we are resetting

The first web app build produced a technically coherent engine-driven UI, but it lost the product goal and became confusing. The main failure was not a coding failure; it was a governance/specification failure.

Specific failure modes:

- Engine fields leaked directly into the UI.
- Strategy names and parameters were exposed before their user-facing meaning was established.
- Important Bitcoin collateral mechanics were not central enough.
- The Strategy tab mixed current state, loan facts, planning assumptions, and strategy controls without a clear user mental model.
- Defaults such as `assumedRealReturnPct = 3%` appeared without user-facing rationale.
- Terms such as `requiredDropBufferPct` appeared without enough context.
- `projectionYears` duplicated or conflicted with age-based planning concepts.
- Subagents were used mostly as implementation accelerators, not as role-based product governors.

The next session must not patch labels ad hoc. It must establish the product, strategy option catalog, UX flow, UI-to-engine mapping, and acceptance gates before implementation.

## North-star product vision

btc-gear helps a BTC holder understand whether, when, and how much to use Bitcoin collateral for either accumulation or income/liquidity while controlling debt, LTV, liquidation risk, and retained BTC.

Two fundamental mechanisms must stay central:

1. Accumulation
   - User borrows against BTC collateral to acquire or model additional BTC exposure.
   - The app must show resulting debt, LTV, liquidation risk, and net BTC outcome under different BTC price paths.

2. Income / stablecoin liquidity
   - User borrows against BTC collateral to raise USD/stablecoin liquidity for spending/income.
   - The app must show how much income is supportable, when income must reduce or skip, how debt grows, and how liquidation risk changes.

Everything else — ARVA, guardrails, buffers, price paths, reviews, rebaseline — is secondary machinery that must serve these mechanisms.

The app is not:

- an engine parameter editor
- a spreadsheet clone
- a generic projection playground
- a place where users are expected to understand raw variable names
- a UI where every engine input becomes a form field

## Core operating rule

No engine strategy, parameter, or default is allowed into the main UI until its user-facing option, exact meaning, label, rationale, safety behavior, and engine mapping have been specified and reviewed.

Do not assume ARVA or any other strategy should be excluded. Instead, first establish how each strategic option should be presented. A strategy may be implemented by ARVA internally but labelled in user-facing language such as “Flexible income to preserve capital through planning age,” if that is the reviewed and approved meaning.

## Required role-based Hermes process

Use Hermes subagents as a role-based product team, not just coding workers. Implementation cannot start until the role gates pass.

### Role 1: Product Owner / Vision Keeper

Responsibilities:

- Own the north star.
- Keep BTC collateral mechanics central.
- Define target users and primary jobs-to-be-done.
- Reject fields/pages that do not help the user understand collateral, borrowing capacity, debt, liquidation risk, income, accumulation, or retained BTC.

Required artifact:

- `docs/web-app/product-vision.md`

Gate questions:

- Who is this for?
- What decision does the app help with?
- What should a user understand after five minutes?
- How does each page make BTC collateral mechanics clearer?
- What is intentionally out of scope?

### Role 2: Strategy Options Designer

Responsibilities:

- Establish the catalog of user-facing strategic options before UI work.
- Define each option’s exact meaning, label, inputs, defaults, safety behavior, warnings, and engine mapping.
- Distinguish user-facing option names from internal engine strategy names.

Required artifact:

- `docs/web-app/strategy-options-spec.md`

Each option must include:

- Option ID
- User-facing label
- One-sentence description
- Intended user goal
- Not intended for
- Plain-English behavior
- Required user inputs
- Optional/advanced inputs
- Defaults and rationale
- Engine mapping
- Safety behavior
- Output metrics emphasized
- Warning/helper copy
- Acceptance tests

Example candidate option shape, not final copy:

```text
Option ID: flexible-income-preserve-capital
User-facing label: Flexible income to preserve capital through planning age
Meaning: Recalculates annual income as BTC price, debt, and remaining horizon change, aiming to preserve a chosen BTC reserve through planning age.
Engine mapping: likely ARVA or ARVA Guardrails, depending on smoothing choice.
Visible inputs: current age, planning age, desired BTC reserve, current BTC/collateral/current loan, safety preference.
Advanced assumptions: real return assumption, smoothing limits, income cap.
```

### Role 3: UX / Information Architect

Responsibilities:

- Turn strategy options into a user flow.
- Separate current real-world facts from user goals, strategy choices, safety preferences, advanced assumptions, and derived results.
- Use progressive disclosure.
- Prevent raw engine fields from appearing in the main UI.

Required artifact:

- `docs/web-app/user-experience-spec.md`

Visible field classification rule:

Every visible field must be classified as exactly one of:

- Real-world fact the user knows
- User goal/preference
- Derived read-only result
- Advanced assumption with explanation

If a field does not fit one of those classes, it should not appear in the main UI.

### Role 4: Domain / Financial Semantics Reviewer

Responsibilities:

- Review BTC collateral, loan, stablecoin liquidity, accumulation, income, liquidation, LTV, buffer, retirement/spenddown, ARVA, and guardrail semantics.
- Challenge defaults.
- Prevent misleading labels or hidden risk.

Required artifact:

- `docs/web-app/domain-semantics-review.md`

Gate requirements:

- No unexplained real return default.
- No unexplained buffer/LTV control.
- No duplicate horizon controls.
- No diagnostic max-capacity option presented as a recommendation.
- No income wording that hides the fact that income is borrowed liquidity and increases debt.
- No accumulation wording that hides debt, LTV, or liquidation risk.

### Role 5: Engine/UI Architect

Responsibilities:

- Define a user-facing UI model separate from `BtcGearConfig`.
- Map approved user-facing strategy options to engine config.
- Decide which engine fields are derived, hidden, or advanced.
- Protect engine purity while preventing engine vocabulary from driving UI vocabulary.

Required artifact:

- `docs/web-app/ui-to-engine-mapping.md`

Gate requirements:

- UI does not bind directly to engine config.
- Engine fields appear in UI only through approved user-facing concepts.
- Mapping tests are specified before implementation.

### Role 6: QA / Product Test Lead

Responsibilities:

- Convert product/UX requirements into tests and review checklists.
- Define “must not” tests that catch nonsense UI.
- Ensure tests cover user journeys, not just component rendering.

Required artifact:

- `docs/web-app/ux-acceptance-tests.md`

Example acceptance checks:

- A new user chooses accumulation or income/liquidity intent before seeing strategy parameters.
- Main setup does not show `projectionYears` when retirement age/planning age is the active horizon model.
- Current loan debt is clearly separated from desired new borrowing/income.
- Every advanced assumption has helper copy.
- Maximum borrowing capacity is labelled diagnostic, not recommended.
- Safety buffer is explained in plain language as BTC fall room before liquidation.

### Role 7: Software Engineer / Codex Implementer

Responsibilities:

- Implement only approved slices after gates pass.
- Use TDD.
- Do not invent product semantics during implementation.
- Keep stores and engine boundaries clean.

Gate requirements:

- Spec compliance review first.
- Code quality review second.
- Parent Hermes independently verifies files, tests, and build before reporting.

### Role 8: Integration / First-Time User Reviewer

Responsibilities:

- Use the app like a first-time user.
- Reject technically passing but confusing work.
- Identify jargon, wrong hierarchy, misleading defaults, or hidden collateral/debt mechanics.

Gate requirement:

- If it is confusing, it fails.

## Recommended next-session workflow

1. Start by reading this file.
2. Load relevant skills:
   - `hermes-agent` if discussing Hermes process/configuration
   - `subagent-driven-development`
   - `writing-plans`
   - `test-driven-development` before any implementation
3. Verify repo state:

```bash
git status --short --branch
git log --oneline -5 --decorate
```

4. Do not modify app code yet.
5. Create a product/UX reset plan:

- `docs/plans/product-ux-reset-plan.md`

6. Use role-based subagents to draft/review the governing specs:

- Product Owner drafts `product-vision.md`
- Strategy Options Designer drafts `strategy-options-spec.md`
- UX Architect drafts `user-experience-spec.md`
- Domain Reviewer critiques the strategy and UX specs
- Engine/UI Architect drafts `ui-to-engine-mapping.md`
- QA Lead drafts `ux-acceptance-tests.md`

7. Ask the user to review the governing specs before any UI implementation.
8. Only after approval, plan implementation slices.

## Suggested delegate_task prompts

Use `delegate_task` for role-specific work. Keep each role focused and make it return artifacts/checklists rather than code.

### Product Owner / Vision Keeper prompt

```text
You are the Product Owner / Vision Keeper for btc-gear. Draft or critique the product vision. Keep the fundamental mechanism central: using Bitcoin collateral for either accumulation or stablecoin/USD income/liquidity, while tracking debt, LTV, liquidation risk, and retained BTC. Reject engine-parameter-editor thinking. Produce concise product principles, target users, non-goals, and gate questions.
```

### Strategy Options Designer prompt

```text
You are the Strategy Options Designer for btc-gear. Define user-facing strategic options before UI implementation. Do not assume ARVA or any strategy is excluded; decide how each option should be labelled, what it means, what inputs it needs, what defaults require rationale, and how it maps to the engine. Return a strategy options catalog using the required template.
```

### UX Architect prompt

```text
You are the UX / Information Architect for btc-gear. Design the flow from user intent, not engine fields. Separate current facts, goals, strategy choices, safety preferences, advanced assumptions, and derived results. Prevent raw engine fields from leaking into main UI. Return page flow, field classification, progressive disclosure rules, and helper-copy requirements.
```

### Domain Semantics Reviewer prompt

```text
You are the Domain / Financial Semantics Reviewer for btc-gear. Review strategy labels, defaults, borrowing/income wording, accumulation wording, liquidation/LTV/buffer concepts, ARVA/guardrail semantics, and warnings. Challenge anything misleading or unexplained. Return PASS/REQUEST_CHANGES with specific issues.
```

### Engine/UI Architect prompt

```text
You are the Engine/UI Architect for btc-gear. Define a user-facing UI model separate from BtcGearConfig and map approved user options to engine config. Identify which engine fields are derived, hidden, or advanced. Return mapping tables and required mapping tests.
```

### QA Lead prompt

```text
You are the QA / Product Test Lead for btc-gear. Convert product/strategy/UX specs into acceptance tests and must-not checks that catch confusing UI, engine-jargon leakage, hidden debt/liquidation risk, and unreviewed defaults. Return a test plan with user-journey tests and static/content checks.
```

## Hard stop rules for future agents

- Do not continue building from `docs/plans/web-app-mvp-implementation.md` as though the product direction is accepted.
- Do not patch labels one by one without the strategy options spec.
- Do not expose raw engine parameters in main UI without approval in `ui-to-engine-mapping.md`.
- Do not hide or soften that income/liquidity comes from borrowing and increases debt.
- Do not let accumulation screens hide debt, LTV, liquidation risk, or net BTC after debt.
- Do not use subagents only as implementers; use them as product/UX/domain/QA reviewers with gates.
- Do not implement until the user has reviewed and approved the reset specs.

## Current best next action

Create `docs/plans/product-ux-reset-plan.md` and then draft the governing specs listed above using the role-based subagent process. The first user-visible deliverable should be a clear product/strategy/UX specification set, not code.
