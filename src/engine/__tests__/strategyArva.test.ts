import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../types';
import { buildProjection } from '../projection';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 1,
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
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'arva', assumedRealReturnPct: 0, terminalReserveBtc: 0 },
};

describe('ARVA strategy', () => {
  it('calculates the raw annually recalculated virtual annuity draw', () => {
    const projection = buildProjection({
      ...baseConfig,
      strategy: { kind: 'arva', assumedRealReturnPct: 5, terminalReserveBtc: 0 },
    });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBeCloseTo(23_097.479812826798, 10);
    expect(row.actualDrawUsd).toBeCloseTo(23_097.479812826798, 10);
    expect(row.skippedIncomeUsd).toBe(0);
    expect(row.reasonCodes).toContain('arva_raw');
  });

  it('reduces the draw by excluding terminal reserve BTC from spendable equity', () => {
    const projection = buildProjection({
      ...baseConfig,
      strategy: { kind: 'arva', assumedRealReturnPct: 5, terminalReserveBtc: 0.5 },
    });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBeCloseTo(11_548.739906413399, 10);
    expect(row.actualDrawUsd).toBeCloseTo(11_548.739906413399, 10);
    expect(row.endingDebtUsd).toBeCloseTo(11_548.739906413399, 10);
  });

  it('increases the draw when the remaining planning horizon is shorter all else equal', () => {
    const fiveYearProjection = buildProjection(baseConfig);
    const twoYearProjection = buildProjection({ ...baseConfig, planningAge: 66 });

    expect(fiveYearProjection.rows[0].targetDrawUsd).toBeCloseTo(20_000, 10);
    expect(twoYearProjection.rows[0].targetDrawUsd).toBeCloseTo(50_000, 10);
    expect(twoYearProjection.rows[0].targetDrawUsd).toBeGreaterThan(fiveYearProjection.rows[0].targetDrawUsd);
  });

  it('recalculates target draw each year from updated price, debt, and remaining horizon', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 2,
      planningAge: 66,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 200_000] },
    });

    expect(projection.rows[0].targetDrawUsd).toBeCloseTo(50_000, 10);
    expect(projection.rows[0].actualDrawUsd).toBeCloseTo(40_000, 10);
    expect(projection.rows[1].targetDrawUsd).toBeCloseTo(160_000, 10);
    expect(projection.rows[1].actualDrawUsd).toBeCloseTo(40_000, 10);
  });

  it('applies income cap before safety capacity', () => {
    const projection = buildProjection({
      ...baseConfig,
      strategy: { kind: 'arva', assumedRealReturnPct: 0, terminalReserveBtc: 0, incomeCapUsd: 12_000 },
    });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBe(12_000);
    expect(row.actualDrawUsd).toBe(12_000);
    expect(row.reasonCodes).toContain('arva_income_cap');
  });

  it('lets safety capacity override raw ARVA draw', () => {
    const projection = buildProjection({
      ...baseConfig,
      position: { ...baseConfig.position, debtUsd: 35_000 },
      strategy: { kind: 'arva', assumedRealReturnPct: 0, terminalReserveBtc: 0 },
    });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBeCloseTo(13_000, 10);
    expect(row.availableSafeDrawUsd).toBeCloseTo(5_000, 10);
    expect(row.actualDrawUsd).toBeCloseTo(5_000, 10);
    expect(row.skippedIncomeUsd).toBeCloseTo(8_000, 10);
    expect(row.status).toBe('constrained');
    expect(row.reasonCodes).toContain('safety_override');
  });
});
