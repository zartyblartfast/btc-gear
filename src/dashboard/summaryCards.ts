import type { ProjectionResult } from '../engine/projection';

export type DashboardSummaryCardTone = 'neutral' | 'safe' | 'warning' | 'danger';

export type DashboardSummaryCard = {
  id: 'btc-price' | 'debt' | 'ltv' | 'buffer' | 'income' | 'final-net-btc';
  title: string;
  value: string;
  detail: string;
  tone: DashboardSummaryCardTone;
};

export function buildDashboardSummaryCards(projection: ProjectionResult): DashboardSummaryCard[] {
  const firstRow = projection.rows[0];

  if (firstRow === undefined) {
    return [];
  }

  return [
    {
      id: 'btc-price',
      title: 'Current BTC price',
      value: formatUsd(firstRow.btcPriceUsd),
      detail: `Projection starts in ${firstRow.year}`,
      tone: 'neutral',
    },
    {
      id: 'debt',
      title: 'Current debt',
      value: formatUsd(firstRow.startingDebtUsd),
      detail: `Projected final debt ${formatUsd(projection.summary.finalDebtUsd)}`,
      tone: firstRow.startingDebtUsd > 0 ? 'neutral' : 'safe',
    },
    {
      id: 'ltv',
      title: 'Year 1 LTV',
      value: formatPct(firstRow.ltvPct),
      detail: `Max projected LTV ${formatPct(projection.summary.maxLtvPct)}`,
      tone: riskToneForLtv(projection.summary.maxLtvPct),
    },
    {
      id: 'buffer',
      title: 'Drop buffer',
      value: formatPct(firstRow.dropToLiquidationPct),
      detail: `Minimum projected buffer ${formatPct(projection.summary.minDropToLiquidationPct)}`,
      tone: riskToneForBuffer(projection.summary.minDropToLiquidationPct),
    },
    {
      id: 'income',
      title: 'Income drawn',
      value: formatUsd(projection.summary.totalIncomeDrawnUsd),
      detail: `${formatUsd(projection.summary.totalSkippedIncomeUsd)} skipped`,
      tone: projection.summary.totalSkippedIncomeUsd > 0 ? 'warning' : 'safe',
    },
    {
      id: 'final-net-btc',
      title: 'Final net BTC',
      value: `${projection.summary.finalNetBtcAfterDebt.toFixed(6)} BTC`,
      detail: `Final net equity ${formatUsd(projection.summary.finalNetEquityUsd)}`,
      tone: projection.summary.finalNetBtcAfterDebt < 0 ? 'danger' : 'neutral',
    },
  ];
}

function riskToneForLtv(maxLtvPct: number): DashboardSummaryCardTone {
  if (maxLtvPct >= 80) {
    return 'danger';
  }

  if (maxLtvPct >= 45) {
    return 'warning';
  }

  return 'safe';
}

function riskToneForBuffer(minDropToLiquidationPct: number): DashboardSummaryCardTone {
  if (minDropToLiquidationPct <= 0) {
    return 'danger';
  }

  if (minDropToLiquidationPct < 50) {
    return 'warning';
  }

  return 'safe';
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
