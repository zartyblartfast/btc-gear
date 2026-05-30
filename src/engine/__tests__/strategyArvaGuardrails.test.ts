import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../types';
import { buildProjection } from '../projection';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 2,
  currentAge: 65,
  planningAge: 69,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 0,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 100,
    incomeLtvCeilingPct: 90,
    requiredDropBufferPct: 0,
  },
  pricePath: { kind: 'flat' },
  strategy: {
    kind: 'arvaGuardrails',
    assumedRealReturnPct: 0,
    terminalReserveBtc: 0,
    maxAnnualIncreasePct: 10,
    maxAnnualDecreasePct: 10,
  },
};

describe('ARVA Guardrails strategy', () => {
  it('uses raw ARVA draw in the first year before any prior actual draw exists', () => {
    const projection = buildProjection(baseConfig);

    expect(projection.rows[0].targetDrawUsd).toBeCloseTo(20_000, 10);
    expect(projection.rows[0].reasonCodes).toContain('arva_raw');
    expect(projection.rows[0].reasonCodes).not.toContain('guardrail_increase_cap');
    expect(projection.rows[0].reasonCodes).not.toContain('guardrail_decrease_cap');
  });

  it('uses raw ARVA draw when it remains inside the guardrail band', () => {
    const projection = buildProjection({
      ...baseConfig,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 96_000] },
    });

    expect(projection.rows[1].targetDrawUsd).toBeCloseTo(19_000, 10);
    expect(projection.rows[1].actualDrawUsd).toBeCloseTo(19_000, 10);
    expect(projection.rows[1].reasonCodes).toContain('arva_raw');
  });

  it('caps year-to-year income increases after the first year', () => {
    const projection = buildProjection({
      ...baseConfig,
      planningAge: 66,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 200_000] },
    });

    expect(projection.rows[0].targetDrawUsd).toBeCloseTo(50_000, 10);
    expect(projection.rows[0].actualDrawUsd).toBeCloseTo(50_000, 10);
    expect(projection.rows[1].targetDrawUsd).toBeCloseTo(55_000, 10);
    expect(projection.rows[1].actualDrawUsd).toBeCloseTo(55_000, 10);
    expect(projection.rows[1].reasonCodes).toContain('guardrail_increase_cap');
  });

  it('caps year-to-year income decreases after the first year', () => {
    const projection = buildProjection({
      ...baseConfig,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 80_000] },
    });

    expect(projection.rows[0].targetDrawUsd).toBeCloseTo(20_000, 10);
    expect(projection.rows[0].actualDrawUsd).toBeCloseTo(20_000, 10);
    expect(projection.rows[1].targetDrawUsd).toBeCloseTo(18_000, 10);
    expect(projection.rows[1].actualDrawUsd).toBeCloseTo(18_000, 10);
    expect(projection.rows[1].reasonCodes).toContain('guardrail_decrease_cap');
  });

  it('applies income cap after guardrails and before safety capacity', () => {
    const projection = buildProjection({
      ...baseConfig,
      planningAge: 66,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 200_000] },
      strategy: {
        kind: 'arvaGuardrails',
        assumedRealReturnPct: 0,
        terminalReserveBtc: 0,
        maxAnnualIncreasePct: 10,
        maxAnnualDecreasePct: 10,
        incomeCapUsd: 52_000,
      },
    });

    expect(projection.rows[1].targetDrawUsd).toBeCloseTo(52_000, 10);
    expect(projection.rows[1].actualDrawUsd).toBeCloseTo(52_000, 10);
    expect(projection.rows[1].reasonCodes).toContain('guardrail_increase_cap');
    expect(projection.rows[1].reasonCodes).toContain('arva_income_cap');
  });

  it('lets safety override beat the decrease cap', () => {
    const projection = buildProjection({
      ...baseConfig,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 30_000] },
    });
    const secondYear = projection.rows[1];

    expect(secondYear.targetDrawUsd).toBeCloseTo(18_000, 10);
    expect(secondYear.availableSafeDrawUsd).toBeCloseTo(7_000, 10);
    expect(secondYear.actualDrawUsd).toBeCloseTo(7_000, 10);
    expect(secondYear.skippedIncomeUsd).toBeCloseTo(11_000, 10);
    expect(secondYear.status).toBe('constrained');
    expect(secondYear.reasonCodes).toContain('guardrail_decrease_cap');
    expect(secondYear.reasonCodes).toContain('safety_override');
  });

  it('draws zero when safe capacity is zero before liquidation', () => {
    const projection = buildProjection({
      ...baseConfig,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 22_222.222222222223] },
    });
    const secondYear = projection.rows[1];

    expect(secondYear.targetDrawUsd).toBeCloseTo(18_000, 10);
    expect(secondYear.availableSafeDrawUsd).toBeCloseTo(0, 10);
    expect(secondYear.actualDrawUsd).toBe(0);
    expect(secondYear.status).toBe('constrained');
    expect(secondYear.reasonCodes).toContain('safety_override');
    expect(secondYear.reasonCodes).not.toContain('liquidation_threshold_breached');
  });

  it('codifies that a safety-forced zero draw becomes the next guardrail baseline', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 3,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 22_222.222222222223, 200_000] },
    });

    expect(projection.rows[1].actualDrawUsd).toBe(0);
    expect(projection.rows[2].targetDrawUsd).toBe(0);
    expect(projection.rows[2].actualDrawUsd).toBe(0);
    expect(projection.rows[2].reasonCodes).toContain('guardrail_increase_cap');
  });
});
