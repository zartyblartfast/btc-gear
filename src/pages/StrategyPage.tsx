import { useEffect, useState } from 'react';
import type { BtcGearConfig, PricePathConfig, StrategyConfig } from '../engine/types';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';

type StrategyPageProps = {
  config: BtcGearConfig;
  onSaveConfig(config: BtcGearConfig): void;
  onResetConfig?(): void;
};

type FormState = {
  startYear: string;
  projectionYears: string;
  currentAge: string;
  planningAge: string;
  totalBtcHeld: string;
  collateralBtc: string;
  debtUsd: string;
  btcPriceUsd: string;
  aprPct: string;
  liquidationLtvPct: string;
  incomeLtvCeilingPct: string;
  requiredDropBufferPct: string;
  pricePathKind: PricePathConfig['kind'];
  annualGrowthPct: string;
  explicitPricesUsd: string;
  namedStressName: Extract<PricePathConfig, { kind: 'namedStress' }>['name'];
  strategyKind: StrategyConfig['kind'];
  annualDrawUsd: string;
  desiredDrawUsd: string;
  minimumDrawUsd: string;
  assumedRealReturnPct: string;
  terminalReserveBtc: string;
  maxAnnualIncreasePct: string;
  maxAnnualDecreasePct: string;
  incomeCapUsd: string;
};

export function StrategyPage({ config, onSaveConfig, onResetConfig }: StrategyPageProps) {
  const [form, setForm] = useState<FormState>(() => formFromConfig(config));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromConfig(config));
    setError(null);
  }, [config]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    onSaveConfig(parsed.config);
  }

  function handleReset() {
    setForm(formFromConfig(DEFAULT_BTC_GEAR_CONFIG));
    setError(null);
    onResetConfig?.();
  }

  return (
    <section aria-label="Strategy and inputs">
      <p>Configure BTC holdings, debt, loan terms, price path, and strategy rules.</p>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="strategy-form" onSubmit={(event) => { event.preventDefault(); handleSave(); }}>
        <fieldset>
          <legend>Position</legend>
          <div className="form-grid">
            <NumberField label="Total BTC held" value={form.totalBtcHeld} onChange={(value) => setField('totalBtcHeld', value)} />
            <NumberField label="Collateral BTC" value={form.collateralBtc} onChange={(value) => setField('collateralBtc', value)} />
            <NumberField label="Debt USD" value={form.debtUsd} onChange={(value) => setField('debtUsd', value)} />
            <NumberField label="BTC price USD" value={form.btcPriceUsd} onChange={(value) => setField('btcPriceUsd', value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Loan terms</legend>
          <div className="form-grid">
            <NumberField label="APR %" value={form.aprPct} onChange={(value) => setField('aprPct', value)} />
            <NumberField label="Liquidation LTV %" value={form.liquidationLtvPct} onChange={(value) => setField('liquidationLtvPct', value)} />
            <NumberField label="Income LTV ceiling %" value={form.incomeLtvCeilingPct} onChange={(value) => setField('incomeLtvCeilingPct', value)} />
            <NumberField label="Required drop buffer %" value={form.requiredDropBufferPct} onChange={(value) => setField('requiredDropBufferPct', value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Projection</legend>
          <div className="form-grid">
            <NumberField label="Start year" value={form.startYear} onChange={(value) => setField('startYear', value)} />
            <NumberField label="Projection years" value={form.projectionYears} onChange={(value) => setField('projectionYears', value)} />
            <NumberField label="Current age" value={form.currentAge} onChange={(value) => setField('currentAge', value)} />
            <NumberField label="Planning age" value={form.planningAge} onChange={(value) => setField('planningAge', value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Price path</legend>
          <div className="form-grid">
            <label>
              <span>Price path kind</span>
              <select value={form.pricePathKind} onChange={(event) => setField('pricePathKind', event.target.value as PricePathConfig['kind'])}>
                <option value="flat">Flat</option>
                <option value="annualGrowth">Annual growth</option>
                <option value="explicit">Explicit</option>
                <option value="namedStress">Named stress</option>
              </select>
            </label>
            {form.pricePathKind === 'annualGrowth' ? (
              <NumberField label="Annual growth %" value={form.annualGrowthPct} onChange={(value) => setField('annualGrowthPct', value)} />
            ) : null}
            {form.pricePathKind === 'explicit' ? (
              <label className="form-field-wide">
                <span>Explicit prices USD</span>
                <textarea value={form.explicitPricesUsd} onChange={(event) => setField('explicitPricesUsd', event.target.value)} rows={4} />
              </label>
            ) : null}
            {form.pricePathKind === 'namedStress' ? (
              <label>
                <span>Named stress path</span>
                <select value={form.namedStressName} onChange={(event) => setField('namedStressName', event.target.value as FormState['namedStressName'])}>
                  <option value="flatDecade">Flat decade</option>
                  <option value="bearThenRecovery">Bear then recovery</option>
                  <option value="bullThenCrash">Bull then crash</option>
                </select>
              </label>
            ) : null}
          </div>
        </fieldset>

        <fieldset>
          <legend>Strategy</legend>
          <div className="form-grid">
            <label>
              <span>Strategy kind</span>
              <select value={form.strategyKind} onChange={(event) => setField('strategyKind', event.target.value as StrategyConfig['kind'])}>
                <option value="fixedDraw">Fixed draw</option>
                <option value="supplementalGuardrail">Supplemental guardrail</option>
                <option value="arva">ARVA</option>
                <option value="arvaGuardrails">ARVA guardrails</option>
                <option value="maxSafeCapacity">Max safe capacity</option>
              </select>
            </label>
            {renderStrategyFields(form, setField)}
          </div>
        </fieldset>

        <div className="form-actions">
          <button type="submit">Save config</button>
          <button type="button" onClick={handleReset}>Reset to defaults</button>
        </div>
      </form>
    </section>
  );
}

function renderStrategyFields(form: FormState, setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void) {
  switch (form.strategyKind) {
    case 'fixedDraw':
      return <NumberField label="Annual draw USD" value={form.annualDrawUsd} onChange={(value) => setField('annualDrawUsd', value)} />;
    case 'supplementalGuardrail':
      return (
        <>
          <NumberField label="Desired draw USD" value={form.desiredDrawUsd} onChange={(value) => setField('desiredDrawUsd', value)} />
          <NumberField label="Minimum draw USD" value={form.minimumDrawUsd} onChange={(value) => setField('minimumDrawUsd', value)} />
        </>
      );
    case 'arva':
      return (
        <>
          <NumberField label="Assumed real return %" value={form.assumedRealReturnPct} onChange={(value) => setField('assumedRealReturnPct', value)} />
          <NumberField label="Terminal reserve BTC" value={form.terminalReserveBtc} onChange={(value) => setField('terminalReserveBtc', value)} />
          <NumberField label="Income cap USD" value={form.incomeCapUsd} onChange={(value) => setField('incomeCapUsd', value)} />
        </>
      );
    case 'arvaGuardrails':
      return (
        <>
          <NumberField label="Assumed real return %" value={form.assumedRealReturnPct} onChange={(value) => setField('assumedRealReturnPct', value)} />
          <NumberField label="Terminal reserve BTC" value={form.terminalReserveBtc} onChange={(value) => setField('terminalReserveBtc', value)} />
          <NumberField label="Max annual increase %" value={form.maxAnnualIncreasePct} onChange={(value) => setField('maxAnnualIncreasePct', value)} />
          <NumberField label="Max annual decrease %" value={form.maxAnnualDecreasePct} onChange={(value) => setField('maxAnnualDecreasePct', value)} />
          <NumberField label="Income cap USD" value={form.incomeCapUsd} onChange={(value) => setField('incomeCapUsd', value)} />
        </>
      );
    case 'maxSafeCapacity':
      return <p className="form-help form-field-wide">Draws up to the safe capacity each year with no additional numeric draw parameters.</p>;
  }
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" step="any" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function formFromConfig(config: BtcGearConfig): FormState {
  const strategyDefaults = strategyDefaultsFrom(config.strategy);
  return {
    startYear: String(config.startYear),
    projectionYears: String(config.projectionYears),
    currentAge: stringFromOptional(config.currentAge),
    planningAge: stringFromOptional(config.planningAge),
    totalBtcHeld: String(config.position.totalBtcHeld),
    collateralBtc: String(config.position.collateralBtc),
    debtUsd: String(config.position.debtUsd),
    btcPriceUsd: String(config.position.btcPriceUsd),
    aprPct: String(config.loan.aprPct),
    liquidationLtvPct: String(config.loan.liquidationLtvPct),
    incomeLtvCeilingPct: String(config.loan.incomeLtvCeilingPct),
    requiredDropBufferPct: String(config.loan.requiredDropBufferPct),
    pricePathKind: config.pricePath.kind,
    annualGrowthPct: config.pricePath.kind === 'annualGrowth' ? String(config.pricePath.annualGrowthPct) : '5',
    explicitPricesUsd: config.pricePath.kind === 'explicit' ? config.pricePath.pricesUsd.join(', ') : String(config.position.btcPriceUsd),
    namedStressName: config.pricePath.kind === 'namedStress' ? config.pricePath.name : 'flatDecade',
    strategyKind: config.strategy.kind,
    ...strategyDefaults,
  };
}

function strategyDefaultsFrom(strategy: StrategyConfig) {
  return {
    annualDrawUsd: strategy.kind === 'fixedDraw' ? String(strategy.annualDrawUsd) : '20000',
    desiredDrawUsd: strategy.kind === 'supplementalGuardrail' ? String(strategy.desiredDrawUsd) : '20000',
    minimumDrawUsd: strategy.kind === 'supplementalGuardrail' ? stringFromOptional(strategy.minimumDrawUsd) : '',
    assumedRealReturnPct: strategy.kind === 'arva' || strategy.kind === 'arvaGuardrails' ? String(strategy.assumedRealReturnPct) : '3',
    terminalReserveBtc: strategy.kind === 'arva' || strategy.kind === 'arvaGuardrails' ? String(strategy.terminalReserveBtc) : '0',
    maxAnnualIncreasePct: strategy.kind === 'arvaGuardrails' ? String(strategy.maxAnnualIncreasePct) : '10',
    maxAnnualDecreasePct: strategy.kind === 'arvaGuardrails' ? String(strategy.maxAnnualDecreasePct) : '10',
    incomeCapUsd: strategy.kind === 'arva' || strategy.kind === 'arvaGuardrails' ? stringFromOptional(strategy.incomeCapUsd) : '',
  };
}

function parseForm(form: FormState): { ok: true; config: BtcGearConfig } | { ok: false; error: string } {
  const required = (value: string, label: string) => parseRequiredNumber(value, label);
  const optional = (value: string, label: string) => parseOptionalNumber(value, label);

  const startYear = required(form.startYear, 'Start year');
  const projectionYears = required(form.projectionYears, 'Projection years');
  const currentAge = optional(form.currentAge, 'Current age');
  const planningAge = optional(form.planningAge, 'Planning age');
  const totalBtcHeld = required(form.totalBtcHeld, 'Total BTC held');
  const collateralBtc = required(form.collateralBtc, 'Collateral BTC');
  const debtUsd = required(form.debtUsd, 'Debt USD');
  const btcPriceUsd = required(form.btcPriceUsd, 'BTC price USD');
  const aprPct = required(form.aprPct, 'APR %');
  const liquidationLtvPct = required(form.liquidationLtvPct, 'Liquidation LTV %');
  const incomeLtvCeilingPct = required(form.incomeLtvCeilingPct, 'Income LTV ceiling %');
  const requiredDropBufferPct = required(form.requiredDropBufferPct, 'Required drop buffer %');

  if (!startYear.ok) return startYear;
  if (!projectionYears.ok) return projectionYears;
  if (!currentAge.ok) return currentAge;
  if (!planningAge.ok) return planningAge;
  if (!totalBtcHeld.ok) return totalBtcHeld;
  if (!collateralBtc.ok) return collateralBtc;
  if (!debtUsd.ok) return debtUsd;
  if (!btcPriceUsd.ok) return btcPriceUsd;
  if (!aprPct.ok) return aprPct;
  if (!liquidationLtvPct.ok) return liquidationLtvPct;
  if (!incomeLtvCeilingPct.ok) return incomeLtvCeilingPct;
  if (!requiredDropBufferPct.ok) return requiredDropBufferPct;

  const pricePath = parsePricePath(form);
  if (!pricePath.ok) return pricePath;

  const strategy = parseStrategy(form);
  if (!strategy.ok) return strategy;

  return {
    ok: true,
    config: {
      startYear: startYear.value,
      projectionYears: projectionYears.value,
      currentAge: currentAge.value,
      planningAge: planningAge.value,
      position: {
        totalBtcHeld: totalBtcHeld.value,
        collateralBtc: collateralBtc.value,
        debtUsd: debtUsd.value,
        btcPriceUsd: btcPriceUsd.value,
      },
      loan: {
        aprPct: aprPct.value,
        liquidationLtvPct: liquidationLtvPct.value,
        incomeLtvCeilingPct: incomeLtvCeilingPct.value,
        requiredDropBufferPct: requiredDropBufferPct.value,
      },
      pricePath: pricePath.value,
      strategy: strategy.value,
    },
  };
}

function parsePricePath(form: FormState): { ok: true; value: PricePathConfig } | { ok: false; error: string } {
  switch (form.pricePathKind) {
    case 'flat':
      return { ok: true, value: { kind: 'flat' } };
    case 'annualGrowth': {
      const annualGrowthPct = parseRequiredNumber(form.annualGrowthPct, 'Annual growth %');
      return annualGrowthPct.ok ? { ok: true, value: { kind: 'annualGrowth', annualGrowthPct: annualGrowthPct.value } } : annualGrowthPct;
    }
    case 'explicit': {
      const parts = form.explicitPricesUsd.split(/[\s,]+/).filter(Boolean);
      const pricesUsd = parts.map(Number);
      if (pricesUsd.length === 0 || pricesUsd.some((price) => !Number.isFinite(price))) {
        return { ok: false, error: 'Explicit prices USD must contain finite numbers.' };
      }
      return { ok: true, value: { kind: 'explicit', pricesUsd } };
    }
    case 'namedStress':
      return { ok: true, value: { kind: 'namedStress', name: form.namedStressName } };
  }
}

function parseStrategy(form: FormState): { ok: true; value: StrategyConfig } | { ok: false; error: string } {
  switch (form.strategyKind) {
    case 'fixedDraw': {
      const annualDrawUsd = parseRequiredNumber(form.annualDrawUsd, 'Annual draw USD');
      return annualDrawUsd.ok ? { ok: true, value: { kind: 'fixedDraw', annualDrawUsd: annualDrawUsd.value } } : annualDrawUsd;
    }
    case 'supplementalGuardrail': {
      const desiredDrawUsd = parseRequiredNumber(form.desiredDrawUsd, 'Desired draw USD');
      const minimumDrawUsd = parseOptionalNumber(form.minimumDrawUsd, 'Minimum draw USD');
      if (!desiredDrawUsd.ok) return desiredDrawUsd;
      if (!minimumDrawUsd.ok) return minimumDrawUsd;
      return { ok: true, value: { kind: 'supplementalGuardrail', desiredDrawUsd: desiredDrawUsd.value, minimumDrawUsd: minimumDrawUsd.value } };
    }
    case 'arva': {
      const assumedRealReturnPct = parseRequiredNumber(form.assumedRealReturnPct, 'Assumed real return %');
      const terminalReserveBtc = parseRequiredNumber(form.terminalReserveBtc, 'Terminal reserve BTC');
      const incomeCapUsd = parseOptionalNumber(form.incomeCapUsd, 'Income cap USD');
      if (!assumedRealReturnPct.ok) return assumedRealReturnPct;
      if (!terminalReserveBtc.ok) return terminalReserveBtc;
      if (!incomeCapUsd.ok) return incomeCapUsd;
      return { ok: true, value: { kind: 'arva', assumedRealReturnPct: assumedRealReturnPct.value, terminalReserveBtc: terminalReserveBtc.value, incomeCapUsd: incomeCapUsd.value } };
    }
    case 'arvaGuardrails': {
      const assumedRealReturnPct = parseRequiredNumber(form.assumedRealReturnPct, 'Assumed real return %');
      const terminalReserveBtc = parseRequiredNumber(form.terminalReserveBtc, 'Terminal reserve BTC');
      const maxAnnualIncreasePct = parseRequiredNumber(form.maxAnnualIncreasePct, 'Max annual increase %');
      const maxAnnualDecreasePct = parseRequiredNumber(form.maxAnnualDecreasePct, 'Max annual decrease %');
      const incomeCapUsd = parseOptionalNumber(form.incomeCapUsd, 'Income cap USD');
      if (!assumedRealReturnPct.ok) return assumedRealReturnPct;
      if (!terminalReserveBtc.ok) return terminalReserveBtc;
      if (!maxAnnualIncreasePct.ok) return maxAnnualIncreasePct;
      if (!maxAnnualDecreasePct.ok) return maxAnnualDecreasePct;
      if (!incomeCapUsd.ok) return incomeCapUsd;
      return {
        ok: true,
        value: {
          kind: 'arvaGuardrails',
          assumedRealReturnPct: assumedRealReturnPct.value,
          terminalReserveBtc: terminalReserveBtc.value,
          maxAnnualIncreasePct: maxAnnualIncreasePct.value,
          maxAnnualDecreasePct: maxAnnualDecreasePct.value,
          incomeCapUsd: incomeCapUsd.value,
        },
      };
    }
    case 'maxSafeCapacity':
      return { ok: true, value: { kind: 'maxSafeCapacity' } };
  }
}

function parseRequiredNumber(value: string, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, error: `${label} must be a finite number.` };
}

function parseOptionalNumber(value: string, label: string): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (value.trim() === '') {
    return { ok: true, value: undefined };
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, error: `${label} must be a finite number.` };
}

function stringFromOptional(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}
