import type { BtcGearConfig } from '../engine/types';
import { isBtcGearConfig } from './profileStore';
import { isBaselineSnapshot, isReviewSnapshot, type BaselineSnapshot, type ReviewSnapshot } from './reviewStore';
import { isSavedScenario, type SavedScenario } from './scenarioStore';

export const PROFILE_EXPORT_APP = 'btc-gear';
export const PROFILE_EXPORT_SCHEMA_VERSION = 1;

export type BtcGearProfileExportV1 = {
  app: 'btc-gear';
  schemaVersion: 1;
  exportedAt: string;
  appVersion?: string;
  config: BtcGearConfig;
  scenarios: SavedScenario[];
  reviews: ReviewSnapshot[];
  baseline?: BaselineSnapshot | null;
  preferences?: Record<string, unknown>;
};

export type ProfileExportInput = {
  exportedAt: string;
  appVersion?: string;
  config: BtcGearConfig;
  scenarios: SavedScenario[];
  reviews: ReviewSnapshot[];
  baseline?: BaselineSnapshot | null;
  preferences?: Record<string, unknown>;
};

export type ProfileImportPreview = {
  app: 'btc-gear';
  schemaVersion: 1;
  exportedAt: string;
  scenarioCount: number;
  reviewCount: number;
  hasBaseline: boolean;
};

export function createProfileExport(input: ProfileExportInput): BtcGearProfileExportV1 {
  const bundle: BtcGearProfileExportV1 = {
    app: PROFILE_EXPORT_APP,
    schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    config: clone(input.config),
    scenarios: clone(input.scenarios),
    reviews: clone(input.reviews),
    baseline: input.baseline === undefined ? null : clone(input.baseline),
  };

  if (input.appVersion !== undefined) {
    bundle.appVersion = input.appVersion;
  }

  if (input.preferences !== undefined) {
    bundle.preferences = clone(input.preferences);
  }

  return bundle;
}

export function parseProfileExport(jsonText: string): BtcGearProfileExportV1 {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Import file is not valid JSON');
  }

  if (!isRecord(parsed) || parsed.app !== PROFILE_EXPORT_APP) {
    throw new Error('Import file is not a btc-gear profile export');
  }

  if (parsed.schemaVersion !== PROFILE_EXPORT_SCHEMA_VERSION) {
    throw new Error('Unsupported btc-gear profile schema version');
  }

  if (!isProfileExportV1(parsed)) {
    throw new Error('Import file is missing required profile data');
  }

  return clone(parsed);
}

export function previewProfileImport(jsonText: string): ProfileImportPreview {
  const parsed = parseProfileExport(jsonText);

  return {
    app: parsed.app,
    schemaVersion: parsed.schemaVersion,
    exportedAt: parsed.exportedAt,
    scenarioCount: parsed.scenarios.length,
    reviewCount: parsed.reviews.length,
    hasBaseline: parsed.baseline !== null && parsed.baseline !== undefined,
  };
}

function isProfileExportV1(value: Record<string, unknown>): value is BtcGearProfileExportV1 {
  return (
    value.app === PROFILE_EXPORT_APP &&
    value.schemaVersion === PROFILE_EXPORT_SCHEMA_VERSION &&
    isNonEmptyString(value.exportedAt) &&
    isOptionalString(value.appVersion) &&
    isBtcGearConfig(value.config) &&
    Array.isArray(value.scenarios) &&
    value.scenarios.every(isSavedScenario) &&
    Array.isArray(value.reviews) &&
    value.reviews.every(isReviewSnapshot) &&
    (value.baseline === undefined || value.baseline === null || isBaselineSnapshot(value.baseline)) &&
    (value.preferences === undefined || isRecord(value.preferences))
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
