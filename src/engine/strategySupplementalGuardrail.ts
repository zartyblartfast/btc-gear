import type { StrategyDecision } from './strategies';
import type { StrategyConfig } from './types';

type SupplementalGuardrailConfig = Extract<StrategyConfig, { kind: 'supplementalGuardrail' }>;

export function calculateSupplementalGuardrailDecision(
  strategy: SupplementalGuardrailConfig,
  availableSafeDrawUsd: number,
): StrategyDecision {
  const targetDrawUsd = strategy.desiredDrawUsd;
  const minimumDrawUsd = strategy.minimumDrawUsd ?? 0;
  const cappedDrawUsd = Math.min(targetDrawUsd, availableSafeDrawUsd);
  const actualDrawUsd = cappedDrawUsd < minimumDrawUsd ? 0 : cappedDrawUsd;
  const skippedIncomeUsd = Math.max(0, targetDrawUsd - actualDrawUsd);

  return {
    targetDrawUsd,
    actualDrawUsd,
    skippedIncomeUsd,
    reasonCodes: [getSupplementalGuardrailReasonCode(targetDrawUsd, actualDrawUsd, availableSafeDrawUsd, minimumDrawUsd)],
  };
}

function getSupplementalGuardrailReasonCode(
  targetDrawUsd: number,
  actualDrawUsd: number,
  availableSafeDrawUsd: number,
  minimumDrawUsd: number,
): string {
  if (actualDrawUsd === targetDrawUsd) return 'supplemental_draw_full';
  if (availableSafeDrawUsd <= 0) return 'supplemental_draw_zero_no_capacity';
  if (actualDrawUsd === 0 && availableSafeDrawUsd < minimumDrawUsd) return 'supplemental_draw_below_minimum';
  return 'supplemental_draw_capped_by_safety';
}
