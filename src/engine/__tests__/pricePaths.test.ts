import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../types';
import { normalizeAndValidateConfig } from '../risk';
import { buildPricePathUsd, getNamedStressMultipliers } from '../pricePaths';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 5,
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

function buildPath(config: BtcGearConfig): number[] {
  return buildPricePathUsd(normalizeAndValidateConfig(config));
}

describe('buildPricePathUsd', () => {
  it('builds a flat path from the starting BTC price for every projection year', () => {
    expect(buildPath(baseConfig)).toEqual([100_000, 100_000, 100_000, 100_000, 100_000]);
  });

  it('builds an annually compounded growth path from human percent input', () => {
    const path = buildPath({
      ...baseConfig,
      projectionYears: 4,
      pricePath: { kind: 'annualGrowth', annualGrowthPct: 10 },
    });

    expect(path).toHaveLength(4);
    expect(path[0]).toBeCloseTo(100_000, 10);
    expect(path[1]).toBeCloseTo(110_000, 10);
    expect(path[2]).toBeCloseTo(121_000, 10);
    expect(path[3]).toBeCloseTo(133_100, 10);
  });

  it('uses explicit annual prices exactly as supplied', () => {
    expect(
      buildPath({
        ...baseConfig,
        projectionYears: 4,
        pricePath: { kind: 'explicit', pricesUsd: [100_000, 75_000, 125_000, 90_000] },
      }),
    ).toEqual([100_000, 75_000, 125_000, 90_000]);
  });

  it('rejects explicit annual prices that do not cover the projection horizon', () => {
    expect(() =>
      buildPath({
        ...baseConfig,
        projectionYears: 4,
        pricePath: { kind: 'explicit', pricesUsd: [100_000, 75_000, 125_000] },
      }),
    ).toThrow(/explicit.*projectionYears/i);
  });

  it('builds the named bear-then-recovery path from documented multipliers', () => {
    const path = buildPath({
      ...baseConfig,
      projectionYears: 6,
      pricePath: { kind: 'namedStress', name: 'bearThenRecovery' },
    });

    [100_000, 60_000, 50_000, 70_000, 90_000, 110_000].forEach((expectedPrice, index) => {
      expect(path[index]).toBeCloseTo(expectedPrice, 10);
    });
  });

  it('extends named stress paths past the documented decade using configured annual growth', () => {
    const path = buildPath({
      ...baseConfig,
      projectionYears: 12,
      pricePath: { kind: 'namedStress', name: 'bullThenCrash', annualGrowthPct: 10 },
    });

    expect(path.slice(0, 10)).toEqual(getNamedStressMultipliers('bullThenCrash').map((multiplier) => multiplier * 100_000));
    expect(path[10]).toBeCloseTo(155_000 * 1.1, 10);
    expect(path[11]).toBeCloseTo(155_000 * 1.1 * 1.1, 10);
  });

  it('extends named stress paths flat after the documented decade when growth is omitted', () => {
    const path = buildPath({
      ...baseConfig,
      projectionYears: 12,
      pricePath: { kind: 'namedStress', name: 'bearThenRecovery' },
    });

    expect(path[9]).toBeCloseTo(170_000, 10);
    expect(path[10]).toBeCloseTo(170_000, 10);
    expect(path[11]).toBeCloseTo(170_000, 10);
  });

  it('rejects non-positive explicit BTC prices', () => {
    expect(() =>
      buildPath({
        ...baseConfig,
        pricePath: { kind: 'explicit', pricesUsd: [100_000, 0, 80_000, 90_000, 95_000] },
      }),
    ).toThrow(/pricesUsd/i);
  });
});
