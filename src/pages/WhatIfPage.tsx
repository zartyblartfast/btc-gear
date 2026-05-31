import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { buildProjection } from '../engine/projection';
import type { BtcGearConfig, ProjectionStatus } from '../engine/types';
import { createScenarioStore, type SavedScenario, type ScenarioStore } from '../store/scenarioStore';
import { createBrowserStorage } from '../store/storage';
import { buildWhatIfHeatmap } from '../whatif/heatmap';

type WhatIfPageProps = {
  config: BtcGearConfig;
  scenarioStore?: ScenarioStore;
};

type SandboxForm = {
  btcPriceUsd: string;
  debtUsd: string;
  annualDrawUsd: string;
};

type ComparisonRow = {
  id: string;
  name: string;
  finalDebtUsd: number;
  finalLtvPct: number;
  totalIncomeDrawnUsd: number;
  totalSkippedIncomeUsd: number;
  finalNetBtc: number;
  worstStatus: ProjectionStatus;
};

const DEFAULT_PRICE_MULTIPLIERS = [0.7, 1, 1.3];
const DEFAULT_DRAW_MULTIPLIERS = [0.5, 1, 1.5];

export function WhatIfPage({
  config,
  scenarioStore = createScenarioStore(createBrowserStorage()),
}: WhatIfPageProps) {
  const [sandboxForm, setSandboxForm] = useState<SandboxForm>(() => formFromConfig(config));
  const [scenarioName, setScenarioName] = useState('Untitled scenario');
  const [scenarios, setScenarios] = useState<SavedScenario[]>(() => scenarioStore.listScenarios());

  useEffect(() => {
    setSandboxForm(formFromConfig(config));
  }, [config]);

  const sandboxConfig = useMemo(() => configFromForm(config, sandboxForm), [config, sandboxForm]);
  const sandboxProjection = useMemo(() => buildProjection(sandboxConfig), [sandboxConfig]);
  const comparisonRows = useMemo(
    () => [buildComparisonRow('live', 'Live profile', config), buildComparisonRow('sandbox', 'Sandbox', sandboxConfig), ...scenarios.map((scenario) => buildComparisonRow(scenario.id, scenario.name, scenario.config))],
    [config, sandboxConfig, scenarios],
  );
  const heatmapRows = useMemo(
    () =>
      buildWhatIfHeatmap(sandboxConfig, {
        priceMultipliers: DEFAULT_PRICE_MULTIPLIERS,
        drawMultipliers: DEFAULT_DRAW_MULTIPLIERS,
      }),
    [sandboxConfig],
  );

  function refreshScenarios() {
    setScenarios(scenarioStore.listScenarios());
  }

  function saveScenario() {
    const now = new Date().toISOString();
    const id = `scenario-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    scenarioStore.saveScenario({
      id,
      name: scenarioName.trim() || 'Untitled scenario',
      createdAt: now,
      updatedAt: now,
      config: cloneConfig(sandboxConfig),
    });
    refreshScenarios();
  }

  function loadScenario(id: string) {
    const scenario = scenarioStore.loadScenario(id);
    if (!scenario) return;
    setSandboxForm(formFromConfig(scenario.config));
    setScenarioName(scenario.name);
  }

  return (
    <section aria-label="What if sandbox">
      <p>Sandbox scenarios start from the live profile but edits stay isolated unless saved as scenarios.</p>

      <section aria-label="Sandbox controls" className="strategy-form">
        <label>
          Sandbox BTC price USD
          <input
            type="number"
            inputMode="decimal"
            value={sandboxForm.btcPriceUsd}
            onChange={(event) => setSandboxForm((form) => ({ ...form, btcPriceUsd: event.target.value }))}
          />
        </label>
        <label>
          Sandbox debt USD
          <input
            type="number"
            inputMode="decimal"
            value={sandboxForm.debtUsd}
            onChange={(event) => setSandboxForm((form) => ({ ...form, debtUsd: event.target.value }))}
          />
        </label>
        <label>
          Sandbox annual draw USD
          <input
            type="number"
            inputMode="decimal"
            value={sandboxForm.annualDrawUsd}
            onChange={(event) => setSandboxForm((form) => ({ ...form, annualDrawUsd: event.target.value }))}
          />
        </label>
      </section>

      <div className="summary-card-grid">
        <article className="summary-card" aria-label="Sandbox final debt">
          <h3>Sandbox final debt</h3>
          <p className="summary-card-value">{formatUsd(sandboxProjection.summary.finalDebtUsd)}</p>
        </article>
        <article className="summary-card" aria-label="Sandbox max LTV">
          <h3>Sandbox max LTV</h3>
          <p className="summary-card-value">{formatPct(sandboxProjection.summary.maxLtvPct)}</p>
        </article>
        <article className="summary-card" aria-label="Sandbox final net BTC">
          <h3>Sandbox final net BTC</h3>
          <p className="summary-card-value">{formatBtc(sandboxProjection.summary.finalNetBtcAfterDebt)}</p>
        </article>
      </div>

      <section aria-label="Scenario library">
        <h3>Scenario library</h3>
        <label>
          Scenario name
          <input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" onClick={saveScenario}>Save scenario</button>
          <button type="button" onClick={refreshScenarios}>Refresh scenarios</button>
        </div>
        {scenarios.length === 0 ? (
          <p>No saved scenarios yet.</p>
        ) : (
          <ul>
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <span>{scenario.name}</span>{' '}
                <button type="button" onClick={() => loadScenario(scenario.id)}>
                  Load {scenario.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Scenario comparison">
        <h3>Scenario comparison</h3>
        <div style={{ width: '100%', overflowX: 'auto' }} aria-label="Scenario comparison chart">
          <BarChart width={640} height={240} data={comparisonRows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCompactUsd} />
            <Tooltip formatter={(value) => (typeof value === 'number' ? formatUsd(value) : value)} />
            <Legend />
            <Bar dataKey="totalIncomeDrawnUsd" name="Total income drawn" fill="#22c55e" />
            <Bar dataKey="finalDebtUsd" name="Final debt" fill="#f97316" />
          </BarChart>
        </div>
        <table aria-label="Scenario comparison table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Final debt</th>
              <th>Final LTV</th>
              <th>Total income drawn</th>
              <th>Total skipped income</th>
              <th>Final net BTC</th>
              <th>Worst status</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td>{formatUsd(row.finalDebtUsd)}</td>
                <td>{formatPct(row.finalLtvPct)}</td>
                <td>{formatUsd(row.totalIncomeDrawnUsd)}</td>
                <td>{formatUsd(row.totalSkippedIncomeUsd)}</td>
                <td>{formatBtc(row.finalNetBtc)}</td>
                <td>{row.worstStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Stress heatmap section">
        <h3>Stress heatmap</h3>
        <table aria-label="What if heatmap table">
          <thead>
            <tr>
              <th>BTC price multiplier</th>
              {DEFAULT_DRAW_MULTIPLIERS.map((drawMultiplier) => (
                <th key={drawMultiplier}>Draw {formatMultiplier(drawMultiplier)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapRows.map((row) => (
              <tr key={row.priceMultiplier}>
                <th scope="row">Price {formatMultiplier(row.priceMultiplier)}</th>
                {row.cells.map((cell) => (
                  <td key={`${cell.priceMultiplier}-${cell.drawMultiplier}`}>
                    <strong>{cell.status}</strong> · debt {formatCompactUsd(cell.finalDebtUsd)} · LTV {formatPct(cell.worstLtvPct)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function formFromConfig(config: BtcGearConfig): SandboxForm {
  return {
    btcPriceUsd: String(config.position.btcPriceUsd),
    debtUsd: String(config.position.debtUsd),
    annualDrawUsd: String(config.strategy.kind === 'fixedDraw' ? config.strategy.annualDrawUsd : 0),
  };
}

function configFromForm(baseConfig: BtcGearConfig, form: SandboxForm): BtcGearConfig {
  const nextConfig = cloneConfig(baseConfig);
  nextConfig.position.btcPriceUsd = parsePositiveNumber(form.btcPriceUsd, baseConfig.position.btcPriceUsd);
  nextConfig.position.debtUsd = parseNonNegativeNumber(form.debtUsd, 0);
  if (nextConfig.strategy.kind === 'fixedDraw') {
    nextConfig.strategy = { ...nextConfig.strategy, annualDrawUsd: parseNonNegativeNumber(form.annualDrawUsd, 0) };
  }
  return nextConfig;
}

function buildComparisonRow(id: string, name: string, config: BtcGearConfig): ComparisonRow {
  const projection = buildProjection(config);
  const finalRow = projection.rows[projection.rows.length - 1];
  return {
    id,
    name,
    finalDebtUsd: projection.summary.finalDebtUsd,
    finalLtvPct: finalRow.ltvPct,
    totalIncomeDrawnUsd: projection.summary.totalIncomeDrawnUsd,
    totalSkippedIncomeUsd: projection.summary.totalSkippedIncomeUsd,
    finalNetBtc: projection.summary.finalNetBtcAfterDebt,
    worstStatus: worstProjectionStatus(projection.rows.map((row) => row.status)),
  };
}

function worstProjectionStatus(statuses: ProjectionStatus[]): ProjectionStatus {
  if (statuses.includes('liquidated')) return 'liquidated';
  if (statuses.includes('constrained')) return 'constrained';
  if (statuses.includes('warning')) return 'warning';
  return 'green';
}

function parsePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function cloneConfig(config: BtcGearConfig): BtcGearConfig {
  return JSON.parse(JSON.stringify(config)) as BtcGearConfig;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatBtc(value: number): string {
  return `${value.toFixed(6)} BTC`;
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(1)}×`;
}
