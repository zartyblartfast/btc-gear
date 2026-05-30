import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../engine/types';
import { DashboardPage } from './DashboardPage';

const config: BtcGearConfig = {
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

describe('DashboardPage', () => {
  it('renders summary cards from the projection output', () => {
    render(<DashboardPage config={config} />);

    expect(screen.getByLabelText('Dashboard overview')).toBeInTheDocument();
    expect(screen.getByText('Current BTC price')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument();
    expect(screen.getByText('Current debt')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
    expect(screen.getByText('Year 1 LTV')).toBeInTheDocument();
    expect(screen.getByText('20.0%')).toBeInTheDocument();
    expect(screen.getByText('Drop buffer')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('Income drawn')).toBeInTheDocument();
    expect(screen.getByText('$30,000')).toBeInTheDocument();
    expect(screen.getByText('Final net BTC')).toBeInTheDocument();
    expect(screen.getByText('0.600000 BTC')).toBeInTheDocument();
  });

  it('updates summary cards when config changes', () => {
    const { rerender } = render(<DashboardPage config={config} />);

    rerender(
      <DashboardPage
        config={{
          ...config,
          position: { ...config.position, btcPriceUsd: 50_000 },
        }}
      />,
    );

    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.queryByText('$100,000')).not.toBeInTheDocument();
  });

  it('renders the core projection chart sections without testing Recharts internals', () => {
    render(<DashboardPage config={config} />);

    expect(screen.getByRole('region', { name: 'Projection charts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'BTC price vs liquidation price' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LTV bands' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Income drawn vs skipped' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Net BTC after debt' })).toBeInTheDocument();
  });

  it('renders the Strategy Tradeoff Map section with markers and legend labels', () => {
    render(<DashboardPage config={config} />);

    expect(screen.getByRole('region', { name: 'Strategy Tradeoff Map' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Strategy Tradeoff Map' })).toBeInTheDocument();
    expect(screen.getByText('Current scenario')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('Best Tradeoff')).toBeInTheDocument();
    expect(screen.getByText('High Income / High Risk')).toBeInTheDocument();
    expect(screen.getByText('Conservative')).toBeInTheDocument();
    expect(screen.getByText('Weak Tradeoff')).toBeInTheDocument();
  });
});
