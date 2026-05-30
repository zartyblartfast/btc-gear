import { describe, expect, it } from 'vitest';
import type { BtcGearConfig, ProjectionStatus } from '../../engine/types';
import { buildTradeoffMap, buildTradeoffScenarioGrid, scoreTradeoffScenarios, type TradeoffScenario } from '../tradeoffMap';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 5,
  position: {
    totalBtcHeld: 2,
    collateralBtc: 1,
    debtUsd: 20_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 80,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 25,
  },
  pricePath: { kind: 'annualGrowth', annualGrowthPct: 5 },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 10_000 },
};

describe('buildTradeoffScenarioGrid', () => {
  it('generates a compact grid that varies draw, buffer, income LTV ceiling, and BTC price path', () => {
    const scenarios = buildTradeoffScenarioGrid(baseConfig);

    expect(scenarios.length).toBeGreaterThan(1);
    expect(new Set(scenarios.map((scenario) => scenario.drawLabel)).size).toBeGreaterThan(1);
    expect(new Set(scenarios.map((scenario) => scenario.requiredDropBufferPct)).size).toBeGreaterThan(1);
    expect(new Set(scenarios.map((scenario) => scenario.config.loan.incomeLtvCeilingPct)).size).toBeGreaterThan(1);
    expect(new Set(scenarios.map((scenario) => scenario.pricePathLabel)).size).toBeGreaterThan(1);
  });

  it('includes the exact current scenario with a stable current id and marker flag', () => {
    const scenarios = buildTradeoffScenarioGrid(baseConfig);
    const current = scenarios.find((scenario) => scenario.id === 'current');

    expect(current).toMatchObject({
      id: 'current',
      isCurrentScenario: true,
      requiredDropBufferPct: baseConfig.loan.requiredDropBufferPct,
      pricePathLabel: 'Current path',
    });
    expect(current?.config).toEqual(baseConfig);
  });
});

describe('scoreTradeoffScenarios', () => {
  it('stars the best normalized income/safety/final BTC tradeoff among qualifying scenarios', () => {
    const scenarios = [
      scenario({ id: 'low-income', income: 10_000, buffer: 90, finalBtc: 1.0, requiredBuffer: 25 }),
      scenario({ id: 'best-tradeoff', income: 80_000, buffer: 70, finalBtc: 1.3, requiredBuffer: 25 }),
      scenario({ id: 'max-btc', income: 30_000, buffer: 80, finalBtc: 1.35, requiredBuffer: 25 }),
    ];

    const result = scoreTradeoffScenarios(scenarios);

    expect(result.recommendedScenarioId).toBe('best-tradeoff');
    expect(result.scenarios.find((item) => item.id === 'best-tradeoff')?.isRecommended).toBe(true);
    expect(result.scenarios.find((item) => item.id === 'best-tradeoff')?.score).toBeGreaterThan(0);
  });

  it('does not star unsafe high-income, liquidated, or max safe capacity scenarios by default', () => {
    const scenarios = [
      scenario({ id: 'unsafe-high-income', income: 200_000, buffer: 10, finalBtc: 0.4, requiredBuffer: 25 }),
      scenario({ id: 'liquidated-high-income', income: 250_000, buffer: -5, finalBtc: 0, status: 'liquidated', requiredBuffer: 25 }),
      scenario({ id: 'max-safe', income: 150_000, buffer: 50, finalBtc: 0.9, maxSafeCapacity: true, requiredBuffer: 25 }),
      scenario({ id: 'safe-balanced', income: 60_000, buffer: 60, finalBtc: 1.2, requiredBuffer: 25 }),
    ];

    const result = scoreTradeoffScenarios(scenarios);

    expect(result.recommendedScenarioId).toBe('safe-balanced');
    expect(result.scenarios.find((item) => item.id === 'unsafe-high-income')?.isRecommended).toBe(false);
    expect(result.scenarios.find((item) => item.id === 'liquidated-high-income')?.isRecommended).toBe(false);
    expect(result.scenarios.find((item) => item.id === 'max-safe')?.isRecommended).toBe(false);
  });

  it('returns an explicit no-recommendation message when no scenario qualifies', () => {
    const result = scoreTradeoffScenarios([
      scenario({ id: 'unsafe', income: 200_000, buffer: 10, finalBtc: 0.4, requiredBuffer: 25 }),
      scenario({ id: 'liquidated', income: 250_000, buffer: -5, finalBtc: 0, status: 'liquidated', requiredBuffer: 25 }),
    ]);

    expect(result.recommendedScenarioId).toBeUndefined();
    expect(result.noRecommendationMessage).toBe('No recommended scenario under selected assumptions.');
    expect(result.scenarios.every((item) => !item.isRecommended)).toBe(true);
  });
});

describe('buildTradeoffMap', () => {
  it('combines projection-backed grid rows with current and recommended markers', () => {
    const result = buildTradeoffMap(baseConfig);

    expect(result.scenarios.some((scenario) => scenario.isCurrentScenario)).toBe(true);
    expect(result.scenarios.some((scenario) => scenario.isRecommended)).toBe(true);
    expect(result.scenarios.every((scenario) => Number.isFinite(scenario.totalIncomeFundedUsd))).toBe(true);
    expect(result.scenarios.every((scenario) => Number.isFinite(scenario.minDropToLiquidationPct))).toBe(true);
  });
});

function scenario(overrides: {
  id: string;
  income: number;
  buffer: number;
  finalBtc: number;
  requiredBuffer: number;
  status?: ProjectionStatus;
  maxSafeCapacity?: boolean;
}): TradeoffScenario {
  return {
    id: overrides.id,
    label: overrides.id,
    config: overrides.maxSafeCapacity ? { ...baseConfig, strategy: { kind: 'maxSafeCapacity' } } : baseConfig,
    strategyFamily: overrides.maxSafeCapacity ? 'Max Safe Capacity' : 'Fixed Draw',
    pricePathLabel: 'Flat',
    drawLabel: 'Draw',
    bufferLabel: `${overrides.requiredBuffer}% buffer`,
    ceilingLabel: '45% ceiling',
    totalIncomeFundedUsd: overrides.income,
    totalSkippedIncomeUsd: 0,
    minDropToLiquidationPct: overrides.buffer,
    maxLtvPct: 50,
    finalNetBtcAfterDebt: overrides.finalBtc,
    status: overrides.status ?? 'green',
    requiredDropBufferPct: overrides.requiredBuffer,
    isCurrentScenario: false,
    isRecommended: false,
  };
}
