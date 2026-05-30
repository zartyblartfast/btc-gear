import type { BtcGearConfig, PricePathConfig, StrategyConfig } from '../engine/types';
import type { KeyValueStorage } from './storage';

export const PROFILE_CONFIG_KEY = 'btc-gear:profile-config';

export const DEFAULT_BTC_GEAR_CONFIG: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 30,
  currentAge: 50,
  planningAge: 80,
  position: {
    totalBtcHeld: 2,
    collateralBtc: 1,
    debtUsd: 50_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 6,
    liquidationLtvPct: 80,
    incomeLtvCeilingPct: 30,
    requiredDropBufferPct: 40,
  },
  pricePath: { kind: 'annualGrowth', annualGrowthPct: 5 },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 20_000 },
};

export type ProfileStore = {
  loadConfig(): BtcGearConfig;
  saveConfig(config: BtcGearConfig): void;
  resetConfig(): void;
};

export function createProfileStore(storage: KeyValueStorage): ProfileStore {
  return {
    loadConfig() {
      const saved = storage.getItem(PROFILE_CONFIG_KEY);

      if (saved === null) {
        return cloneConfig(DEFAULT_BTC_GEAR_CONFIG);
      }

      try {
        const parsed: unknown = JSON.parse(saved);
        return isBtcGearConfig(parsed) ? cloneConfig(parsed) : cloneConfig(DEFAULT_BTC_GEAR_CONFIG);
      } catch {
        return cloneConfig(DEFAULT_BTC_GEAR_CONFIG);
      }
    },
    saveConfig(config: BtcGearConfig) {
      storage.setItem(PROFILE_CONFIG_KEY, JSON.stringify(config));
    },
    resetConfig() {
      storage.removeItem(PROFILE_CONFIG_KEY);
    },
  };
}

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}

function isBtcGearConfig(value: unknown): value is BtcGearConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNumber(value.startYear) &&
    isNumber(value.projectionYears) &&
    isOptionalNumber(value.currentAge) &&
    isOptionalNumber(value.planningAge) &&
    isPosition(value.position) &&
    isLoan(value.loan) &&
    isPricePath(value.pricePath) &&
    isStrategy(value.strategy)
  );
}

function isPosition(value: unknown): value is BtcGearConfig['position'] {
  return (
    isRecord(value) &&
    isNumber(value.totalBtcHeld) &&
    isNumber(value.collateralBtc) &&
    isNumber(value.debtUsd) &&
    isNumber(value.btcPriceUsd)
  );
}

function isLoan(value: unknown): value is BtcGearConfig['loan'] {
  return (
    isRecord(value) &&
    isNumber(value.aprPct) &&
    isNumber(value.liquidationLtvPct) &&
    isNumber(value.incomeLtvCeilingPct) &&
    isNumber(value.requiredDropBufferPct)
  );
}

function isPricePath(value: unknown): value is PricePathConfig {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  switch (value.kind) {
    case 'flat':
      return true;
    case 'annualGrowth':
      return isNumber(value.annualGrowthPct);
    case 'explicit':
      return Array.isArray(value.pricesUsd) && value.pricesUsd.every(isNumber);
    case 'namedStress':
      return (
        (value.name === 'flatDecade' || value.name === 'bearThenRecovery' || value.name === 'bullThenCrash') &&
        isOptionalNumber(value.annualGrowthPct)
      );
    default:
      return false;
  }
}

function isStrategy(value: unknown): value is StrategyConfig {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  switch (value.kind) {
    case 'fixedDraw':
      return isNumber(value.annualDrawUsd);
    case 'supplementalGuardrail':
      return (
        isNumber(value.desiredDrawUsd) &&
        isOptionalNumber(value.minimumDrawUsd) &&
        (value.allowCatchUp === undefined || value.allowCatchUp === false)
      );
    case 'arva':
      return isNumber(value.assumedRealReturnPct) && isNumber(value.terminalReserveBtc) && isOptionalNumber(value.incomeCapUsd);
    case 'arvaGuardrails':
      return (
        isNumber(value.assumedRealReturnPct) &&
        isNumber(value.terminalReserveBtc) &&
        isNumber(value.maxAnnualIncreasePct) &&
        isNumber(value.maxAnnualDecreasePct) &&
        isOptionalNumber(value.incomeCapUsd)
      );
    case 'maxSafeCapacity':
      return true;
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNumber(value);
}
