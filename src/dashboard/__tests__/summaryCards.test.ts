import { describe, expect, it } from 'vitest';
import { buildProjection } from '../../engine/projection';
import type { BtcGearConfig } from '../../engine/types';
import { buildDashboardSummaryCards } from '../summaryCards';

const baseConfig: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 3,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 10_000,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 80,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 10_000 },
};

describe('buildDashboardSummaryCards', () => {
  it('summarizes the required dashboard card values from projection output', () => {
    const cards = buildDashboardSummaryCards(buildProjection(baseConfig));

    expect(cards).toEqual([
      {
        id: 'btc-price',
        title: 'Current BTC price',
        value: '$100,000',
        detail: 'Projection starts in 2026',
        tone: 'neutral',
      },
      {
        id: 'debt',
        title: 'Current debt',
        value: '$10,000',
        detail: 'Projected final debt $40,000',
        tone: 'neutral',
      },
      {
        id: 'ltv',
        title: 'Year 1 LTV',
        value: '20.0%',
        detail: 'Max projected LTV 40.0%',
        tone: 'safe',
      },
      {
        id: 'buffer',
        title: 'Drop buffer',
        value: '75.0%',
        detail: 'Minimum projected buffer 50.0%',
        tone: 'safe',
      },
      {
        id: 'income',
        title: 'Income drawn',
        value: '$30,000',
        detail: '$0 skipped',
        tone: 'safe',
      },
      {
        id: 'final-net-btc',
        title: 'Final net BTC',
        value: '0.600000 BTC',
        detail: 'Final net equity $60,000',
        tone: 'neutral',
      },
    ]);
  });

  it('updates card values when the projection changes', () => {
    const lowerPriceConfig: BtcGearConfig = {
      ...baseConfig,
      position: { ...baseConfig.position, btcPriceUsd: 50_000 },
    };

    const baseCards = buildDashboardSummaryCards(buildProjection(baseConfig));
    const changedCards = buildDashboardSummaryCards(buildProjection(lowerPriceConfig));

    expect(changedCards.find((card) => card.id === 'btc-price')?.value).toBe('$50,000');
    expect(changedCards.find((card) => card.id === 'ltv')?.value).not.toBe(
      baseCards.find((card) => card.id === 'ltv')?.value,
    );
    expect(changedCards.find((card) => card.id === 'final-net-btc')?.value).not.toBe(
      baseCards.find((card) => card.id === 'final-net-btc')?.value,
    );
  });

  it('marks constrained income and weak buffers with warning tones', () => {
    const constrainedConfig: BtcGearConfig = {
      ...baseConfig,
      position: { ...baseConfig.position, debtUsd: 35_000 },
      strategy: { kind: 'fixedDraw', annualDrawUsd: 20_000 },
    };

    const cards = buildDashboardSummaryCards(buildProjection(constrainedConfig));

    expect(cards.find((card) => card.id === 'income')).toMatchObject({
      detail: '$50,000 skipped',
      tone: 'warning',
    });
    expect(cards.find((card) => card.id === 'buffer')?.tone).toBe('warning');
  });
});
