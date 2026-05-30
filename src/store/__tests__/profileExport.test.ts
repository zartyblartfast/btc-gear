import { describe, expect, it } from 'vitest';
import type { BtcGearConfig } from '../../engine/types';
import type { SavedScenario } from '../scenarioStore';
import type { BaselineSnapshot, ReviewSnapshot } from '../reviewStore';
import {
  createProfileExport,
  parseProfileExport,
  previewProfileImport,
  type BtcGearProfileExportV1,
} from '../profileExport';

const config: BtcGearConfig = {
  startYear: 2026,
  projectionYears: 3,
  position: {
    totalBtcHeld: 1,
    collateralBtc: 1,
    debtUsd: 0,
    btcPriceUsd: 100_000,
  },
  loan: {
    aprPct: 0,
    liquidationLtvPct: 50,
    incomeLtvCeilingPct: 45,
    requiredDropBufferPct: 20,
  },
  pricePath: { kind: 'flat' },
  strategy: { kind: 'fixedDraw', annualDrawUsd: 10_000 },
};

const scenario: SavedScenario = {
  id: 'scenario-1',
  name: 'Flat fixed',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-05-30T00:00:00.000Z',
  config,
};

const review: ReviewSnapshot = {
  id: 'review-1',
  reviewDate: '2027-01-01',
  btcPriceUsd: 100_000,
  btcPriceSource: 'manual',
  totalBtcHeld: 1,
  collateralBtc: 1,
  debtUsd: 10_000,
  actualIncomeDrawnUsd: 10_000,
  strategyKind: 'fixedDraw',
  strategyParams: { annualDrawUsd: 10_000 },
  notes: 'On plan',
};

const baseline: BaselineSnapshot = {
  id: 'baseline-1',
  lockedAt: '2026-05-30T00:00:00.000Z',
  config,
  strategyFingerprint: '{"annualDrawUsd":10000,"kind":"fixedDraw"}',
};

describe('profile export/import helpers', () => {
  it('creates a schema-versioned export bundle', () => {
    const bundle = createProfileExport({
      config,
      scenarios: [scenario],
      reviews: [review],
      baseline,
      exportedAt: '2026-05-30T12:00:00.000Z',
      appVersion: '0.1.0',
      preferences: { currency: 'USD' },
    });

    expect(bundle).toEqual({
      app: 'btc-gear',
      schemaVersion: 1,
      exportedAt: '2026-05-30T12:00:00.000Z',
      appVersion: '0.1.0',
      config,
      scenarios: [scenario],
      reviews: [review],
      baseline,
      preferences: { currency: 'USD' },
    });
  });

  it('parses a valid export and returns defensive copies', () => {
    const original = createProfileExport({
      config,
      scenarios: [scenario],
      reviews: [review],
      baseline,
      exportedAt: '2026-05-30T12:00:00.000Z',
    });

    const parsed = parseProfileExport(JSON.stringify(original));
    parsed.config.position.totalBtcHeld = 999;
    parsed.scenarios[0].config.position.totalBtcHeld = 999;

    const reparsed = parseProfileExport(JSON.stringify(original));
    expect(reparsed.config.position.totalBtcHeld).toBe(1);
    expect(reparsed.scenarios[0].config.position.totalBtcHeld).toBe(1);
  });

  it('previews a valid import without returning full financial details', () => {
    const bundle = createProfileExport({
      config,
      scenarios: [scenario],
      reviews: [review],
      baseline,
      exportedAt: '2026-05-30T12:00:00.000Z',
    });

    expect(previewProfileImport(JSON.stringify(bundle))).toEqual({
      app: 'btc-gear',
      schemaVersion: 1,
      exportedAt: '2026-05-30T12:00:00.000Z',
      scenarioCount: 1,
      reviewCount: 1,
      hasBaseline: true,
    });
  });

  it('rejects invalid JSON, wrong app, unsupported schema, and malformed payloads', () => {
    const valid = createProfileExport({ config, scenarios: [], reviews: [], exportedAt: '2026-05-30T12:00:00.000Z' });
    const wrongApp = { ...valid, app: 'other-app' };
    const wrongSchema = { ...valid, schemaVersion: 2 };
    const malformed = { ...valid, scenarios: [{ id: 'missing-fields' }] };

    expect(() => parseProfileExport('{bad json')).toThrow('Import file is not valid JSON');
    expect(() => parseProfileExport(JSON.stringify(wrongApp))).toThrow('Import file is not a btc-gear profile export');
    expect(() => parseProfileExport(JSON.stringify(wrongSchema))).toThrow('Unsupported btc-gear profile schema version');
    expect(() => parseProfileExport(JSON.stringify(malformed))).toThrow('Import file is missing required profile data');
  });

  it('accepts exports without a baseline', () => {
    const bundle: BtcGearProfileExportV1 = createProfileExport({
      config,
      scenarios: [],
      reviews: [],
      baseline: null,
      exportedAt: '2026-05-30T12:00:00.000Z',
    });

    expect(parseProfileExport(JSON.stringify(bundle)).baseline).toBeNull();
    expect(previewProfileImport(JSON.stringify(bundle)).hasBaseline).toBe(false);
  });
});
