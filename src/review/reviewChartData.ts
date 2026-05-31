import { buildProjection } from '../engine/projection';
import type { BtcGearConfig } from '../engine/types';
import type { BaselineSnapshot, ReviewSnapshot } from '../store/reviewStore';

export type ReviewActualChartRow = {
  date: string;
  btcPriceUsd: number;
  debtUsd: number;
  incomeDrawnUsd: number;
  ltvPct: number;
  netBtcAfterDebt: number;
};

export type ReviewProjectionChartRow = {
  year: number;
  btcPriceUsd: number;
  debtUsd: number;
  incomeDrawnUsd: number;
  ltvPct: number;
  netBtcAfterDebt: number;
};

export type ReviewChartData = {
  actualRows: ReviewActualChartRow[];
  baselineRows: ReviewProjectionChartRow[];
  revisedRows: ReviewProjectionChartRow[];
};

export function buildReviewChartData({
  config,
  reviews,
  baseline,
}: {
  config: BtcGearConfig;
  reviews: ReviewSnapshot[];
  baseline?: BaselineSnapshot | null;
}): ReviewChartData {
  const sortedReviews = sortReviews(reviews);
  const latestReview = sortedReviews.at(-1) ?? null;
  const revisedConfig = latestReview === null ? config : buildRevisedConfigFromLatestReview(config, latestReview);

  return {
    actualRows: sortedReviews.map(buildActualRow),
    baselineRows: baseline === undefined || baseline === null ? [] : projectionRowsFromConfig(baseline.config),
    revisedRows: projectionRowsFromConfig(revisedConfig),
  };
}

export function buildRevisedConfigFromLatestReview(config: BtcGearConfig, latestReview: ReviewSnapshot): BtcGearConfig {
  return {
    ...cloneConfig(config),
    position: {
      totalBtcHeld: latestReview.totalBtcHeld,
      collateralBtc: latestReview.collateralBtc,
      debtUsd: latestReview.debtUsd,
      btcPriceUsd: latestReview.btcPriceUsd,
    },
  };
}

function projectionRowsFromConfig(config: BtcGearConfig): ReviewProjectionChartRow[] {
  return buildProjection(config).rows.map((row) => ({
    year: row.year,
    btcPriceUsd: row.btcPriceUsd,
    debtUsd: row.startingDebtUsd,
    incomeDrawnUsd: row.actualDrawUsd,
    ltvPct: row.ltvPct,
    netBtcAfterDebt: row.netBtcAfterDebt,
  }));
}

function buildActualRow(review: ReviewSnapshot): ReviewActualChartRow {
  return {
    date: review.reviewDate,
    btcPriceUsd: review.btcPriceUsd,
    debtUsd: review.debtUsd,
    incomeDrawnUsd: review.actualIncomeDrawnUsd,
    ltvPct: calculateLtvPct(review.debtUsd, review.collateralBtc, review.btcPriceUsd),
    netBtcAfterDebt: calculateNetBtcAfterDebt(review.totalBtcHeld, review.debtUsd, review.btcPriceUsd),
  };
}

export function sortReviews(reviews: ReviewSnapshot[]): ReviewSnapshot[] {
  return [...reviews].sort((a, b) => a.reviewDate.localeCompare(b.reviewDate));
}

function calculateLtvPct(debtUsd: number, collateralBtc: number, btcPriceUsd: number): number {
  const collateralValueUsd = collateralBtc * btcPriceUsd;
  return collateralValueUsd > 0 ? (debtUsd / collateralValueUsd) * 100 : 0;
}

function calculateNetBtcAfterDebt(totalBtcHeld: number, debtUsd: number, btcPriceUsd: number): number {
  return btcPriceUsd > 0 ? totalBtcHeld - debtUsd / btcPriceUsd : totalBtcHeld;
}

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}
