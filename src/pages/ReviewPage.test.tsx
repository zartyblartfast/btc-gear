import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReviewPage } from './ReviewPage';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';
import { createReviewStore } from '../store/reviewStore';
import { createMemoryStorage } from '../store/storage';
import type { BtcGearConfig } from '../engine/types';

function setup(config: BtcGearConfig = DEFAULT_BTC_GEAR_CONFIG) {
  const store = createReviewStore(createMemoryStorage());
  render(<ReviewPage config={config} reviewStore={store} />);
  return { store };
}

describe('ReviewPage', () => {
  it('renders a review form initialized from current config', () => {
    setup();

    expect(screen.getByLabelText('Review date')).toBeInTheDocument();
    expect(screen.getByLabelText('BTC price USD')).toHaveValue(100000);
    expect(screen.getByLabelText('Total BTC held')).toHaveValue(2);
    expect(screen.getByLabelText('Collateral BTC')).toHaveValue(1);
    expect(screen.getByLabelText('Debt USD')).toHaveValue(50000);
    expect(screen.getByLabelText('Actual income drawn USD')).toHaveValue(0);
  });

  it('saving a review writes to the injected ReviewStore and shows the backup prompt', async () => {
    const user = userEvent.setup();
    const { store } = setup();

    await user.clear(screen.getByLabelText('Review date'));
    await user.type(screen.getByLabelText('Review date'), '2026-06-30');
    await user.clear(screen.getByLabelText('BTC price USD'));
    await user.type(screen.getByLabelText('BTC price USD'), '125000');
    await user.clear(screen.getByLabelText('Debt USD'));
    await user.type(screen.getByLabelText('Debt USD'), '65000');
    await user.clear(screen.getByLabelText('Actual income drawn USD'));
    await user.type(screen.getByLabelText('Actual income drawn USD'), '15000');
    await user.type(screen.getByLabelText('Notes'), 'Quarterly review');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(store.listReviews()).toHaveLength(1);
    expect(store.listReviews()[0]).toEqual(expect.objectContaining({ btcPriceUsd: 125000, debtUsd: 65000, actualIncomeDrawnUsd: 15000, notes: 'Quarterly review' }));
    expect(screen.getByText(/Review saved\. Export a profile backup now/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });

  it('updates review history table and chart labels after save', async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText('Review date'));
    await user.type(screen.getByLabelText('Review date'), '2026-07-15');
    await user.clear(screen.getByLabelText('BTC price USD'));
    await user.type(screen.getByLabelText('BTC price USD'), '130000');
    await user.clear(screen.getByLabelText('Actual income drawn USD'));
    await user.type(screen.getByLabelText('Actual income drawn USD'), '21000');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    const history = screen.getByLabelText('Review history');
    expect(within(history).getByText('2026-07-15')).toBeInTheDocument();
    expect(within(history).getByText('$130,000')).toBeInTheDocument();
    expect(screen.getByText('Actual history chart data')).toBeInTheDocument();
    expect(screen.getByText(/Actual BTC price/i)).toBeInTheDocument();
  });

  it('shows revised projection starting from latest actual debt and BTC price', async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText('BTC price USD'));
    await user.type(screen.getByLabelText('BTC price USD'), '140000');
    await user.clear(screen.getByLabelText('Debt USD'));
    await user.type(screen.getByLabelText('Debt USD'), '72000');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    const revised = screen.getByLabelText('Revised projection');
    expect(within(revised).getByText('Starts from latest actuals')).toBeInTheDocument();
    expect(within(revised).getByText('$140,000')).toBeInTheDocument();
    expect(within(revised).getByText('$72,000')).toBeInTheDocument();
  });

  it('shows strategy-changed warning when baseline strategy differs', () => {
    const changedConfig: BtcGearConfig = { ...DEFAULT_BTC_GEAR_CONFIG, strategy: { kind: 'fixedDraw', annualDrawUsd: 30_000 } };
    const store = createReviewStore(createMemoryStorage());
    store.lockBaseline(DEFAULT_BTC_GEAR_CONFIG, '2026-01-01T00:00:00.000Z');

    render(<ReviewPage config={changedConfig} reviewStore={store} />);

    expect(screen.getByText('Strategy changed. Plan-vs-actual comparison is paused until rebaseline.')).toBeInTheDocument();
  });

  it('rebaseline from latest review updates baseline status and state', async () => {
    const user = userEvent.setup();
    const { store } = setup();

    await user.clear(screen.getByLabelText('BTC price USD'));
    await user.type(screen.getByLabelText('BTC price USD'), '150000');
    await user.clear(screen.getByLabelText('Debt USD'));
    await user.type(screen.getByLabelText('Debt USD'), '80000');
    await user.click(screen.getByRole('button', { name: 'Save review' }));
    await user.click(screen.getByRole('button', { name: 'Rebaseline from latest review' }));

    expect(store.getBaseline()?.config.position).toEqual(expect.objectContaining({ btcPriceUsd: 150000, debtUsd: 80000 }));
    expect(screen.getByText(/Baseline locked/)).toBeInTheDocument();
    expect(screen.getByText(/Baseline starts at \$150,000 BTC price and \$80,000 debt/)).toBeInTheDocument();
  });
});
