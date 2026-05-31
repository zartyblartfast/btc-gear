import { describe, expect, it } from 'vitest';
import { buildReviewChartData, buildRevisedConfigFromLatestReview } from '../reviewChartData';
import type { ReviewSnapshot } from '../../store/reviewStore';
import { DEFAULT_BTC_GEAR_CONFIG } from '../../store/profileStore';
import type { BtcGearConfig } from '../../engine/types';

const baseConfig: BtcGearConfig = {
  ...DEFAULT_BTC_GEAR_CONFIG,
  startYear: 2026,
  projectionYears: 3,
  position: { totalBtcHeld: 2, collateralBtc: 1, debtUsd: 50_000, btcPriceUsd: 100_000 },
};

function review(overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot {
  return {
    id: 'review-1',
    reviewDate: '2026-06-30',
    btcPriceUsd: 120_000,
    btcPriceSource: 'manual',
    totalBtcHeld: 2.5,
    collateralBtc: 1.2,
    debtUsd: 60_000,
    actualIncomeDrawnUsd: 12_000,
    strategyKind: 'fixedDraw',
    strategyParams: { annualDrawUsd: 20_000 },
    notes: 'midyear check',
    ...overrides,
  };
}

describe('buildReviewChartData', () => {
  it('builds actual history rows with LTV, income, and net BTC from review snapshots', () => {
    const data = buildReviewChartData({ config: baseConfig, reviews: [review()] });

    expect(data.actualRows).toEqual([
      expect.objectContaining({
        date: '2026-06-30',
        btcPriceUsd: 120_000,
        debtUsd: 60_000,
        incomeDrawnUsd: 12_000,
        ltvPct: 41.66666666666667,
        netBtcAfterDebt: 2,
      }),
    ]);
  });

  it('builds revised projection from the latest actual review state', () => {
    const latest = review({ id: 'review-2', reviewDate: '2027-01-01', btcPriceUsd: 130_000, debtUsd: 70_000, totalBtcHeld: 3, collateralBtc: 1.4 });
    const revisedConfig = buildRevisedConfigFromLatestReview(baseConfig, latest);
    const data = buildReviewChartData({ config: baseConfig, reviews: [review(), latest] });

    expect(revisedConfig.position).toEqual({ btcPriceUsd: 130_000, debtUsd: 70_000, totalBtcHeld: 3, collateralBtc: 1.4 });
    expect(data.revisedRows[0]).toEqual(expect.objectContaining({ btcPriceUsd: 130_000, debtUsd: 70_000 }));
  });

  it('includes baseline projection rows when a baseline exists', () => {
    const baselineConfig: BtcGearConfig = {
      ...baseConfig,
      position: { ...baseConfig.position, debtUsd: 40_000, btcPriceUsd: 90_000 },
    };
    const data = buildReviewChartData({
      config: baseConfig,
      reviews: [],
      baseline: {
        id: 'baseline-1',
        lockedAt: '2026-01-01T00:00:00.000Z',
        config: baselineConfig,
        strategyFingerprint: '{fixedDraw}',
      },
    });

    expect(data.baselineRows[0]).toEqual(expect.objectContaining({ btcPriceUsd: 90_000, debtUsd: 40_000 }));
    expect(data.baselineRows).toHaveLength(3);
  });
});
