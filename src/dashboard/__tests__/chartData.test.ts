import { describe, expect, it } from 'vitest';
import { buildProjection } from '../../engine/projection';
import type { BtcGearConfig } from '../../engine/types';
import { buildProjectionChartRows } from '../chartData';

const config: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 3,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 10_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 80,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 10_000 },
};

describe('buildProjectionChartRows', () => {
  it('maps engine projection rows into chart rows without recalculating strategy output', () => {
    const projection = buildProjection(config);

    expect(buildProjectionChartRows(projection)).toEqual([
      {
        year: 2026,
        btcPriceUsd: 100_000,
        liquidationPriceUsd: 25_000,
        ltvPct: 20,
        incomeDrawnUsd: 10_000,
        skippedIncomeUsd: 0,
        netBtcAfterDebt: 0.8,
      },
      {
        year: 2027,
        btcPriceUsd: 100_000,
        liquidationPriceUsd: 37_500,
        ltvPct: 30,
        incomeDrawnUsd: 10_000,
        skippedIncomeUsd: 0,
        netBtcAfterDebt: 0.7,
      },
      {
        year: 2028,
        btcPriceUsd: 100_000,
        liquidationPriceUsd: 50_000,
        ltvPct: 40,
        incomeDrawnUsd: 10_000,
        skippedIncomeUsd: 0,
        netBtcAfterDebt: 0.6,
      },
    ]);
  });

  it('preserves skipped income from constrained engine rows', () => {
    const projection = buildProjection({
      ...config,
      projectionYears: 2,
      position: { ...config.position, debtUsd: 40_000 },
      strategy: { kind: 'fixedDraw', annualDrawUsd: 20_000 },
    });

    expect(buildProjectionChartRows(projection).map((row) => row.skippedIncomeUsd)).toEqual([15_000, 20_000]);
    expect(buildProjectionChartRows(projection).map((row) => row.incomeDrawnUsd)).toEqual([5_000, 0]);
  });
});
