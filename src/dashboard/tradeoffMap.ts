import { buildProjection } from '../engine/projection';
import type { BtcGearConfig, PricePathConfig, ProjectionStatus, StrategyConfig } from '../engine/types';

export type TradeoffScenario = {
  id: string;
  label: string;
  config: BtcGearConfig;
  strategyFamily: string;
  pricePathLabel: string;
  drawLabel: string;
  bufferLabel: string;
  ceilingLabel: string;
  totalIncomeFundedUsd: number;
  totalSkippedIncomeUsd: number;
  minDropToLiquidationPct: number;
  maxLtvPct: number;
  finalNetBtcAfterDebt: number;
  status: ProjectionStatus;
  firstWarningYear?: number;
  firstConstrainedYear?: number;
  liquidationYear?: number;
  requiredDropBufferPct: number;
  isCurrentScenario: boolean;
  isRecommended: boolean;
  score?: number;
};

export type TradeoffScenarioGridOptions = {
  drawMultipliers: number[];
  requiredDropBufferPctValues: number[];
  incomeLtvCeilingPctValues: number[];
  pricePaths: Array<{ label: string; config: PricePathConfig }>;
};

export type TradeoffScoreOptions = {
  includeDiagnosticRecommendations: boolean;
};

export type TradeoffMapResult = {
  scenarios: TradeoffScenario[];
  recommendedScenarioId?: string;
  noRecommendationMessage?: string;
};

const NO_RECOMMENDATION_MESSAGE = 'No recommended scenario under selected assumptions.';

export function buildTradeoffScenarioGrid(config: BtcGearConfig, options: Partial<TradeoffScenarioGridOptions> = {}): TradeoffScenario[] {
  const gridOptions = resolveGridOptions(config, options);
  const scenarios: TradeoffScenario[] = [buildScenario('current', 'Current scenario', config, true, 'Current path')];
  const seen = new Set([scenarioKey(config)]);

  gridOptions.drawMultipliers.forEach((drawMultiplier) => {
    gridOptions.requiredDropBufferPctValues.forEach((requiredBufferPct) => {
      gridOptions.incomeLtvCeilingPctValues.forEach((incomeLtvCeilingPct) => {
        gridOptions.pricePaths.forEach((pricePath) => {
          const scenarioConfig: BtcGearConfig = {
            ...cloneConfig(config),
            loan: {
              ...config.loan,
              requiredDropBufferPct: requiredBufferPct,
              incomeLtvCeilingPct,
            },
            pricePath: clonePricePath(pricePath.config),
            strategy: scaleStrategyDraw(config.strategy, drawMultiplier),
          };
          const key = scenarioKey(scenarioConfig);

          if (seen.has(key)) {
            return;
          }

          seen.add(key);
          const id = `draw-${formatIdNumber(drawMultiplier)}-buffer-${formatIdNumber(requiredBufferPct)}-ceiling-${formatIdNumber(incomeLtvCeilingPct)}-path-${slug(pricePath.label)}`;
          scenarios.push(buildScenario(id, scenarioLabel(scenarioConfig, pricePath.label), scenarioConfig, false, pricePath.label));
        });
      });
    });
  });

  return scenarios;
}

export function scoreTradeoffScenarios(
  scenarios: TradeoffScenario[],
  options: Partial<TradeoffScoreOptions> = {},
): TradeoffMapResult {
  const includeDiagnosticRecommendations = options.includeDiagnosticRecommendations ?? false;
  const qualifying = scenarios.filter(
    (scenario) =>
      scenario.status !== 'liquidated' &&
      scenario.minDropToLiquidationPct >= scenario.requiredDropBufferPct &&
      (includeDiagnosticRecommendations || scenario.config.strategy.kind !== 'maxSafeCapacity'),
  );

  const scored = scenarios.map((scenario) => ({ ...scenario, isRecommended: false, score: undefined }));

  if (qualifying.length === 0) {
    return { scenarios: scored, noRecommendationMessage: NO_RECOMMENDATION_MESSAGE };
  }

  const incomeRange = range(qualifying.map((scenario) => scenario.totalIncomeFundedUsd));
  const safetyRange = range(qualifying.map((scenario) => scenario.minDropToLiquidationPct));
  const finalBtcRange = range(qualifying.map((scenario) => scenario.finalNetBtcAfterDebt));
  const scores = new Map<string, number>();

  qualifying.forEach((scenario) => {
    const score =
      0.4 * normalize(scenario.totalIncomeFundedUsd, incomeRange) +
      0.35 * normalize(scenario.minDropToLiquidationPct, safetyRange) +
      0.25 * normalize(scenario.finalNetBtcAfterDebt, finalBtcRange);
    scores.set(scenario.id, score);
  });

  const recommendedScenarioId = [...qualifying]
    .sort((left, right) => (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0) || left.id.localeCompare(right.id))[0]?.id;

  return {
    scenarios: scored.map((scenario) => ({
      ...scenario,
      score: scores.get(scenario.id),
      isRecommended: scenario.id === recommendedScenarioId,
    })),
    recommendedScenarioId,
  };
}

export function buildTradeoffMap(
  config: BtcGearConfig,
  options: Partial<TradeoffScenarioGridOptions & TradeoffScoreOptions> = {},
): TradeoffMapResult {
  return scoreTradeoffScenarios(buildTradeoffScenarioGrid(config, options), options);
}

function buildScenario(
  id: string,
  label: string,
  config: BtcGearConfig,
  isCurrentScenario: boolean,
  pricePathLabel: string,
): TradeoffScenario {
  const projection = buildProjection(config);
  const summary = projection.summary;

  return {
    id,
    label,
    config: cloneConfig(config),
    strategyFamily: strategyFamily(config.strategy),
    pricePathLabel,
    drawLabel: drawLabel(config.strategy),
    bufferLabel: `${formatPct(config.loan.requiredDropBufferPct)} required buffer`,
    ceilingLabel: `${formatPct(config.loan.incomeLtvCeilingPct)} income LTV ceiling`,
    totalIncomeFundedUsd: summary.totalIncomeDrawnUsd,
    totalSkippedIncomeUsd: summary.totalSkippedIncomeUsd,
    minDropToLiquidationPct: summary.minDropToLiquidationPct,
    maxLtvPct: summary.maxLtvPct,
    finalNetBtcAfterDebt: summary.finalNetBtcAfterDebt,
    status: worstStatus(projection.rows.map((row) => row.status)),
    firstWarningYear: summary.firstWarningYear,
    firstConstrainedYear: summary.firstConstrainedYear,
    liquidationYear: summary.liquidationYear,
    requiredDropBufferPct: config.loan.requiredDropBufferPct,
    isCurrentScenario,
    isRecommended: false,
  };
}

function resolveGridOptions(config: BtcGearConfig, options: Partial<TradeoffScenarioGridOptions>): TradeoffScenarioGridOptions {
  return {
    drawMultipliers: uniqueNumbers(options.drawMultipliers ?? [0.75, 1, 1.25]),
    requiredDropBufferPctValues: uniqueNumbers(options.requiredDropBufferPctValues ?? [
      Math.max(0, config.loan.requiredDropBufferPct - 10),
      config.loan.requiredDropBufferPct,
      config.loan.requiredDropBufferPct + 10,
    ]),
    incomeLtvCeilingPctValues: uniqueNumbers(options.incomeLtvCeilingPctValues ?? [
      Math.max(1, config.loan.incomeLtvCeilingPct - 10),
      config.loan.incomeLtvCeilingPct,
      Math.min(config.loan.liquidationLtvPct - 1, config.loan.incomeLtvCeilingPct + 10),
    ]),
    pricePaths: dedupePricePaths(options.pricePaths ?? defaultPricePaths(config)),
  };
}

function defaultPricePaths(config: BtcGearConfig): Array<{ label: string; config: PricePathConfig }> {
  const currentGrowth = config.pricePath.kind === 'annualGrowth' ? config.pricePath.annualGrowthPct : 5;
  return [
    { label: 'Current path', config: clonePricePath(config.pricePath) },
    { label: 'Flat path', config: { kind: 'flat' } },
    { label: 'Bear then recovery', config: { kind: 'namedStress', name: 'bearThenRecovery' } },
    { label: 'Higher growth', config: { kind: 'annualGrowth', annualGrowthPct: currentGrowth + 5 } },
  ];
}

function scaleStrategyDraw(strategy: StrategyConfig, multiplier: number): StrategyConfig {
  switch (strategy.kind) {
    case 'fixedDraw':
      return { ...strategy, annualDrawUsd: Math.round(strategy.annualDrawUsd * multiplier) };
    case 'supplementalGuardrail':
      return { ...strategy, desiredDrawUsd: Math.round(strategy.desiredDrawUsd * multiplier) };
    case 'arva':
      return { ...strategy, incomeCapUsd: Math.round((strategy.incomeCapUsd ?? 50_000) * multiplier) };
    case 'arvaGuardrails':
      return { ...strategy, incomeCapUsd: Math.round((strategy.incomeCapUsd ?? 50_000) * multiplier) };
    case 'maxSafeCapacity':
      return { ...strategy };
  }
}

function drawLabel(strategy: StrategyConfig): string {
  switch (strategy.kind) {
    case 'fixedDraw':
      return `${formatUsd(strategy.annualDrawUsd)} fixed draw`;
    case 'supplementalGuardrail':
      return `${formatUsd(strategy.desiredDrawUsd)} desired draw`;
    case 'arva':
      return strategy.incomeCapUsd === undefined ? 'ARVA uncapped draw' : `${formatUsd(strategy.incomeCapUsd)} ARVA cap`;
    case 'arvaGuardrails':
      return strategy.incomeCapUsd === undefined ? 'ARVA Guardrails uncapped draw' : `${formatUsd(strategy.incomeCapUsd)} ARVA Guardrails cap`;
    case 'maxSafeCapacity':
      return 'Max safe capacity draw';
  }
}

function strategyFamily(strategy: StrategyConfig): string {
  switch (strategy.kind) {
    case 'fixedDraw':
      return 'Fixed Draw';
    case 'supplementalGuardrail':
      return 'Supplemental Guardrail';
    case 'arva':
      return 'ARVA';
    case 'arvaGuardrails':
      return 'ARVA Guardrails';
    case 'maxSafeCapacity':
      return 'Max Safe Capacity';
  }
}

function scenarioLabel(config: BtcGearConfig, pricePathLabel: string): string {
  return `${drawLabel(config.strategy)} / ${formatPct(config.loan.requiredDropBufferPct)} buffer / ${formatPct(config.loan.incomeLtvCeilingPct)} ceiling / ${pricePathLabel}`;
}

function worstStatus(statuses: ProjectionStatus[]): ProjectionStatus {
  const rank: Record<ProjectionStatus, number> = { green: 0, warning: 1, constrained: 2, liquidated: 3 };
  return statuses.reduce<ProjectionStatus>((worst, status) => (rank[status] > rank[worst] ? status : worst), 'green');
}

function normalize(value: number, valueRange: { min: number; max: number }): number {
  const denominator = valueRange.max - valueRange.min;
  if (denominator === 0) {
    return 1;
  }
  return (value - valueRange.min) / denominator;
}

function range(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function scenarioKey(config: BtcGearConfig): string {
  return JSON.stringify(config);
}

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}

function clonePricePath(pricePath: PricePathConfig): PricePathConfig {
  return JSON.parse(JSON.stringify(pricePath)) as PricePathConfig;
}

function dedupePricePaths(pricePaths: Array<{ label: string; config: PricePathConfig }>): Array<{ label: string; config: PricePathConfig }> {
  const seen = new Set<string>();
  return pricePaths.filter((pricePath) => {
    const key = JSON.stringify(pricePath.config);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.map((value) => Number(value.toFixed(4))))];
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatIdNumber(value: number): string {
  return String(value).replaceAll('.', 'p').replaceAll('-', 'm');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
