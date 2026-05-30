import { buildPricePathUsd } from './pricePaths';
import { calculateRiskMetrics, normalizeAndValidateConfig } from './risk';
import { calculateStrategyDecision, resolveRowStatus } from './strategies';
import type { BtcGearConfig, ProjectionSummary, ProjectionYear } from './types';

export type ProjectionResult = {
  rows: ProjectionYear[];
  summary: ProjectionSummary;
};

export function buildProjection(config: BtcGearConfig): ProjectionResult {
  const normalizedConfig = normalizeAndValidateConfig(config);
  const btcPricesUsd = buildPricePathUsd(normalizedConfig);
  const rows: ProjectionYear[] = [];
  let startingDebtUsd = normalizedConfig.position.debtUsd;

  for (let index = 0; index < normalizedConfig.projectionYears; index += 1) {
    const btcPriceUsd = btcPricesUsd[index];
    const interestUsd = startingDebtUsd * normalizedConfig.loan.apr;
    const debtAfterInterestUsd = startingDebtUsd + interestUsd;
    const preDrawRisk = calculateRiskMetrics({
      config: normalizedConfig,
      debtUsd: debtAfterInterestUsd,
      btcPriceUsd,
    });
    const availableSafeDrawUsd = Math.max(0, preDrawRisk.maxSafeDebtUsd - debtAfterInterestUsd);
    const strategyDecision = calculateStrategyDecision({
      strategy: normalizedConfig.strategy,
      availableSafeDrawUsd,
      config: normalizedConfig,
      yearIndex: index,
      previousActualDrawUsd: rows[index - 1]?.actualDrawUsd,
    });
    const endingDebtUsd = debtAfterInterestUsd + strategyDecision.actualDrawUsd;
    const endingRisk = calculateRiskMetrics({
      config: normalizedConfig,
      debtUsd: endingDebtUsd,
      btcPriceUsd,
    });
    const status = resolveRowStatus({
      riskStatus: endingRisk.status,
      targetDrawUsd: strategyDecision.targetDrawUsd,
      actualDrawUsd: strategyDecision.actualDrawUsd,
    });

    rows.push({
      index,
      year: normalizedConfig.startYear + index,
      age: normalizedConfig.currentAge === undefined ? undefined : normalizedConfig.currentAge + index,
      btcPriceUsd,
      startingDebtUsd,
      interestUsd,
      debtAfterInterestUsd,
      targetDrawUsd: strategyDecision.targetDrawUsd,
      actualDrawUsd: strategyDecision.actualDrawUsd,
      skippedIncomeUsd: strategyDecision.skippedIncomeUsd,
      endingDebtUsd,
      collateralBtc: normalizedConfig.position.collateralBtc,
      totalBtcHeld: normalizedConfig.position.totalBtcHeld,
      collateralValueUsd: endingRisk.collateralValueUsd,
      netEquityUsd: endingRisk.netEquityUsd,
      netBtcAfterDebt: endingRisk.netBtcAfterDebt,
      ltvPct: endingRisk.ltvPct,
      liquidationPriceUsd: endingRisk.liquidationPriceUsd,
      dropToLiquidationPct: endingRisk.dropToLiquidationPct,
      maxSafeDebtUsd: preDrawRisk.maxSafeDebtUsd,
      availableSafeDrawUsd,
      status,
      reasonCodes: [...strategyDecision.reasonCodes, ...endingRisk.reasonCodes],
    });

    startingDebtUsd = endingDebtUsd;
  }

  return {
    rows,
    summary: summarizeProjection(rows),
  };
}

function summarizeProjection(rows: ProjectionYear[]): ProjectionSummary {
  const finalRow = rows[rows.length - 1];
  const totalIncomeDrawnUsd = rows.reduce((sum, row) => sum + row.actualDrawUsd, 0);
  const totalSkippedIncomeUsd = rows.reduce((sum, row) => sum + row.skippedIncomeUsd, 0);
  const maxLtvPct = Math.max(...rows.map((row) => row.ltvPct));
  const minDropToLiquidationPct = Math.min(...rows.map((row) => row.dropToLiquidationPct));
  const firstWarningYear = rows.find(hasWarningRisk)?.year;
  const firstConstrainedYear = rows.find((row) => row.status === 'constrained')?.year;
  const liquidationYear = rows.find((row) => row.status === 'liquidated')?.year;

  return {
    totalIncomeDrawnUsd,
    totalSkippedIncomeUsd,
    finalDebtUsd: finalRow.endingDebtUsd,
    finalNetBtcAfterDebt: finalRow.netBtcAfterDebt,
    finalNetEquityUsd: finalRow.netEquityUsd,
    maxLtvPct,
    minDropToLiquidationPct,
    firstWarningYear,
    firstConstrainedYear,
    liquidationYear,
    safeAllYears: rows.every((row) => row.status === 'green' && !hasWarningRisk(row)),
  };
}

function hasWarningRisk(row: ProjectionYear): boolean {
  return (
    row.status === 'warning' ||
    row.reasonCodes.includes('already_over_safe_debt') ||
    row.reasonCodes.includes('above_income_ltv_ceiling') ||
    row.reasonCodes.includes('below_required_drop_buffer')
  );
}
