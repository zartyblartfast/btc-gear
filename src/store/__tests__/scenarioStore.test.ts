import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../../engine/types';
import { createMemoryStorage } from '../storage';
import { createScenarioStore, SCENARIOS_KEY, type SavedScenario } from '../scenarioStore';

const baseConfig: BtcGearConfig = {
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

const savedScenario: SavedScenario = {
  id: 'scenario-1',
  name: 'Balanced supplemental',
  description: 'Keeps a larger buffer',
  createdAt: '2026-05-30T10:00:00.000Z',
  updatedAt: '2026-05-30T10:00:00.000Z',
  config: baseConfig,
};

describe('createScenarioStore', () => {
  it('lists no scenarios when storage is empty', () => {
    const store = createScenarioStore(createMemoryStorage());

    expect(store.listScenarios()).toEqual([]);
  });

  it('saves and loads a scenario by id', () => {
    const storage = createMemoryStorage();
    const store = createScenarioStore(storage);

    store.saveScenario(savedScenario);

    expect(JSON.parse(storage.getItem(SCENARIOS_KEY) ?? '')).toEqual([savedScenario]);
    expect(store.loadScenario(savedScenario.id)).toEqual(savedScenario);
  });

  it('replaces an existing scenario with the same id instead of duplicating it', () => {
    const store = createScenarioStore(createMemoryStorage({ [SCENARIOS_KEY]: JSON.stringify([savedScenario]) }));
    const updatedScenario = {
      ...savedScenario,
      name: 'Updated name',
      updatedAt: '2026-05-31T10:00:00.000Z',
    };

    store.saveScenario(updatedScenario);

    expect(store.listScenarios()).toEqual([updatedScenario]);
  });

  it('renames a saved scenario and updates updatedAt', () => {
    const store = createScenarioStore(createMemoryStorage({ [SCENARIOS_KEY]: JSON.stringify([savedScenario]) }));

    const renamed = store.renameScenario(savedScenario.id, 'Conservative income', '2026-06-01T00:00:00.000Z');

    expect(renamed?.name).toBe('Conservative income');
    expect(renamed?.updatedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(store.loadScenario(savedScenario.id)?.name).toBe('Conservative income');
  });

  it('deletes a scenario by id', () => {
    const secondScenario = { ...savedScenario, id: 'scenario-2', name: 'Second' };
    const store = createScenarioStore(
      createMemoryStorage({ [SCENARIOS_KEY]: JSON.stringify([savedScenario, secondScenario]) }),
    );

    expect(store.deleteScenario(savedScenario.id)).toBe(true);

    expect(store.listScenarios()).toEqual([secondScenario]);
    expect(store.loadScenario(savedScenario.id)).toBeNull();
  });

  it('falls back to an empty list for malformed or wrong-shape storage', () => {
    const malformedStore = createScenarioStore(createMemoryStorage({ [SCENARIOS_KEY]: '{bad json' }));
    const wrongShapeStore = createScenarioStore(createMemoryStorage({ [SCENARIOS_KEY]: JSON.stringify([{ id: 'missing-fields' }]) }));

    expect(malformedStore.listScenarios()).toEqual([]);
    expect(wrongShapeStore.listScenarios()).toEqual([]);
  });

  it('returns defensive copies so callers cannot mutate persisted scenarios by reference', () => {
    const store = createScenarioStore(createMemoryStorage({ [SCENARIOS_KEY]: JSON.stringify([savedScenario]) }));
    const loaded = store.loadScenario(savedScenario.id);

    if (!loaded) {
      throw new Error('Expected scenario to load');
    }
    loaded.config.position.totalBtcHeld = 999;

    expect(store.loadScenario(savedScenario.id)?.config.position.totalBtcHeld).toBe(baseConfig.position.totalBtcHeld);
  });
});
