import { describe, expect, it } from 'vitest';
import goldenScenarios from '../fixtures/goldenScenarios.json';
import { buildProjection } from '../projection';
import type { BtcGearConfig, ProjectionStatus } from '../types';

type ExpectedGoldenRow = {
  year: number;
  btcPriceUsd: number;
  startingDebtUsd: number;
  interestUsd: number;
  targetDrawUsd: number;
  actualDrawUsd: number;
  skippedIncomeUsd: number;
  endingDebtUsd: number;
  ltvPct: number;
  dropToLiquidationPct: number;
  netBtcAfterDebt: number;
  status: ProjectionStatus;
};

type GoldenScenario = {
  id: string;
  description: string;
  calculatedBy: 'manual' | 'python-reference' | 'spreadsheet-reference';
  reviewedAt: string;
  config: BtcGearConfig;
  expectedRows: ExpectedGoldenRow[];
};

const scenarios = goldenScenarios as GoldenScenario[];
const numericTolerance = 1e-6;

describe('golden projection fixtures', () => {
  it('covers the required MVP engine golden scenarios', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'flat-fixed-draw-all-safe',
      'bear-fixed-draw-constrained',
      'bear-recovery-supplemental-resumes',
      'bull-arva-income-rises',
      'crash-arva-guardrails-safety-override',
    ]);
  });

  it.each(scenarios)('$id matches independently calculated expected rows', (scenario) => {
    expect(scenario.calculatedBy).not.toBe('manual');
    expect(scenario.expectedRows).toHaveLength(scenario.config.projectionYears);

    const projection = buildProjection(scenario.config);

    scenario.expectedRows.forEach((expected, index) => {
      const actual = projection.rows[index];

      expect(actual.year).toBe(expected.year);
      expect(actual.btcPriceUsd).toBeCloseTo(expected.btcPriceUsd, 6);
      expect(actual.startingDebtUsd).toBeCloseTo(expected.startingDebtUsd, 6);
      expect(actual.interestUsd).toBeCloseTo(expected.interestUsd, 6);
      expect(actual.targetDrawUsd).toBeCloseTo(expected.targetDrawUsd, 6);
      expect(actual.actualDrawUsd).toBeCloseTo(expected.actualDrawUsd, 6);
      expect(actual.skippedIncomeUsd).toBeCloseTo(expected.skippedIncomeUsd, 6);
      expect(actual.endingDebtUsd).toBeCloseTo(expected.endingDebtUsd, 6);
      expect(actual.ltvPct).toBeCloseTo(expected.ltvPct, 6);
      expect(actual.dropToLiquidationPct).toBeCloseTo(expected.dropToLiquidationPct, 6);
      expect(actual.netBtcAfterDebt).toBeCloseTo(expected.netBtcAfterDebt, 6);
      expect(actual.status).toBe(expected.status);

      expect(Math.abs(actual.endingDebtUsd - expected.endingDebtUsd)).toBeLessThanOrEqual(numericTolerance);
    });
  });
});
