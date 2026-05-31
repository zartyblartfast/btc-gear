import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BtcGearConfig } from '../engine/types';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';
import { StrategyPage } from './StrategyPage';

function renderStrategy(config: BtcGearConfig = DEFAULT_BTC_GEAR_CONFIG) {
  const onSaveConfig = vi.fn();
  const onResetConfig = vi.fn();
  render(<StrategyPage config={config} onSaveConfig={onSaveConfig} onResetConfig={onResetConfig} />);
  return { onSaveConfig, onResetConfig };
}

describe('StrategyPage', () => {
  it('renders editable position, loan, price path, and strategy controls from config', () => {
    renderStrategy();

    expect(screen.getByLabelText('Total BTC held')).toHaveValue(2);
    expect(screen.getByLabelText('Collateral BTC')).toHaveValue(1);
    expect(screen.getByLabelText('Debt USD')).toHaveValue(50000);
    expect(screen.getByLabelText('BTC price USD')).toHaveValue(100000);
    expect(screen.getByLabelText('APR %')).toHaveValue(6);
    expect(screen.getByLabelText('Liquidation LTV %')).toHaveValue(80);
    expect(screen.getByLabelText('Income LTV ceiling %')).toHaveValue(30);
    expect(screen.getByLabelText('Required drop buffer %')).toHaveValue(40);
    expect(screen.getByLabelText('Price path kind')).toHaveValue('annualGrowth');
    expect(screen.getByLabelText('Annual growth %')).toHaveValue(5);
    expect(screen.getByLabelText('Strategy kind')).toHaveValue('fixedDraw');
    expect(screen.getByLabelText('Annual draw USD')).toHaveValue(20000);
  });

  it('saving changed position and loan fields calls onSaveConfig with updated config', async () => {
    const user = userEvent.setup();
    const { onSaveConfig } = renderStrategy();

    await user.clear(screen.getByLabelText('Total BTC held'));
    await user.type(screen.getByLabelText('Total BTC held'), '3.5');
    await user.clear(screen.getByLabelText('Debt USD'));
    await user.type(screen.getByLabelText('Debt USD'), '75000');
    await user.clear(screen.getByLabelText('APR %'));
    await user.type(screen.getByLabelText('APR %'), '7.25');
    await user.clear(screen.getByLabelText('Required drop buffer %'));
    await user.type(screen.getByLabelText('Required drop buffer %'), '45');
    await user.click(screen.getByRole('button', { name: 'Save config' }));

    expect(onSaveConfig).toHaveBeenCalledTimes(1);
    expect(onSaveConfig).toHaveBeenCalledWith({
      ...DEFAULT_BTC_GEAR_CONFIG,
      position: { ...DEFAULT_BTC_GEAR_CONFIG.position, totalBtcHeld: 3.5, debtUsd: 75000 },
      loan: { ...DEFAULT_BTC_GEAR_CONFIG.loan, aprPct: 7.25, requiredDropBufferPct: 45 },
    });
  });

  it('switching strategy kind changes visible strategy-specific fields', async () => {
    const user = userEvent.setup();
    renderStrategy();

    await user.selectOptions(screen.getByLabelText('Strategy kind'), 'arvaGuardrails');

    expect(screen.queryByLabelText('Annual draw USD')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Assumed real return %')).toHaveValue(3);
    expect(screen.getByLabelText('Terminal reserve BTC')).toHaveValue(0);
    expect(screen.getByLabelText('Max annual increase %')).toHaveValue(10);
    expect(screen.getByLabelText('Max annual decrease %')).toHaveValue(10);

    await user.selectOptions(screen.getByLabelText('Strategy kind'), 'maxSafeCapacity');

    expect(screen.queryByLabelText('Annual draw USD')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assumed real return %')).not.toBeInTheDocument();
    expect(screen.getByText(/draws up to the safe capacity/i)).toBeInTheDocument();
  });

  it('shows price-path conditional fields and saves parsed explicit prices', async () => {
    const user = userEvent.setup();
    const { onSaveConfig } = renderStrategy();

    await user.selectOptions(screen.getByLabelText('Price path kind'), 'flat');
    expect(screen.queryByLabelText('Annual growth %')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Price path kind'), 'explicit');
    expect(screen.getByLabelText('Explicit prices USD')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Explicit prices USD'));
    await user.type(screen.getByLabelText('Explicit prices USD'), '100000, 90000\n120000');

    await user.selectOptions(screen.getByLabelText('Price path kind'), 'namedStress');
    expect(screen.queryByLabelText('Explicit prices USD')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Named stress path')).toHaveValue('flatDecade');

    await user.selectOptions(screen.getByLabelText('Price path kind'), 'explicit');
    await user.clear(screen.getByLabelText('Explicit prices USD'));
    await user.type(screen.getByLabelText('Explicit prices USD'), '100000, 90000\n120000');
    await user.click(screen.getByRole('button', { name: 'Save config' }));

    expect(onSaveConfig).toHaveBeenCalledWith({
      ...DEFAULT_BTC_GEAR_CONFIG,
      pricePath: { kind: 'explicit', pricesUsd: [100000, 90000, 120000] },
    });
  });

  it('invalid required numeric input shows an accessible error and does not save', async () => {
    const user = userEvent.setup();
    const { onSaveConfig } = renderStrategy();

    fireEvent.change(screen.getByLabelText('Debt USD'), { target: { value: 'not-a-number' } });
    await user.click(screen.getByRole('button', { name: 'Save config' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Debt USD must be a finite number/i);
    expect(onSaveConfig).not.toHaveBeenCalled();
  });
});
