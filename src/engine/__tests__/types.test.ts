import { describe, expect, it } from 'vitest';
import type {
  BtcGearConfig,
  PricePathConfig,
  ProjectionSummary,
  ProjectionYear,
  StrategyConfig,
} from '../types';

const pricePath: PricePathConfig = { kind: 'annualGrowth', annualGrowthPct: 5 };
const strategy: StrategyConfig = { kind: 'fixedDraw', annualDrawUsd: 24_000 };

describe('engine types', () => {
  it('supports explicit config, row, and summary shapes under strict TypeScript', () => {
    const config: BtcGearConfig = {
      startYear: 2026,
      projectionYears: 10,
      currentAge: 62,
      planningAge: 92,
      position: {
        totalBtcHeld: 2,
        collateralBtc: 1.25,
        debtUsd: 15_000,
        btcPriceUsd: 100_000,
      },
      loan: {
        aprPct: 9.5,
        liquidationLtvPct: 50,
        incomeLtvCeilingPct: 35,
        requiredDropBufferPct: 25,
      },
      pricePath,
      strategy,
    };

    const row: ProjectionYear = {
      index: 0,
      year: 2026,
      age: 62,
      btcPriceUsd: 100_000,
      startingDebtUsd: 15_000,
      interestUsd: 1_425,
      debtAfterInterestUsd: 16_425,
      targetDrawUsd: 24_000,
      actualDrawUsd: 20_000,
      skippedIncomeUsd: 4_000,
      endingDebtUsd: 36_425,
      collateralBtc: 1.25,
      totalBtcHeld: 2,
      collateralValueUsd: 125_000,
      netEquityUsd: 163_575,
      netBtcAfterDebt: 1.63575,
      ltvPct: 29.14,
      liquidationPriceUsd: 58_280,
      dropToLiquidationPct: 41.72,
      maxSafeDebtUsd: 43_750,
      availableSafeDrawUsd: 27_325,
      status: 'constrained',
      reasonCodes: ['draw_capped_by_safety'],
    };

    const summary: ProjectionSummary = {
      totalIncomeDrawnUsd: row.actualDrawUsd,
      totalSkippedIncomeUsd: row.skippedIncomeUsd,
      finalDebtUsd: row.endingDebtUsd,
      finalNetBtcAfterDebt: row.netBtcAfterDebt,
      finalNetEquityUsd: row.netEquityUsd,
      maxLtvPct: row.ltvPct,
      minDropToLiquidationPct: row.dropToLiquidationPct,
      firstWarningYear: undefined,
      firstConstrainedYear: row.year,
      liquidationYear: undefined,
      safeAllYears: false,
    };

    expect(config.strategy.kind).toBe('fixedDraw');
    expect(row.status).toBe('constrained');
    expect(summary.firstConstrainedYear).toBe(2026);
  });
});
