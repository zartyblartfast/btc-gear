import type { BtcGearConfig, NormalizedBtcGearConfig, ProjectionStatus } from './types';

type RiskInput = {
  config: NormalizedBtcGearConfig;
  debtUsd: number;
  btcPriceUsd: number;
};

export type RiskMetrics = {
  collateralValueUsd: number;
  ltvPct: number;
  liquidationPriceUsd: number;
  dropToLiquidationPct: number;
  maxSafeDebtUsd: number;
  netEquityUsd: number;
  netBtcAfterDebt: number;
  status: ProjectionStatus;
  reasonCodes: string[];
};

export function normalizeAndValidateConfig(config: BtcGearConfig): NormalizedBtcGearConfig {
  validateFinite('startYear', config.startYear);
  validateIntegerRange('projectionYears', config.projectionYears, 1, 100);

  if (config.currentAge !== undefined) validateFinite('currentAge', config.currentAge);
  if (config.planningAge !== undefined) validateFinite('planningAge', config.planningAge);
  if (
    config.currentAge !== undefined &&
    config.planningAge !== undefined &&
    config.planningAge < config.currentAge
  ) {
    throw new Error('planningAge must be greater than or equal to currentAge');
  }

  validateFinite('totalBtcHeld', config.position.totalBtcHeld);
  validateFinite('collateralBtc', config.position.collateralBtc);
  validateFinite('debtUsd', config.position.debtUsd);
  validateFinite('btcPriceUsd', config.position.btcPriceUsd);

  if (config.position.totalBtcHeld < 0) throw new Error('totalBtcHeld must be >= 0');
  if (config.position.collateralBtc < 0) throw new Error('collateralBtc must be >= 0');
  if (config.position.collateralBtc > config.position.totalBtcHeld) {
    throw new Error('collateralBtc must be <= totalBtcHeld');
  }
  if (config.position.debtUsd < 0) throw new Error('debtUsd must be >= 0');
  if (config.position.btcPriceUsd <= 0) throw new Error('btcPriceUsd must be > 0');

  const apr = normalizePercent('aprPct', config.loan.aprPct, { min: 0, max: Infinity });
  const liquidationLtv = normalizePercent('liquidationLtvPct', config.loan.liquidationLtvPct, {
    minExclusive: 0,
    max: 100,
  });
  const incomeLtvCeiling = normalizePercent('incomeLtvCeilingPct', config.loan.incomeLtvCeilingPct, {
    min: 0,
    maxExclusive: config.loan.liquidationLtvPct,
  });
  const requiredDropBuffer = normalizePercent('requiredDropBufferPct', config.loan.requiredDropBufferPct, {
    min: 0,
    maxExclusive: 100,
  });

  validateStrategy(config);

  return {
    ...config,
    loan: {
      apr,
      liquidationLtv,
      incomeLtvCeiling,
      requiredDropBuffer,
    },
  };
}

export function calculateRiskMetrics({ config, debtUsd, btcPriceUsd }: RiskInput): RiskMetrics {
  validateFinite('debtUsd', debtUsd);
  validateFinite('btcPriceUsd', btcPriceUsd);
  if (debtUsd < 0) throw new Error('debtUsd must be >= 0');
  if (btcPriceUsd <= 0) throw new Error('btcPriceUsd must be > 0');

  const { collateralBtc, totalBtcHeld } = config.position;
  const collateralValueUsd = collateralBtc * btcPriceUsd;
  const liquidationThresholdDebtUsd = collateralValueUsd * config.loan.liquidationLtv;
  const maxDebtByIncomeLtv = collateralValueUsd * config.loan.incomeLtvCeiling;
  const maxDebtByBuffer = liquidationThresholdDebtUsd * (1 - config.loan.requiredDropBuffer);
  const maxSafeDebtUsd = Math.max(0, Math.min(maxDebtByIncomeLtv, maxDebtByBuffer));

  const ltv = collateralValueUsd === 0 ? Infinity : debtUsd / collateralValueUsd;
  const liquidationPriceUsd = collateralBtc === 0 || config.loan.liquidationLtv === 0
    ? Infinity
    : debtUsd / (collateralBtc * config.loan.liquidationLtv);
  const dropToLiquidation = Math.max(0, 1 - liquidationPriceUsd / btcPriceUsd);
  const netEquityUsd = totalBtcHeld * btcPriceUsd - debtUsd;
  const netBtcAfterDebt = totalBtcHeld - debtUsd / btcPriceUsd;

  const reasonCodes: string[] = [];
  let status: ProjectionStatus = 'green';

  if (debtUsd >= liquidationThresholdDebtUsd) {
    status = 'liquidated';
    reasonCodes.push('liquidation_threshold_breached');
  } else {
    if (debtUsd > maxSafeDebtUsd) {
      status = 'warning';
      reasonCodes.push('already_over_safe_debt');
    }
    if (debtUsd > maxDebtByIncomeLtv) {
      status = 'warning';
      reasonCodes.push('above_income_ltv_ceiling');
    }
    if (dropToLiquidation < config.loan.requiredDropBuffer) {
      status = 'warning';
      reasonCodes.push('below_required_drop_buffer');
    }
  }

  return {
    collateralValueUsd,
    ltvPct: ltv * 100,
    liquidationPriceUsd,
    dropToLiquidationPct: dropToLiquidation * 100,
    maxSafeDebtUsd,
    netEquityUsd,
    netBtcAfterDebt,
    status,
    reasonCodes,
  };
}

export function calculateAvailableSafeDrawUsd({
  config,
  startingDebtUsd,
  btcPriceUsd,
}: {
  config: NormalizedBtcGearConfig;
  startingDebtUsd: number;
  btcPriceUsd: number;
}): number {
  validateFinite('startingDebtUsd', startingDebtUsd);
  validateFinite('btcPriceUsd', btcPriceUsd);
  if (startingDebtUsd < 0) throw new Error('startingDebtUsd must be >= 0');
  if (btcPriceUsd <= 0) throw new Error('btcPriceUsd must be > 0');

  const debtAfterInterestUsd = startingDebtUsd * (1 + config.loan.apr);
  const { maxSafeDebtUsd } = calculateRiskMetrics({
    config,
    debtUsd: debtAfterInterestUsd,
    btcPriceUsd,
  });
  return Math.max(0, maxSafeDebtUsd - debtAfterInterestUsd);
}

function validateFinite(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function validateIntegerRange(name: string, value: number, min: number, max: number): void {
  validateFinite(name, value);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
}

type PercentBounds = {
  min?: number;
  minExclusive?: number;
  max?: number;
  maxExclusive?: number;
};

function normalizePercent(name: string, value: number, bounds: PercentBounds): number {
  validateFinite(name, value);
  if (value > 0 && value < 1) {
    throw new Error(`${name} must be provided as a human percent, e.g. 50 for 50%`);
  }
  if (bounds.min !== undefined && value < bounds.min) throw new Error(`${name} must be >= ${bounds.min}`);
  if (bounds.minExclusive !== undefined && value <= bounds.minExclusive) {
    throw new Error(`${name} must be > ${bounds.minExclusive}`);
  }
  if (bounds.max !== undefined && value > bounds.max) throw new Error(`${name} must be <= ${bounds.max}`);
  if (bounds.maxExclusive !== undefined && value >= bounds.maxExclusive) {
    throw new Error(`${name} must be < ${bounds.maxExclusive}`);
  }
  return value / 100;
}

function validateStrategy(config: BtcGearConfig): void {
  const { strategy } = config;
  switch (strategy.kind) {
    case 'fixedDraw':
      validateNonNegative('annualDrawUsd', strategy.annualDrawUsd);
      break;
    case 'supplementalGuardrail':
      validateNonNegative('desiredDrawUsd', strategy.desiredDrawUsd);
      if (strategy.minimumDrawUsd !== undefined) validateNonNegative('minimumDrawUsd', strategy.minimumDrawUsd);
      break;
    case 'arva':
      validateFinite('assumedRealReturnPct', strategy.assumedRealReturnPct);
      validateNonNegative('terminalReserveBtc', strategy.terminalReserveBtc);
      if (strategy.incomeCapUsd !== undefined) validateNonNegative('incomeCapUsd', strategy.incomeCapUsd);
      break;
    case 'arvaGuardrails':
      validateFinite('assumedRealReturnPct', strategy.assumedRealReturnPct);
      validateNonNegative('terminalReserveBtc', strategy.terminalReserveBtc);
      normalizePercent('maxAnnualIncreasePct', strategy.maxAnnualIncreasePct, { min: 0 });
      normalizePercent('maxAnnualDecreasePct', strategy.maxAnnualDecreasePct, { min: 0, max: 100 });
      if (strategy.incomeCapUsd !== undefined) validateNonNegative('incomeCapUsd', strategy.incomeCapUsd);
      break;
    case 'maxSafeCapacity':
      break;
  }
}

function validateNonNegative(name: string, value: number): void {
  validateFinite(name, value);
  if (value < 0) throw new Error(`${name} must be >= 0`);
}
