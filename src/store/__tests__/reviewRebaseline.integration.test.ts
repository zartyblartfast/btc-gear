import { describe, expect, it } from 'vitest';
import { buildProjection } from '../../engine/projection';
import type { BtcGearConfig } from '../../engine/types';
import { createMemoryStorage } from '../storage';
import { createReviewStore, type ReviewSnapshot } from '../reviewStore';

const plannedConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 2,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 30_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 10_000 },
};

const skippedIncomeReview: ReviewSnapshot = {
  id: 'review-skip-income-2027',
  reviewDate: '2027-01-01',
  btcPriceUsd: 100_000,
  btcPriceSource: 'manual',
  totalBtcHeld: 1,
  collateralBtc: 1,
  debtUsd: 30_000,
  actualIncomeDrawnUsd: 0,
  strategyKind: 'fixedDraw',
  strategyParams: { annualDrawUsd: 10_000 },
  notes: 'Skipped income, so actual debt stayed below the originally projected post-draw debt.',
};

describe('review rebaseline integration', () => {
  it('uses latest actual debt as revised projection start so skipped income improves buffer', () => {
    const plannedProjection = buildProjection(plannedConfig);
    const store = createReviewStore(createMemoryStorage());

    store.addReview(skippedIncomeReview);
    const rebaselined = store.rebaselineFromLatestReview(plannedConfig, '2027-01-02T00:00:00.000Z');

    if (!rebaselined) {
      throw new Error('Expected rebaseline to be created from latest review');
    }
    const revisedProjection = buildProjection(rebaselined.config);

    // Human-reviewable expected values:
    // Original first row: start debt 30k + fixed draw 10k = 40k ending debt,
    // LTV 40%, drop-to-liquidation 20%.
    // Review says the user skipped income and actual debt is still 30k.
    // Revised first row starts from 30k, draws 10k again, and reaches the same 40k
    // one projected period later instead of starting from the modeled 40k state.
    expect(plannedProjection.rows[0].startingDebtUsd).toBe(30_000);
    expect(plannedProjection.rows[0].actualDrawUsd).toBe(10_000);
    expect(plannedProjection.rows[0].endingDebtUsd).toBe(40_000);
    expect(plannedProjection.rows[0].ltvPct).toBeCloseTo(40, 6);
    expect(plannedProjection.rows[0].dropToLiquidationPct).toBeCloseTo(20, 6);
    expect(rebaselined.config.position).toEqual({
      totalBtcHeld: 1,
      collateralBtc: 1,
      debtUsd: 30_000,
      btcPriceUsd: 100_000,
    });
    expect(revisedProjection.rows[0].startingDebtUsd).toBe(30_000);
    expect(revisedProjection.rows[0].actualDrawUsd).toBe(10_000);
    expect(revisedProjection.rows[0].endingDebtUsd).toBe(40_000);
    expect(revisedProjection.rows[0].ltvPct).toBeCloseTo(40, 6);
    expect(revisedProjection.rows[0].dropToLiquidationPct).toBeCloseTo(20, 6);

    expect(revisedProjection.rows[0].startingDebtUsd).toBeLessThan(plannedProjection.rows[0].endingDebtUsd);
  });
});
