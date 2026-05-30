import type { BtcGearConfig } from '../engine/types';
import { isBtcGearConfig } from './profileStore';
import type { KeyValueStorage } from './storage';

export const REVIEWS_KEY = 'btc-gear:reviews';
export const BASELINE_KEY = 'btc-gear:baseline';

export type ReviewSnapshot = {
  id: string;
  reviewDate: string;
  btcPriceUsd: number;
  btcPriceSource: 'fetched' | 'manual';
  totalBtcHeld: number;
  collateralBtc: number;
  debtUsd: number;
  actualIncomeDrawnUsd: number;
  interestPaidOrAccruedUsd?: number;
  principalRepaidUsd?: number;
  collateralAddedBtc?: number;
  collateralRemovedBtc?: number;
  strategyKind: string;
  strategyParams: Record<string, unknown>;
  notes: string;
};

export type BaselineSnapshot = {
  id: string;
  lockedAt: string;
  config: BtcGearConfig;
  strategyFingerprint: string;
};

export type ReviewStore = {
  listReviews(): ReviewSnapshot[];
  addReview(review: ReviewSnapshot): void;
  deleteReview(id: string): boolean;
  getLatestReview(): ReviewSnapshot | null;
  lockBaseline(config: BtcGearConfig, lockedAt: string): BaselineSnapshot;
  getBaseline(): BaselineSnapshot | null;
  clearBaseline(): void;
  hasStrategyChanged(config: BtcGearConfig): boolean;
  rebaselineFromLatestReview(config: BtcGearConfig, lockedAt: string): BaselineSnapshot | null;
};

export function createReviewStore(storage: KeyValueStorage): ReviewStore {
  function readReviews(): ReviewSnapshot[] {
    const saved = storage.getItem(REVIEWS_KEY);

    if (saved === null) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      return isReviewSnapshotArray(parsed) ? cloneReviews(parsed) : [];
    } catch {
      return [];
    }
  }

  function writeReviews(reviews: ReviewSnapshot[]): void {
    storage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  }

  function writeBaseline(baseline: BaselineSnapshot): void {
    storage.setItem(BASELINE_KEY, JSON.stringify(baseline));
  }

  return {
    listReviews() {
      return readReviews();
    },
    addReview(review: ReviewSnapshot) {
      const reviews = readReviews();
      const nextReview = cloneReview(review);
      const exists = reviews.some((existing) => existing.id === review.id);
      const nextReviews = exists
        ? reviews.map((existing) => (existing.id === review.id ? nextReview : existing))
        : [...reviews, nextReview];

      writeReviews(nextReviews);
    },
    deleteReview(id: string) {
      const reviews = readReviews();
      const nextReviews = reviews.filter((review) => review.id !== id);

      if (nextReviews.length === reviews.length) {
        return false;
      }

      writeReviews(nextReviews);
      return true;
    },
    getLatestReview() {
      const reviews = readReviews();

      if (reviews.length === 0) {
        return null;
      }

      return cloneReview(
        reviews.reduce((latest, review) => (review.reviewDate > latest.reviewDate ? review : latest), reviews[0]),
      );
    },
    lockBaseline(config: BtcGearConfig, lockedAt: string) {
      const baseline = createBaseline(config, lockedAt);
      writeBaseline(baseline);
      return cloneBaseline(baseline);
    },
    getBaseline() {
      const saved = storage.getItem(BASELINE_KEY);

      if (saved === null) {
        return null;
      }

      try {
        const parsed: unknown = JSON.parse(saved);
        return isBaselineSnapshot(parsed) ? cloneBaseline(parsed) : null;
      } catch {
        return null;
      }
    },
    clearBaseline() {
      storage.removeItem(BASELINE_KEY);
    },
    hasStrategyChanged(config: BtcGearConfig) {
      const baseline = this.getBaseline();
      return baseline === null ? false : baseline.strategyFingerprint !== fingerprintStrategy(config);
    },
    rebaselineFromLatestReview(config: BtcGearConfig, lockedAt: string) {
      const latestReview = this.getLatestReview();

      if (latestReview === null) {
        return null;
      }

      const revisedConfig: BtcGearConfig = {
        ...cloneConfig(config),
        position: {
          totalBtcHeld: latestReview.totalBtcHeld,
          collateralBtc: latestReview.collateralBtc,
          debtUsd: latestReview.debtUsd,
          btcPriceUsd: latestReview.btcPriceUsd,
        },
      };
      const baseline = createBaseline(revisedConfig, lockedAt);
      writeBaseline(baseline);
      return cloneBaseline(baseline);
    },
  };
}

function createBaseline(config: BtcGearConfig, lockedAt: string): BaselineSnapshot {
  const clonedConfig = cloneConfig(config);
  return {
    id: `baseline-${lockedAt}`,
    lockedAt,
    config: clonedConfig,
    strategyFingerprint: fingerprintStrategy(clonedConfig),
  };
}

export function fingerprintStrategy(config: BtcGearConfig): string {
  return stableStringify(config.strategy);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function isReviewSnapshotArray(value: unknown): value is ReviewSnapshot[] {
  return Array.isArray(value) && value.every(isReviewSnapshot);
}

export function isReviewSnapshot(value: unknown): value is ReviewSnapshot {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.reviewDate) &&
    isNumber(value.btcPriceUsd) &&
    (value.btcPriceSource === 'fetched' || value.btcPriceSource === 'manual') &&
    isNumber(value.totalBtcHeld) &&
    isNumber(value.collateralBtc) &&
    isNumber(value.debtUsd) &&
    isNumber(value.actualIncomeDrawnUsd) &&
    isOptionalNumber(value.interestPaidOrAccruedUsd) &&
    isOptionalNumber(value.principalRepaidUsd) &&
    isOptionalNumber(value.collateralAddedBtc) &&
    isOptionalNumber(value.collateralRemovedBtc) &&
    isNonEmptyString(value.strategyKind) &&
    isRecord(value.strategyParams) &&
    typeof value.notes === 'string'
  );
}

export function isBaselineSnapshot(value: unknown): value is BaselineSnapshot {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.lockedAt) &&
    isBtcGearConfig(value.config) &&
    isNonEmptyString(value.strategyFingerprint)
  );
}

function cloneReviews(reviews: ReviewSnapshot[]): ReviewSnapshot[] {
  return reviews.map(cloneReview);
}

function cloneReview(review: ReviewSnapshot): ReviewSnapshot {
  return JSON.parse(JSON.stringify(review)) as ReviewSnapshot;
}

function cloneBaseline(baseline: BaselineSnapshot): BaselineSnapshot {
  return JSON.parse(JSON.stringify(baseline)) as BaselineSnapshot;
}

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNumber(value);
}
