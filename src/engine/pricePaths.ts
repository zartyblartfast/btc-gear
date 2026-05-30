import type { NormalizedBtcGearConfig, PricePathConfig } from './types';

type NamedStressPathName = Extract<PricePathConfig, { kind: 'namedStress' }>['name'];

const NAMED_STRESS_MULTIPLIERS: Record<NamedStressPathName, readonly number[]> = {
  flatDecade: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  bearThenRecovery: [1, 0.6, 0.5, 0.7, 0.9, 1.1, 1.25, 1.4, 1.55, 1.7],
  bullThenCrash: [1, 1.5, 2, 0.8, 0.9, 1.1, 1.25, 1.35, 1.45, 1.55],
};

export function getNamedStressMultipliers(name: NamedStressPathName): number[] {
  return [...NAMED_STRESS_MULTIPLIERS[name]];
}

export function buildPricePathUsd(config: NormalizedBtcGearConfig): number[] {
  const startingPriceUsd = config.position.btcPriceUsd;
  const projectionYears = config.projectionYears;

  const path = (() => {
    switch (config.pricePath.kind) {
      case 'flat':
        return Array.from({ length: projectionYears }, () => startingPriceUsd);
      case 'annualGrowth':
        return buildAnnualGrowthPath(startingPriceUsd, projectionYears, config.pricePath.annualGrowthPct);
      case 'explicit':
        return buildExplicitPath(config.pricePath.pricesUsd, projectionYears);
      case 'namedStress':
        return buildNamedStressPath(startingPriceUsd, projectionYears, config.pricePath.name, config.pricePath.annualGrowthPct);
    }
  })();

  validatePositivePrices(path, 'generated BTC price path');
  return path;
}

function buildAnnualGrowthPath(startingPriceUsd: number, projectionYears: number, annualGrowthPct: number): number[] {
  const annualGrowth = normalizeAnnualGrowthPct(annualGrowthPct);
  return Array.from({ length: projectionYears }, (_unused, index) => startingPriceUsd * (1 + annualGrowth) ** index);
}

function buildExplicitPath(pricesUsd: number[], projectionYears: number): number[] {
  if (!Array.isArray(pricesUsd) || pricesUsd.length < projectionYears) {
    throw new Error('explicit pricesUsd must cover projectionYears');
  }

  const path = pricesUsd.slice(0, projectionYears);
  validatePositivePrices(path, 'explicit pricesUsd');
  return path;
}

function buildNamedStressPath(
  startingPriceUsd: number,
  projectionYears: number,
  name: NamedStressPathName,
  annualGrowthPct = 0,
): number[] {
  const annualGrowth = normalizeAnnualGrowthPct(annualGrowthPct);
  const multipliers = NAMED_STRESS_MULTIPLIERS[name];
  const path: number[] = [];

  for (let index = 0; index < projectionYears; index += 1) {
    if (index < multipliers.length) {
      path.push(startingPriceUsd * multipliers[index]);
      continue;
    }

    const extraGrowthYears = index - multipliers.length + 1;
    const lastDocumentedPrice = startingPriceUsd * multipliers[multipliers.length - 1];
    path.push(lastDocumentedPrice * (1 + annualGrowth) ** extraGrowthYears);
  }

  return path;
}

function normalizeAnnualGrowthPct(annualGrowthPct: number): number {
  assertFiniteNumber(annualGrowthPct, 'annualGrowthPct');

  if (annualGrowthPct <= -100) {
    throw new Error('annualGrowthPct must be greater than -100');
  }

  return annualGrowthPct / 100;
}

function validatePositivePrices(pricesUsd: number[], label: string): void {
  pricesUsd.forEach((priceUsd, index) => {
    assertFiniteNumber(priceUsd, `${label}[${index}]`);

    if (priceUsd <= 0) {
      throw new Error(`${label} must contain only positive pricesUsd values`);
    }
  });
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}
