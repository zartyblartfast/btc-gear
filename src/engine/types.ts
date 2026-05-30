export type PricePathConfig =
  | { kind: 'flat' }
  | { kind: 'annualGrowth'; annualGrowthPct: number }
  | { kind: 'explicit'; pricesUsd: number[] }
  | { kind: 'namedStress'; name: 'flatDecade' | 'bearThenRecovery' | 'bullThenCrash'; annualGrowthPct?: number };

export type StrategyConfig =
  | { kind: 'fixedDraw'; annualDrawUsd: number }
  | { kind: 'supplementalGuardrail'; desiredDrawUsd: number; minimumDrawUsd?: number; allowCatchUp?: false }
  | { kind: 'arva'; assumedRealReturnPct: number; terminalReserveBtc: number; incomeCapUsd?: number }
  | {
      kind: 'arvaGuardrails';
      assumedRealReturnPct: number;
      terminalReserveBtc: number;
      maxAnnualIncreasePct: number;
      maxAnnualDecreasePct: number;
      incomeCapUsd?: number;
    }
  | { kind: 'maxSafeCapacity' };

export type BtcGearConfig = {
  startYear: number;
  projectionYears: number;
  currentAge?: number;
  planningAge?: number;
  position: {
    totalBtcHeld: number;
    collateralBtc: number;
    debtUsd: number;
    btcPriceUsd: number;
  };
  loan: {
    aprPct: number;
    liquidationLtvPct: number;
    incomeLtvCeilingPct: number;
    requiredDropBufferPct: number;
  };
  pricePath: PricePathConfig;
  strategy: StrategyConfig;
};

export type NormalizedBtcGearConfig = Omit<BtcGearConfig, 'loan'> & {
  loan: {
    apr: number;
    liquidationLtv: number;
    incomeLtvCeiling: number;
    requiredDropBuffer: number;
  };
};

export type ProjectionStatus = 'green' | 'warning' | 'constrained' | 'liquidated';

export type ProjectionYear = {
  index: number;
  year: number;
  age?: number;
  btcPriceUsd: number;
  startingDebtUsd: number;
  interestUsd: number;
  debtAfterInterestUsd: number;
  targetDrawUsd: number;
  actualDrawUsd: number;
  skippedIncomeUsd: number;
  endingDebtUsd: number;
  collateralBtc: number;
  totalBtcHeld: number;
  collateralValueUsd: number;
  netEquityUsd: number;
  netBtcAfterDebt: number;
  ltvPct: number;
  liquidationPriceUsd: number;
  dropToLiquidationPct: number;
  maxSafeDebtUsd: number;
  availableSafeDrawUsd: number;
  status: ProjectionStatus;
  reasonCodes: string[];
};

export type ProjectionSummary = {
  totalIncomeDrawnUsd: number;
  totalSkippedIncomeUsd: number;
  finalDebtUsd: number;
  finalNetBtcAfterDebt: number;
  finalNetEquityUsd: number;
  maxLtvPct: number;
  minDropToLiquidationPct: number;
  firstWarningYear?: number;
  firstConstrainedYear?: number;
  liquidationYear?: number;
  safeAllYears: boolean;
};
