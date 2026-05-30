import type { BtcGearConfig } from '../engine/types';
import { isBtcGearConfig } from './profileStore';
import type { KeyValueStorage } from './storage';

export const SCENARIOS_KEY = 'btc-gear:scenarios';

export type SavedScenario = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  config: BtcGearConfig;
};

export type ScenarioStore = {
  listScenarios(): SavedScenario[];
  loadScenario(id: string): SavedScenario | null;
  saveScenario(scenario: SavedScenario): void;
  renameScenario(id: string, name: string, updatedAt: string): SavedScenario | null;
  deleteScenario(id: string): boolean;
};

export function createScenarioStore(storage: KeyValueStorage): ScenarioStore {
  function readScenarios(): SavedScenario[] {
    const saved = storage.getItem(SCENARIOS_KEY);

    if (saved === null) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      return isSavedScenarioArray(parsed) ? cloneScenarios(parsed) : [];
    } catch {
      return [];
    }
  }

  function writeScenarios(scenarios: SavedScenario[]): void {
    storage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
  }

  return {
    listScenarios() {
      return readScenarios();
    },
    loadScenario(id: string) {
      return readScenarios().find((scenario) => scenario.id === id) ?? null;
    },
    saveScenario(scenario: SavedScenario) {
      const scenarios = readScenarios();
      const existingIndex = scenarios.findIndex((existing) => existing.id === scenario.id);
      const nextScenario = cloneScenario(scenario);

      if (existingIndex === -1) {
        writeScenarios([...scenarios, nextScenario]);
      } else {
        writeScenarios(scenarios.map((existing) => (existing.id === scenario.id ? nextScenario : existing)));
      }
    },
    renameScenario(id: string, name: string, updatedAt: string) {
      const scenarios = readScenarios();
      const existing = scenarios.find((scenario) => scenario.id === id);

      if (!existing) {
        return null;
      }

      const renamed = { ...existing, name, updatedAt };
      writeScenarios(scenarios.map((scenario) => (scenario.id === id ? renamed : scenario)));
      return cloneScenario(renamed);
    },
    deleteScenario(id: string) {
      const scenarios = readScenarios();
      const nextScenarios = scenarios.filter((scenario) => scenario.id !== id);

      if (nextScenarios.length === scenarios.length) {
        return false;
      }

      writeScenarios(nextScenarios);
      return true;
    },
  };
}

function isSavedScenarioArray(value: unknown): value is SavedScenario[] {
  return Array.isArray(value) && value.every(isSavedScenario);
}

function isSavedScenario(value: unknown): value is SavedScenario {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isOptionalString(value.description) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isBtcGearConfig(value.config)
  );
}

function cloneScenarios(scenarios: SavedScenario[]): SavedScenario[] {
  return scenarios.map(cloneScenario);
}

function cloneScenario(scenario: SavedScenario): SavedScenario {
  return JSON.parse(JSON.stringify(scenario)) as SavedScenario;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
