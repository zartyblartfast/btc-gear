import { describe, expect, it } from 'vitest';
import type { BtcGearConfig, ProjectionYear } from '../types';
import { buildProjection } from '../projection';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 3,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 10_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'supplementalGuardrail', desiredDrawUsd: 20_000 },
};

function expectNeverBreachesSafeCapacity(row: ProjectionYear): void {
  expect(row.actualDrawUsd).toBeLessThanOrEqual(row.availableSafeDrawUsd + 1e-9);
  expect(row.endingDebtUsd).toBeLessThanOrEqual(row.maxSafeDebtUsd + 1e-9);
}

describe('Supplemental Guardrail strategy', () => {
  it('takes the full desired draw in a green year', () => {
    const projection = buildProjection({ ...baseConfig, projectionYears: 1 });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBe(20_000);
    expect(row.availableSafeDrawUsd).toBeCloseTo(30_000, 10);
    expect(row.actualDrawUsd).toBe(20_000);
    expect(row.skippedIncomeUsd).toBe(0);
    expect(row.endingDebtUsd).toBe(30_000);
    expect(row.status).toBe('green');
    expect(row.reasonCodes).toContain('supplemental_draw_full');
    expectNeverBreachesSafeCapacity(row);
  });

  it('takes a partial draw when full desired income would breach the required buffer', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 1,
      position: { ...baseConfig.position, debtUsd: 35_000 },
    });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBe(20_000);
    expect(row.availableSafeDrawUsd).toBeCloseTo(5_000, 10);
    expect(row.actualDrawUsd).toBeCloseTo(5_000, 10);
    expect(row.skippedIncomeUsd).toBeCloseTo(15_000, 10);
    expect(row.endingDebtUsd).toBeCloseTo(40_000, 10);
    expect(row.status).toBe('constrained');
    expect(row.reasonCodes).toContain('supplemental_draw_capped_by_safety');
    expectNeverBreachesSafeCapacity(row);
  });

  it('takes zero draw when there is no safe borrowing capacity', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 1,
      position: { ...baseConfig.position, debtUsd: 42_000 },
    });
    const row = projection.rows[0];

    expect(row.targetDrawUsd).toBe(20_000);
    expect(row.availableSafeDrawUsd).toBe(0);
    expect(row.actualDrawUsd).toBe(0);
    expect(row.skippedIncomeUsd).toBe(20_000);
    expect(row.endingDebtUsd).toBe(42_000);
    expect(row.status).toBe('constrained');
    expect(row.reasonCodes).toContain('supplemental_draw_zero_no_capacity');
    expect(row.reasonCodes).toContain('already_over_safe_debt');
  });

  it('resumes drawing after BTC price recovery without catching up skipped income', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 3,
      position: { ...baseConfig.position, debtUsd: 30_000 },
      pricePath: { kind: 'explicit', pricesUsd: [100_000, 80_000, 150_000] },
      strategy: { kind: 'supplementalGuardrail', desiredDrawUsd: 10_000 },
    });

    expect(projection.rows.map((row) => row.actualDrawUsd)).toEqual([10_000, 0, 10_000]);
    expect(projection.rows.map((row) => row.skippedIncomeUsd)).toEqual([0, 10_000, 0]);
    expect(projection.rows[1].reasonCodes).toContain('supplemental_draw_zero_no_capacity');
    expect(projection.rows[2].reasonCodes).toContain('supplemental_draw_full');
    expect(projection.summary.totalIncomeDrawnUsd).toBe(20_000);
    expect(projection.summary.totalSkippedIncomeUsd).toBe(10_000);
  });

  it('uses minimum draw as an all-or-nothing guardrail when partial capacity is below the minimum', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 1,
      position: { ...baseConfig.position, debtUsd: 35_000 },
      strategy: { kind: 'supplementalGuardrail', desiredDrawUsd: 20_000, minimumDrawUsd: 6_000 },
    });
    const row = projection.rows[0];

    expect(row.availableSafeDrawUsd).toBeCloseTo(5_000, 10);
    expect(row.actualDrawUsd).toBe(0);
    expect(row.skippedIncomeUsd).toBe(20_000);
    expect(row.reasonCodes).toContain('supplemental_draw_below_minimum');
    expectNeverBreachesSafeCapacity(row);
  });

  it('reports zero safe capacity before minimum draw diagnostics', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 1,
      position: { ...baseConfig.position, debtUsd: 42_000 },
      strategy: { kind: 'supplementalGuardrail', desiredDrawUsd: 20_000, minimumDrawUsd: 6_000 },
    });
    const row = projection.rows[0];

    expect(row.availableSafeDrawUsd).toBe(0);
    expect(row.actualDrawUsd).toBe(0);
    expect(row.reasonCodes).toContain('supplemental_draw_zero_no_capacity');
    expect(row.reasonCodes).not.toContain('supplemental_draw_below_minimum');
  });

  it('never intentionally breaches the required buffer even when desired income is much larger than safe capacity', () => {
    const projection = buildProjection({
      ...baseConfig,
      projectionYears: 3,
      strategy: { kind: 'supplementalGuardrail', desiredDrawUsd: 100_000 },
    });

    projection.rows.forEach(expectNeverBreachesSafeCapacity);
    expect(projection.rows.map((row) => row.actualDrawUsd)).toEqual([30_000, 0, 0]);
  });
});
