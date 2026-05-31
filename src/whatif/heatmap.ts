import { buildProjection } from '../engine/projection';
import type { BtcGearConfig, ProjectionStatus, StrategyConfig } from '../engine/types';

export type WhatIfHeatmapOptions = {
  priceMultipliers: number[];
  drawMultipliers: number[];
};

export type WhatIfHeatmapCell = {
  priceMultiplier: number;
  drawMultiplier: number;
  finalNetBtc: number;
  finalDebtUsd: number;
  worstLtvPct: number;
  totalDrawUsd: number;
  totalSkippedIncomeUsd: number;
  status: ProjectionStatus;
  severity: 'green' | 'warning' | 'constrained' | 'liquidated';
};

export type WhatIfHeatmapRow = {
  priceMultiplier: number;
  cells: WhatIfHeatmapCell[];
};

export function buildWhatIfHeatmap(baseConfig: BtcGearConfig, options: WhatIfHeatmapOptions): WhatIfHeatmapRow[] {
  return options.priceMultipliers.map((priceMultiplier) => ({
    priceMultiplier,
    cells: options.drawMultipliers.map((drawMultiplier) => {
      const config = applyMultipliers(baseConfig, priceMultiplier, drawMultiplier);
      const projection = buildProjection(config);
      const worstStatus = worstProjectionStatus(projection.rows.map((row) => row.status));

      return {
        priceMultiplier,
        drawMultiplier,
        finalNetBtc: projection.summary.finalNetBtcAfterDebt,
        finalDebtUsd: projection.summary.finalDebtUsd,
        worstLtvPct: projection.summary.maxLtvPct,
        totalDrawUsd: projection.summary.totalIncomeDrawnUsd,
        totalSkippedIncomeUsd: projection.summary.totalSkippedIncomeUsd,
        status: worstStatus,
        severity: worstStatus,
      };
    }),
  }));
}

function applyMultipliers(baseConfig: BtcGearConfig, priceMultiplier: number, drawMultiplier: number): BtcGearConfig {
  const config = cloneConfig(baseConfig);
  config.position.btcPriceUsd *= priceMultiplier;
  config.strategy = multiplyStrategyDraw(config.strategy, drawMultiplier);
  return config;
}

function multiplyStrategyDraw(strategy: StrategyConfig, drawMultiplier: number): StrategyConfig {
  switch (strategy.kind) {
    case 'fixedDraw':
      return { ...strategy, annualDrawUsd: strategy.annualDrawUsd * drawMultiplier };
    case 'supplementalGuardrail':
      return {
        ...strategy,
        desiredDrawUsd: strategy.desiredDrawUsd * drawMultiplier,
        minimumDrawUsd: strategy.minimumDrawUsd === undefined ? undefined : strategy.minimumDrawUsd * drawMultiplier,
      };
    case 'arva':
      return {
        ...strategy,
        incomeCapUsd: strategy.incomeCapUsd === undefined ? undefined : strategy.incomeCapUsd * drawMultiplier,
      };
    case 'arvaGuardrails':
      return {
        ...strategy,
        incomeCapUsd: strategy.incomeCapUsd === undefined ? undefined : strategy.incomeCapUsd * drawMultiplier,
      };
    case 'maxSafeCapacity':
      return { ...strategy };
  }
}

function worstProjectionStatus(statuses: ProjectionStatus[]): ProjectionStatus {
  if (statuses.includes('liquidated')) return 'liquidated';
  if (statuses.includes('constrained')) return 'constrained';
  if (statuses.includes('warning')) return 'warning';
  return 'green';
}

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}
