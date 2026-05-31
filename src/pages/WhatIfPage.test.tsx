import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BtcGearConfig } from '../engine/types';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';
import { createScenarioStore } from '../store/scenarioStore';
import { createMemoryStorage } from '../store/storage';
import { WhatIfPage } from './WhatIfPage';

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}

function setup(config: BtcGearConfig = DEFAULT_BTC_GEAR_CONFIG) {
  const scenarioStore = createScenarioStore(createMemoryStorage());
  render(<WhatIfPage config={config} scenarioStore={scenarioStore} />);
  return { scenarioStore };
}

describe('WhatIfPage', () => {
  it('renders sandbox initialized from current config', () => {
    setup();

    expect(screen.getByLabelText('Sandbox BTC price USD')).toHaveValue(100000);
    expect(screen.getByLabelText('Sandbox debt USD')).toHaveValue(50000);
    expect(screen.getByLabelText('Sandbox annual draw USD')).toHaveValue(20000);
  });

  it('changing sandbox debt and BTC price updates sandbox projection without mutating live config', async () => {
    const user = userEvent.setup();
    const config = cloneConfig(DEFAULT_BTC_GEAR_CONFIG);
    const before = cloneConfig(config);
    const saveConfig = vi.fn();
    setup(config);

    const originalFinalDebt = screen.getByLabelText('Sandbox final debt').textContent;
    await user.clear(screen.getByLabelText('Sandbox debt USD'));
    await user.type(screen.getByLabelText('Sandbox debt USD'), '90000');
    await user.clear(screen.getByLabelText('Sandbox BTC price USD'));
    await user.type(screen.getByLabelText('Sandbox BTC price USD'), '75000');

    expect(screen.getByLabelText('Sandbox final debt').textContent).not.toEqual(originalFinalDebt);
    expect(config).toEqual(before);
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('saving scenario persists to injected ScenarioStore and list shows it', async () => {
    const user = userEvent.setup();
    const { scenarioStore } = setup();

    await user.clear(screen.getByLabelText('Scenario name'));
    await user.type(screen.getByLabelText('Scenario name'), 'Bear case draw');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    expect(scenarioStore.listScenarios()).toHaveLength(1);
    expect(scenarioStore.listScenarios()[0]).toMatchObject({ name: 'Bear case draw' });
    expect(screen.getAllByText('Bear case draw').length).toBeGreaterThan(0);
  });

  it('loading saved scenario restores sandbox values', async () => {
    const user = userEvent.setup();
    const { scenarioStore } = setup();
    scenarioStore.saveScenario({
      id: 'saved-1',
      name: 'Saved high debt',
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z',
      config: { ...DEFAULT_BTC_GEAR_CONFIG, position: { ...DEFAULT_BTC_GEAR_CONFIG.position, debtUsd: 123_456 } },
    });

    await user.click(screen.getByRole('button', { name: 'Refresh scenarios' }));
    await user.clear(screen.getByLabelText('Sandbox debt USD'));
    await user.type(screen.getByLabelText('Sandbox debt USD'), '77777');
    await user.click(screen.getByRole('button', { name: 'Load Saved high debt' }));

    expect(screen.getByLabelText('Sandbox debt USD')).toHaveValue(123456);
  });

  it('comparison table includes live, sandbox, and saved scenario rows', async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText('Scenario name'));
    await user.type(screen.getByLabelText('Scenario name'), 'Comparison saved');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    const comparison = screen.getByRole('table', { name: 'Scenario comparison table' });
    expect(within(comparison).getByRole('row', { name: /Live profile/i })).toBeInTheDocument();
    expect(within(comparison).getByRole('row', { name: /Sandbox/i })).toBeInTheDocument();
    expect(within(comparison).getByRole('row', { name: /Comparison saved/i })).toBeInTheDocument();
  });

  it('heatmap section renders', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Stress heatmap' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'What if heatmap table' })).toBeInTheDocument();
  });
});
