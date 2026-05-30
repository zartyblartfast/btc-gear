import type { ProjectionResult } from '../engine/projection';

export type ProjectionChartRow = {
  year: number;
  btcPriceUsd: number;
  liquidationPriceUsd: number;
  ltvPct: number;
  incomeDrawnUsd: number;
  skippedIncomeUsd: number;
  netBtcAfterDebt: number;
};

export function buildProjectionChartRows(projection: ProjectionResult): ProjectionChartRow[] {
  return projection.rows.map((row) => ({
    year: row.year,
    btcPriceUsd: row.btcPriceUsd,
    liquidationPriceUsd: row.liquidationPriceUsd,
    ltvPct: row.ltvPct,
    incomeDrawnUsd: row.actualDrawUsd,
    skippedIncomeUsd: row.skippedIncomeUsd,
    netBtcAfterDebt: row.netBtcAfterDebt,
  }));
}
