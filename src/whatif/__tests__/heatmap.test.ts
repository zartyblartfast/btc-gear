import { describe, expect, it } from 'vitest';
import { buildProjection } from '../../engine/projection';
import type { BtcGearConfig } from '../../engine/types';
import { DEFAULT_BTC_GEAR_CONFIG } from '../../store/profileStore';
import { buildWhatIfHeatmap } from '../heatmap';

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}

describe('buildWhatIfHeatmap', () => {
  it('builds grid rows with expected multipliers and projection-backed values', () => {
    const baseConfig = cloneConfig(DEFAULT_BTC_GEAR_CONFIG);
    const rows = buildWhatIfHeatmap(baseConfig, {
      priceMultipliers: [0.8, 1],
      drawMultipliers: [0.5, 1],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].priceMultiplier).toBe(0.8);
    expect(rows[0].cells.map((cell) => cell.drawMultiplier)).toEqual([0.5, 1]);
    expect(rows[1].priceMultiplier).toBe(1);

    const projectedConfig: BtcGearConfig = {
      ...baseConfig,
      position: { ...baseConfig.position, btcPriceUsd: baseConfig.position.btcPriceUsd * 0.8 },
      strategy: { kind: 'fixedDraw', annualDrawUsd: 10_000 },
    };
    const projection = buildProjection(projectedConfig);

    expect(rows[0].cells[0]).toMatchObject({
      priceMultiplier: 0.8,
      drawMultiplier: 0.5,
      finalDebtUsd: projection.summary.finalDebtUsd,
      finalNetBtc: projection.summary.finalNetBtcAfterDebt,
      worstLtvPct: projection.summary.maxLtvPct,
      totalDrawUsd: projection.summary.totalIncomeDrawnUsd,
    });
  });

  it('does not mutate base config', () => {
    const baseConfig = cloneConfig(DEFAULT_BTC_GEAR_CONFIG);
    const before = cloneConfig(baseConfig);

    buildWhatIfHeatmap(baseConfig, {
      priceMultipliers: [0.7, 1.3],
      drawMultipliers: [0.5, 1.5],
    });

    expect(baseConfig).toEqual(before);
  });

  it('higher draw multiplier worsens debt, LTV, or skipped income for a constrained scenario', () => {
    const constrainedConfig: BtcGearConfig = {
      ...DEFAULT_BTC_GEAR_CONFIG,
      projectionYears: 10,
      position: { totalBtcHeld: 1, collateralBtc: 1, debtUsd: 55_000, btcPriceUsd: 100_000 },
      loan: { aprPct: 8, liquidationLtvPct: 80, incomeLtvCeilingPct: 30, requiredDropBufferPct: 45 },
      pricePath: { kind: 'flat' },
      strategy: { kind: 'fixedDraw', annualDrawUsd: 30_000 },
    };

    const [row] = buildWhatIfHeatmap(constrainedConfig, {
      priceMultipliers: [1],
      drawMultipliers: [0.5, 2],
    });

    const lowerDraw = row.cells[0];
    const higherDraw = row.cells[1];
    expect(
      higherDraw.finalDebtUsd >= lowerDraw.finalDebtUsd ||
        higherDraw.worstLtvPct >= lowerDraw.worstLtvPct ||
        higherDraw.totalSkippedIncomeUsd >= lowerDraw.totalSkippedIncomeUsd,
    ).toBe(true);
  });
});
