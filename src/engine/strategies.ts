import { calculateArvaDecision } from './strategyArva';
import { calculateSupplementalGuardrailDecision } from './strategySupplementalGuardrail';
import type { NormalizedBtcGearConfig, ProjectionStatus, StrategyConfig } from './types';

export type StrategyDecision = {
  targetDrawUsd: number;
  actualDrawUsd: number;
  skippedIncomeUsd: number;
  reasonCodes: string[];
};

export function calculateStrategyDecision({
  strategy,
  availableSafeDrawUsd,
  config,
  yearIndex,
  debtUsd,
  btcPriceUsd,
}: {
  strategy: StrategyConfig;
  availableSafeDrawUsd: number;
  config: NormalizedBtcGearConfig;
  yearIndex: number;
  previousActualDrawUsd?: number;
  debtUsd: number;
  btcPriceUsd: number;
}): StrategyDecision {
  switch (strategy.kind) {
    case 'fixedDraw':
      return calculateFixedDrawDecision(strategy.annualDrawUsd, availableSafeDrawUsd);
    case 'supplementalGuardrail':
      return calculateSupplementalGuardrailDecision(strategy, availableSafeDrawUsd);
    case 'arva':
      return calculateArvaDecision({ strategy, availableSafeDrawUsd, config, yearIndex, debtUsd, btcPriceUsd });
    case 'arvaGuardrails':
    case 'maxSafeCapacity':
      throw new Error(`${strategy.kind} strategy is not implemented in the current engine slice`);
  }
}

function calculateFixedDrawDecision(targetDrawUsd: number, availableSafeDrawUsd: number): StrategyDecision {
  const actualDrawUsd = Math.min(targetDrawUsd, availableSafeDrawUsd);
  const skippedIncomeUsd = Math.max(0, targetDrawUsd - actualDrawUsd);
  const reasonCodes = [getFixedDrawReasonCode(targetDrawUsd, actualDrawUsd, availableSafeDrawUsd)];

  return {
    targetDrawUsd,
    actualDrawUsd,
    skippedIncomeUsd,
    reasonCodes,
  };
}

function getFixedDrawReasonCode(targetDrawUsd: number, actualDrawUsd: number, availableSafeDrawUsd: number): string {
  if (targetDrawUsd === actualDrawUsd) return 'draw_full';
  if (availableSafeDrawUsd <= 0) return 'draw_zero_no_capacity';
  return 'draw_capped_by_safety';
}

export function resolveRowStatus({
  riskStatus,
  targetDrawUsd,
  actualDrawUsd,
}: {
  riskStatus: ProjectionStatus;
  targetDrawUsd: number;
  actualDrawUsd: number;
}): ProjectionStatus {
  if (riskStatus === 'liquidated') return 'liquidated';
  if (actualDrawUsd < targetDrawUsd) return 'constrained';
  return riskStatus;
}
