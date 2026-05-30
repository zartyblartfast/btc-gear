import { describe, expect, it } from 'vitest';
import type { BtcGearConfig, NormalizedBtcGearConfig } from '../types';
import {
  calculateAvailableSafeDrawUsd,
  calculateRiskMetrics,
  normalizeAndValidateConfig,
} from '../risk';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 10,
  position: {
    totalBtcHeld: 1.5,
    collateralBtc: 1,
    debtUsd: 20_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 10,
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 12_000 },
};

describe('normalizeAndValidateConfig', () => {
  it('normalizes human percent inputs exactly once at the engine boundary', () => {
    const normalized = normalizeAndValidateConfig(baseConfig);

    expect(normalized.loan.apr).toBeCloseTo(0.1, 12);
    expect(normalized.loan.liquidationLtv).toBeCloseTo(0.5, 12);
    expect(normalized.loan.incomeLtvCeiling).toBeCloseTo(0.45, 12);
    expect(normalized.loan.requiredDropBuffer).toBeCloseTo(0.2, 12);
  });

  it('rejects decimal-looking percent inputs instead of silently double-normalizing them', () => {
    expect(() =>
      normalizeAndValidateConfig({
        ...baseConfig,
        loan: { ...baseConfig.loan, liquidationLtvPct: 0.5 },
      }),
    ).toThrow(/liquidationLtvPct/i);
  });

  it.each([
    ['btcPriceUsd', { position: { ...baseConfig.position, btcPriceUsd: 0 } }],
    ['collateralBtc', { position: { ...baseConfig.position, collateralBtc: 2 } }],
    ['debtUsd', { position: { ...baseConfig.position, debtUsd: -1 } }],
    ['projectionYears', { projectionYears: 0 }],
    ['incomeLtvCeilingPct', { loan: { ...baseConfig.loan, incomeLtvCeilingPct: 50 } }],
    ['requiredDropBufferPct', { loan: { ...baseConfig.loan, requiredDropBufferPct: 100 } }],
  ])('rejects invalid %s config values', (_field, patch) => {
    const candidate = {
      ...baseConfig,
      ...patch,
      position: { ...baseConfig.position, ...('position' in patch ? patch.position : {}) },
      loan: { ...baseConfig.loan, ...('loan' in patch ? patch.loan : {}) },
    } as BtcGearConfig;

    expect(() => normalizeAndValidateConfig(candidate)).toThrow();
  });
});

describe('calculateRiskMetrics', () => {
  const normalized: NormalizedBtcGearConfig = normalizeAndValidateConfig(baseConfig);

  it('calculates LTV, liquidation price, drop buffer, safe debt, and net BTC from a hand-checkable scenario', () => {
    const metrics = calculateRiskMetrics({
      config: normalized,
      debtUsd: 20_000,
      btcPriceUsd: 100_000,
    });

    expect(metrics.collateralValueUsd).toBe(100_000);
    expect(metrics.ltvPct).toBeCloseTo(20, 12);
    expect(metrics.liquidationPriceUsd).toBeCloseTo(40_000, 12);
    expect(metrics.dropToLiquidationPct).toBeCloseTo(60, 12);
    expect(metrics.maxSafeDebtUsd).toBeCloseTo(40_000, 12);
    expect(metrics.netEquityUsd).toBeCloseTo(130_000, 12);
    expect(metrics.netBtcAfterDebt).toBeCloseTo(1.3, 12);
    expect(metrics.status).toBe('green');
  });

  it('uses the stricter income LTV ceiling when it is lower than the buffer-based debt cap', () => {
    const metrics = calculateRiskMetrics({
      config: normalizeAndValidateConfig({
        ...baseConfig,
        loan: { ...baseConfig.loan, incomeLtvCeilingPct: 35 },
      }),
      debtUsd: 20_000,
      btcPriceUsd: 100_000,
    });

    expect(metrics.maxSafeDebtUsd).toBeCloseTo(35_000, 12);
  });

  it('treats the exact liquidation threshold conservatively as liquidated', () => {
    const metrics = calculateRiskMetrics({
      config: normalized,
      debtUsd: 50_000,
      btcPriceUsd: 100_000,
    });

    expect(metrics.dropToLiquidationPct).toBeCloseTo(0, 12);
    expect(metrics.status).toBe('liquidated');
    expect(metrics.reasonCodes).toContain('liquidation_threshold_breached');
  });

  it('marks debt above max safe debt but below liquidation as warning with no safe capacity', () => {
    const metrics = calculateRiskMetrics({
      config: normalized,
      debtUsd: 45_000,
      btcPriceUsd: 100_000,
    });

    expect(metrics.status).toBe('warning');
    expect(metrics.maxSafeDebtUsd).toBeCloseTo(40_000, 12);
    expect(metrics.reasonCodes).toContain('already_over_safe_debt');
  });
});

describe('calculateAvailableSafeDrawUsd', () => {
  const normalized = normalizeAndValidateConfig(baseConfig);

  it('subtracts debt after interest, not just starting debt, from safe debt capacity', () => {
    const availableDraw = calculateAvailableSafeDrawUsd({
      config: normalized,
      startingDebtUsd: 20_000,
      btcPriceUsd: 100_000,
    });

    expect(availableDraw).toBeCloseTo(18_000, 12);
  });

  it('floors available draw at zero when interest pushes debt above safe capacity', () => {
    const availableDraw = calculateAvailableSafeDrawUsd({
      config: normalized,
      startingDebtUsd: 39_000,
      btcPriceUsd: 100_000,
    });

    expect(availableDraw).toBe(0);
  });
});
