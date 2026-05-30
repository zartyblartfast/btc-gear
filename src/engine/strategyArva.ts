import type { StrategyDecision } from './strategies';
import type { NormalizedBtcGearConfig, StrategyConfig } from './types';

type ArvaConfig = Extract<StrategyConfig, { kind: 'arva' }>;
type ArvaGuardrailsConfig = Extract<StrategyConfig, { kind: 'arvaGuardrails' }>;

const RETURN_EPSILON = 1e-12;

export function calculateArvaDecision({
  strategy,
  availableSafeDrawUsd,
  config,
  yearIndex,
  debtUsd,
  btcPriceUsd,
}: {
  strategy: ArvaConfig;
  availableSafeDrawUsd: number;
  config: NormalizedBtcGearConfig;
  yearIndex: number;
  debtUsd: number;
  btcPriceUsd: number;
}): StrategyDecision {
  const rawArvaDrawUsd = calculateRawArvaDrawUsd({ strategy, config, yearIndex, debtUsd, btcPriceUsd });
  const targetDrawUsd = Math.min(rawArvaDrawUsd, strategy.incomeCapUsd ?? Infinity);
  const actualDrawUsd = Math.min(targetDrawUsd, availableSafeDrawUsd);
  const skippedIncomeUsd = Math.max(0, targetDrawUsd - actualDrawUsd);
  const reasonCodes = [strategy.incomeCapUsd !== undefined && strategy.incomeCapUsd < rawArvaDrawUsd ? 'arva_income_cap' : 'arva_raw'];

  if (actualDrawUsd < targetDrawUsd) reasonCodes.push('safety_override');

  return {
    targetDrawUsd,
    actualDrawUsd,
    skippedIncomeUsd,
    reasonCodes,
  };
}

export function calculateArvaGuardrailsDecision({
  strategy,
  availableSafeDrawUsd,
  config,
  yearIndex,
  previousActualDrawUsd,
  debtUsd,
  btcPriceUsd,
}: {
  strategy: ArvaGuardrailsConfig;
  availableSafeDrawUsd: number;
  config: NormalizedBtcGearConfig;
  yearIndex: number;
  previousActualDrawUsd?: number;
  debtUsd: number;
  btcPriceUsd: number;
}): StrategyDecision {
  const rawArvaDrawUsd = calculateRawArvaDrawUsd({ strategy, config, yearIndex, debtUsd, btcPriceUsd });
  const guardrailedDrawUsd = applyAnnualGuardrails(rawArvaDrawUsd, strategy, previousActualDrawUsd);
  const cappedDrawUsd = Math.min(guardrailedDrawUsd.value, strategy.incomeCapUsd ?? Infinity);
  const targetDrawUsd = cappedDrawUsd;
  const actualDrawUsd = Math.min(targetDrawUsd, availableSafeDrawUsd);
  const skippedIncomeUsd = Math.max(0, targetDrawUsd - actualDrawUsd);
  const reasonCodes = [guardrailedDrawUsd.reasonCode];

  if (strategy.incomeCapUsd !== undefined && strategy.incomeCapUsd < guardrailedDrawUsd.value) {
    reasonCodes.push('arva_income_cap');
  }
  if (actualDrawUsd < targetDrawUsd) reasonCodes.push('safety_override');

  return {
    targetDrawUsd,
    actualDrawUsd,
    skippedIncomeUsd,
    reasonCodes,
  };
}

function calculateRawArvaDrawUsd({
  strategy,
  config,
  yearIndex,
  debtUsd,
  btcPriceUsd,
}: {
  strategy: Pick<ArvaConfig, 'assumedRealReturnPct' | 'terminalReserveBtc'>;
  config: NormalizedBtcGearConfig;
  yearIndex: number;
  debtUsd: number;
  btcPriceUsd: number;
}): number {
  if (config.currentAge === undefined || config.planningAge === undefined) {
    throw new Error('ARVA requires currentAge and planningAge');
  }

  const currentAge = config.currentAge + yearIndex;
  const remainingYears = Math.max(1, config.planningAge - currentAge + 1);
  const netEquityUsd = config.position.totalBtcHeld * btcPriceUsd - debtUsd;
  const terminalReserveUsd = strategy.terminalReserveBtc * btcPriceUsd;
  const spendableEquityUsd = Math.max(0, netEquityUsd - terminalReserveUsd);
  return calculateAnnuityPayment(spendableEquityUsd, strategy.assumedRealReturnPct / 100, remainingYears);
}

function applyAnnualGuardrails(
  rawArvaDrawUsd: number,
  strategy: ArvaGuardrailsConfig,
  previousActualDrawUsd?: number,
): { value: number; reasonCode: string } {
  if (previousActualDrawUsd === undefined) return { value: rawArvaDrawUsd, reasonCode: 'arva_raw' };

  const maximumDrawUsd = previousActualDrawUsd * (1 + strategy.maxAnnualIncreasePct / 100);
  if (rawArvaDrawUsd > maximumDrawUsd) return { value: maximumDrawUsd, reasonCode: 'guardrail_increase_cap' };

  const minimumDrawUsd = previousActualDrawUsd * (1 - strategy.maxAnnualDecreasePct / 100);
  if (rawArvaDrawUsd < minimumDrawUsd) return { value: minimumDrawUsd, reasonCode: 'guardrail_decrease_cap' };

  return { value: rawArvaDrawUsd, reasonCode: 'arva_raw' };
}

function calculateAnnuityPayment(spendableEquityUsd: number, realReturn: number, remainingYears: number): number {
  if (spendableEquityUsd <= 0) return 0;
  if (Math.abs(realReturn) < RETURN_EPSILON) return spendableEquityUsd / remainingYears;
  return (spendableEquityUsd * realReturn) / (1 - (1 + realReturn) ** -remainingYears);
}
