import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../../engine/types';
import { createMemoryStorage } from '../storage';
import {
  BASELINE_KEY,
  createReviewStore,
  REVIEWS_KEY,
  type BaselineSnapshot,
  type ReviewSnapshot,
} from '../reviewStore';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 5,
  currentAge: 65,
  planningAge: 69,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 20_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 6,
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 40,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 12_000 },
};

const reviewA: ReviewSnapshot = {
  id: 'review-a',
  reviewDate: '2027-01-01',
  btcPriceUsd: 90_000,
  btcPriceSource: 'fetched',
  totalBtcHeld: 1.1,
  collateralBtc: 1,
  debtUsd: 28_000,
  actualIncomeDrawnUsd: 8_000,
  strategyKind: 'fixedDraw',
  strategyParams: { annualDrawUsd: 12_000 },
  notes: 'Drew less than planned',
};

const reviewB: ReviewSnapshot = {
  ...reviewA,
  id: 'review-b',
  reviewDate: '2028-01-01',
  btcPriceUsd: 120_000,
  debtUsd: 30_000,
  actualIncomeDrawnUsd: 2_000,
};

describe('createReviewStore', () => {
  it('lists no reviews and no baseline when storage is empty', () => {
    const store = createReviewStore(createMemoryStorage());

    expect(store.listReviews()).toEqual([]);
    expect(store.getBaseline()).toBeNull();
  });

  it('adds reviews and returns the latest review by reviewDate', () => {
    const storage = createMemoryStorage();
    const store = createReviewStore(storage);

    store.addReview(reviewA);
    store.addReview(reviewB);

    expect(JSON.parse(storage.getItem(REVIEWS_KEY) ?? '')).toEqual([reviewA, reviewB]);
    expect(store.listReviews()).toEqual([reviewA, reviewB]);
    expect(store.getLatestReview()).toEqual(reviewB);
  });

  it('deletes a review by id', () => {
    const store = createReviewStore(createMemoryStorage({ [REVIEWS_KEY]: JSON.stringify([reviewA, reviewB]) }));

    expect(store.deleteReview(reviewA.id)).toBe(true);

    expect(store.listReviews()).toEqual([reviewB]);
    expect(store.deleteReview('missing')).toBe(false);
  });

  it('locks and clears a baseline with a strategy fingerprint', () => {
    const store = createReviewStore(createMemoryStorage());

    const baseline = store.lockBaseline(baseConfig, '2026-05-30T00:00:00.000Z');

    expect(baseline.lockedAt).toBe('2026-05-30T00:00:00.000Z');
    expect(baseline.config).toEqual(baseConfig);
    expect(baseline.strategyFingerprint).toBe('{"annualDrawUsd":12000,"kind":"fixedDraw"}');
    expect(store.getBaseline()).toEqual(baseline);

    store.clearBaseline();

    expect(store.getBaseline()).toBeNull();
  });

  it('detects strategy changes against the locked baseline', () => {
    const baseline: BaselineSnapshot = {
      id: 'baseline-1',
      lockedAt: '2026-05-30T00:00:00.000Z',
      config: baseConfig,
      strategyFingerprint: '{"annualDrawUsd":12000,"kind":"fixedDraw"}',
    };
    const store = createReviewStore(createMemoryStorage({ [BASELINE_KEY]: JSON.stringify(baseline) }));

    expect(store.hasStrategyChanged(baseConfig)).toBe(false);
    expect(store.hasStrategyChanged({ ...baseConfig, strategy: { kind: 'fixedDraw', annualDrawUsd: 20_000 } })).toBe(true);
    expect(store.hasStrategyChanged({ ...baseConfig, strategy: { kind: 'supplementalGuardrail', desiredDrawUsd: 12_000 } })).toBe(true);
  });

  it('rebaselines from the latest review actual state', () => {
    const store = createReviewStore(createMemoryStorage({ [REVIEWS_KEY]: JSON.stringify([reviewA, reviewB]) }));

    const baseline = store.rebaselineFromLatestReview(baseConfig, '2028-01-02T00:00:00.000Z');

    expect(baseline?.config.position).toEqual({
      totalBtcHeld: reviewB.totalBtcHeld,
      collateralBtc: reviewB.collateralBtc,
      debtUsd: reviewB.debtUsd,
      btcPriceUsd: reviewB.btcPriceUsd,
    });
    expect(baseline?.config.pricePath).toEqual({ kind: 'flat' });
    expect(store.getBaseline()).toEqual(baseline);
  });

  it('returns null when rebaseline is requested before any review exists', () => {
    const store = createReviewStore(createMemoryStorage());

    expect(store.rebaselineFromLatestReview(baseConfig, '2028-01-02T00:00:00.000Z')).toBeNull();
    expect(store.getBaseline()).toBeNull();
  });

  it('falls back safely for malformed reviews or baseline storage', () => {
    const store = createReviewStore(
      createMemoryStorage({ [REVIEWS_KEY]: '{bad json', [BASELINE_KEY]: JSON.stringify({ id: 'missing-fields' }) }),
    );

    expect(store.listReviews()).toEqual([]);
    expect(store.getBaseline()).toBeNull();
  });

  it('returns defensive copies so callers cannot mutate persisted reviews or baselines by reference', () => {
    const baseline = {
      id: 'baseline-1',
      lockedAt: '2026-05-30T00:00:00.000Z',
      config: baseConfig,
      strategyFingerprint: '{"annualDrawUsd":12000,"kind":"fixedDraw"}',
    };
    const store = createReviewStore(
      createMemoryStorage({ [REVIEWS_KEY]: JSON.stringify([reviewA]), [BASELINE_KEY]: JSON.stringify(baseline) }),
    );

    const loadedReview = store.getLatestReview();
    const loadedBaseline = store.getBaseline();

    if (!loadedReview || !loadedBaseline) {
      throw new Error('Expected review and baseline to load');
    }
    loadedReview.debtUsd = 999;
    loadedBaseline.config.position.debtUsd = 999;

    expect(store.getLatestReview()?.debtUsd).toBe(reviewA.debtUsd);
    expect(store.getBaseline()?.config.position.debtUsd).toBe(baseConfig.position.debtUsd);
  });
});
