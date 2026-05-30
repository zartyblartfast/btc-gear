import type { StrategyDecision } from './strategies';
import type { NormalizedBtcGearConfig, StrategyConfig } from './types';

type ArvaConfig = Extract<StrategyConfig, { kind: 'arva' }>;

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
  if (config.currentAge === undefined || config.planningAge === undefined) {
    throw new Error('ARVA requires currentAge and planningAge');
  }

  const currentAge = config.currentAge + yearIndex;
  const remainingYears = Math.max(1, config.planningAge - currentAge + 1);
  const netEquityUsd = config.position.totalBtcHeld * btcPriceUsd - debtUsd;
  const terminalReserveUsd = strategy.terminalReserveBtc * btcPriceUsd;
  const spendableEquityUsd = Math.max(0, netEquityUsd - terminalReserveUsd);
  const rawArvaDrawUsd = calculateAnnuityPayment(spendableEquityUsd, strategy.assumedRealReturnPct / 100, remainingYears);
  const targetDrawUsd = Math.min(rawArvaDrawUsd, strategy.incomeCapUsd ?? Infinity);
  const actualDrawUsd = Math.min(targetDrawUsd, availableSafeDrawUsd);
  const skippedIncomeUsd = Math.max(0, targetDrawUsd - actualDrawUsd);
  const reasonCodes = [strategy.incomeCapUsd !== undefined && strategy.incomeCapUsd < rawArvaDrawUsd ? 'arva_income_cap' : 'arva_raw'];

  if (actualDrawUsd < targetDrawUsd) reasonCodes.push('arva_safety_override');

  return {
    targetDrawUsd,
    actualDrawUsd,
    skippedIncomeUsd,
    reasonCodes,
  };
}

function calculateAnnuityPayment(spendableEquityUsd: number, realReturn: number, remainingYears: number): number {
  if (spendableEquityUsd <= 0) return 0;
  if (Math.abs(realReturn) < RETURN_EPSILON) return spendableEquityUsd / remainingYears;
  return (spendableEquityUsd * realReturn) / (1 - (1 + realReturn) ** -remainingYears);
}
