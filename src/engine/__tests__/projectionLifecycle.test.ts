import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../types';
import { buildProjection } from '../projection';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 3,
  currentAge: 65,
  planningAge: 95,
  position: {
    totalBtcHeld: 1.5,
    collateralBtc: 1,
    debtUsd: 10_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 10,
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 20_000 },
};

describe('buildProjection fixed draw lifecycle', () => {
  it('accrues interest on starting debt only before adding the current year draw', () => {
    const projection = buildProjection(baseConfig);
    const firstYear = projection.rows[0];

    expect(firstYear.year).toBe(2026);
    expect(firstYear.age).toBe(65);
    expect(firstYear.startingDebtUsd).toBeCloseTo(10_000, 10);
    expect(firstYear.interestUsd).toBeCloseTo(1_000, 10);
    expect(firstYear.debtAfterInterestUsd).toBeCloseTo(11_000, 10);
    expect(firstYear.targetDrawUsd).toBeCloseTo(20_000, 10);
    expect(firstYear.actualDrawUsd).toBeCloseTo(20_000, 10);
    expect(firstYear.endingDebtUsd).toBeCloseTo(31_000, 10);
    expect(firstYear.reasonCodes).toContain('draw_full');
  });

  it('charges interest on a new draw in the following year, not the year it is borrowed', () => {
    const projection = buildProjection(baseConfig);
    const secondYear = projection.rows[1];

    expect(secondYear.year).toBe(2027);
    expect(secondYear.age).toBe(66);
    expect(secondYear.startingDebtUsd).toBeCloseTo(31_000, 10);
    expect(secondYear.interestUsd).toBeCloseTo(3_100, 10);
    expect(secondYear.debtAfterInterestUsd).toBeCloseTo(34_100, 10);
  });

  it('caps fixed draw by available safe capacity and records skipped income', () => {
    const projection = buildProjection(baseConfig);
    const secondYear = projection.rows[1];

    expect(secondYear.maxSafeDebtUsd).toBeCloseTo(40_000, 10);
    expect(secondYear.availableSafeDrawUsd).toBeCloseTo(5_900, 10);
    expect(secondYear.targetDrawUsd).toBeCloseTo(20_000, 10);
    expect(secondYear.actualDrawUsd).toBeCloseTo(5_900, 10);
    expect(secondYear.skippedIncomeUsd).toBeCloseTo(14_100, 10);
    expect(secondYear.endingDebtUsd).toBeCloseTo(40_000, 10);
    expect(secondYear.status).toBe('constrained');
    expect(secondYear.reasonCodes).toContain('draw_capped_by_safety');
  });

  it('uses the configured annual BTC price path when calculating safety capacity', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 2,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 80_000] },
    });
    const secondYear = projection.rows[1];

    expect(secondYear.btcPriceUsd).toBe(80_000);
    expect(secondYear.maxSafeDebtUsd).toBeCloseTo(32_000, 10);
    expect(secondYear.availableSafeDrawUsd).toBe(0);
    expect(secondYear.actualDrawUsd).toBe(0);
    expect(secondYear.status).toBe('constrained');
    expect(secondYear.reasonCodes).toContain('draw_zero_no_capacity');
    expect(secondYear.reasonCodes).toContain('already_over_safe_debt');
  });

  it('keeps liquidation as the primary status even when the target draw is also constrained', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 2,
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 60_000] },
    });
    const secondYear = projection.rows[1];

    expect(secondYear.btcPriceUsd).toBe(60_000);
    expect(secondYear.actualDrawUsd).toBe(0);
    expect(secondYear.status).toBe('liquidated');
    expect(secondYear.reasonCodes).toContain('draw_zero_no_capacity');
    expect(secondYear.reasonCodes).toContain('liquidation_threshold_breached');
    expect(projection.summary.liquidationYear).toBe(2027);
    expect(projection.summary.safeAllYears).toBe(false);
  });

  it('summarizes income, skipped income, risk, and first constrained year', () => {
    const projection = buildProjection(baseConfig);

    expect(projection.summary.totalIncomeDrawnUsd).toBeCloseTo(25_900, 10);
    expect(projection.summary.totalSkippedIncomeUsd).toBeCloseTo(34_100, 10);
    expect(projection.summary.finalDebtUsd).toBeCloseTo(44_000, 10);
    expect(projection.summary.finalNetBtcAfterDebt).toBeCloseTo(1.06, 10);
    expect(projection.summary.maxLtvPct).toBeCloseTo(44, 10);
    expect(projection.summary.minDropToLiquidationPct).toBeCloseTo(12, 10);
    expect(projection.summary.firstConstrainedYear).toBe(2027);
    expect(projection.summary.firstWarningYear).toBe(2028);
    expect(projection.summary.liquidationYear).toBeUndefined();
    expect(projection.summary.safeAllYears).toBe(false);
  });
});
