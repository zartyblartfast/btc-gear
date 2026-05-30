import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../../engine/types';
import { createMemoryStorage } from '../storage';
import { createProfileStore, DEFAULT_BTC_GEAR_CONFIG, PROFILE_CONFIG_KEY } from '../profileStore';

const customConfig: BtcGearConfig = {
  startYear: 2030,
  projectionYears: 12,
  currentAge: 45,
  planningAge: 57,
  position: {
    totalBtcHeld: 3,
    collateralBtc: 1.5,
    debtUsd: 75_000,
    btcPriceUsd: 125_000,
  },
  loan: {
    aprPct: 7.5,
    liquidationLtvPct: 80,
    incomeLtvCeilingPct: 35,
    requiredDropBufferPct: 45,
  },
  pricePath: { kind: 'annualGrowth', annualGrowthPct: 5 },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 24_000 },
};

describe('createProfileStore', () => {
  it('loads the default BTC Gear config when nothing is saved', () => {
    const store = createProfileStore(createMemoryStorage());

    expect(store.loadConfig()).toEqual(DEFAULT_BTC_GEAR_CONFIG);
  });

  it('saves and loads the current BTC Gear config using the profile key', () => {
    const storage = createMemoryStorage();
    const store = createProfileStore(storage);

    store.saveConfig(customConfig);

    expect(JSON.parse(storage.getItem(PROFILE_CONFIG_KEY) ?? '')).toEqual(customConfig);
    expect(store.loadConfig()).toEqual(customConfig);
  });

  it('returns a defensive copy so callers cannot mutate persisted/default config by reference', () => {
    const store = createProfileStore(createMemoryStorage());
    const loaded = store.loadConfig();

    loaded.position.totalBtcHeld = 999;

    expect(store.loadConfig().position.totalBtcHeld).toBe(DEFAULT_BTC_GEAR_CONFIG.position.totalBtcHeld);
  });

  it('falls back safely to the default config for invalid JSON', () => {
    const store = createProfileStore(createMemoryStorage({ [PROFILE_CONFIG_KEY]: '{not valid json' }));

    expect(store.loadConfig()).toEqual(DEFAULT_BTC_GEAR_CONFIG);
  });

  it('falls back safely to the default config for JSON with the wrong shape', () => {
    const invalidShape = JSON.stringify({ startYear: 2030, projectionYears: 12 });
    const store = createProfileStore(createMemoryStorage({ [PROFILE_CONFIG_KEY]: invalidShape }));

    expect(store.loadConfig()).toEqual(DEFAULT_BTC_GEAR_CONFIG);
  });

  it('resets the saved config', () => {
    const storage = createMemoryStorage({ [PROFILE_CONFIG_KEY]: JSON.stringify(customConfig) });
    const store = createProfileStore(storage);

    store.resetConfig();

    expect(storage.getItem(PROFILE_CONFIG_KEY)).toBeNull();
    expect(store.loadConfig()).toEqual(DEFAULT_BTC_GEAR_CONFIG);
  });
});
