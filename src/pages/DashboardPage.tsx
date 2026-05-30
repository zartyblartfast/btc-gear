import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { buildProjectionChartRows } from '../dashboard/chartData';
import { buildDashboardSummaryCards } from '../dashboard/summaryCards';
import { buildTradeoffMap, type TradeoffScenario } from '../dashboard/tradeoffMap';
import { buildProjection } from '../engine/projection';
import type { BtcGearConfig } from '../engine/types';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';

type DashboardPageProps = {
  config?: BtcGearConfig;
};

export function DashboardPage({ config = DEFAULT_BTC_GEAR_CONFIG }: DashboardPageProps) {
  const projection = useMemo(() => buildProjection(config), [config]);
  const cards = useMemo(() => buildDashboardSummaryCards(projection), [projection]);
  const chartRows = useMemo(() => buildProjectionChartRows(projection), [projection]);
  const tradeoffMap = useMemo(() => buildTradeoffMap(config), [config]);

  return (
    <section aria-label="Dashboard overview">
      <p>Current strategy health, LTV, income, and net BTC projections from the active profile.</p>
      <div className="summary-card-grid">
        {cards.map((card) => (
          <article key={card.id} className={`summary-card summary-card--${card.tone}`} aria-label={card.title}>
            <h3>{card.title}</h3>
            <p className="summary-card-value">{card.value}</p>
            <p className="summary-card-detail">{card.detail}</p>
          </article>
        ))}
      </div>

      <section className="projection-chart-grid" aria-label="Projection charts">
        <ChartCard title="BTC price vs liquidation price">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatCompactUsd} />
              <Tooltip formatter={formatUsdTooltip} />
              <Legend />
              <Line type="monotone" dataKey="btcPriceUsd" name="BTC price" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="liquidationPriceUsd" name="Liquidation price" stroke="#ef4444" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="LTV bands">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis domain={[0, 100]} tickFormatter={formatPctAxis} />
              <Tooltip formatter={formatPctTooltip} />
              <Legend />
              <ReferenceLine y={config.loan.incomeLtvCeilingPct} name="Income ceiling" stroke="#f59e0b" strokeDasharray="4 4" />
              <ReferenceLine y={config.loan.liquidationLtvPct} name="Liquidation" stroke="#ef4444" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="ltvPct" name="LTV" stroke="#38bdf8" fill="#0ea5e9" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Income drawn vs skipped">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatCompactUsd} />
              <Tooltip formatter={formatUsdTooltip} />
              <Legend />
              <Bar dataKey="incomeDrawnUsd" name="Income drawn" stackId="income" fill="#22c55e" />
              <Bar dataKey="skippedIncomeUsd" name="Skipped income" stackId="income" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Net BTC after debt">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatBtcAxis} />
              <Tooltip formatter={formatBtcTooltip} />
              <Legend />
              <Line type="monotone" dataKey="netBtcAfterDebt" name="Net BTC" stroke="#a78bfa" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="tradeoff-map-section" aria-label="Strategy Tradeoff Map">
        <div className="tradeoff-map-header">
          <div>
            <h3>Strategy Tradeoff Map</h3>
            <p>
              X-axis is minimum drop-to-liquidation buffer; Y-axis is total income funded. Larger dots retain more final net BTC after debt.
            </p>
          </div>
          <div className="tradeoff-marker-legend" aria-label="Tradeoff markers">
            <span className="tradeoff-pill tradeoff-pill--current">Current scenario</span>
            {tradeoffMap.recommendedScenarioId ? (
              <span className="tradeoff-pill tradeoff-pill--recommended"><span aria-hidden="true">★ </span>Recommended</span>
            ) : (
              <span className="tradeoff-pill tradeoff-pill--muted">{tradeoffMap.noRecommendationMessage}</span>
            )}
          </div>
        </div>
        <div className="tradeoff-quadrants" aria-label="Tradeoff quadrants">
          <span>Best Tradeoff</span>
          <span>High Income / High Risk</span>
          <span>Conservative</span>
          <span>Weak Tradeoff</span>
        </div>
        <div className="tradeoff-status-legend" aria-label="Tradeoff status legend">
          {(['green', 'warning', 'constrained', 'liquidated'] as const).map((status) => (
            <span key={status} className={`status-pill status-pill--${status}`}>
              {status}
            </span>
          ))}
        </div>
        <div className="projection-chart-frame">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 16, right: 20, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="minDropToLiquidationPct" name="Minimum drop-to-liquidation" type="number" tickFormatter={formatPctAxis} />
              <YAxis dataKey="totalIncomeFundedUsd" name="Total income funded" type="number" tickFormatter={formatCompactUsd} />
              <ZAxis dataKey="finalNetBtcAfterDebt" range={[70, 360]} name="Final net BTC" />
              <Tooltip content={<TradeoffTooltip />} />
              <Legend />
              <ReferenceLine x={config.loan.requiredDropBufferPct} name="Required buffer" stroke="#f59e0b" strokeDasharray="4 4" />
              <Scatter name="Scenarios" data={tradeoffMap.scenarios} shape={renderTradeoffPoint}>
                {tradeoffMap.scenarios.map((scenario) => (
                  <Cell key={scenario.id} fill={statusColor(scenario.status)} stroke={scenario.isCurrentScenario ? '#f8fafc' : '#0f172a'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>
    </section>
  );
}

type TradeoffPointProps = {
  cx?: number;
  cy?: number;
  size?: number;
  fill?: string;
  stroke?: string;
  payload?: TradeoffScenario;
};

function renderTradeoffPoint(props: TradeoffPointProps) {
  const { cx = 0, cy = 0, size = 100, fill = '#38bdf8', stroke = '#0f172a', payload } = props;
  const radius = Math.max(5, Math.sqrt(size) / 2.8);

  if (payload?.isRecommended) {
    return (
      <text x={cx} y={cy + radius / 2} textAnchor="middle" fill="#fde68a" stroke="#451a03" strokeWidth={0.4} fontSize={radius * 2.2}>
        ★
      </text>
    );
  }

  return <circle cx={cx} cy={cy} r={radius} fill={fill} stroke={stroke} strokeWidth={payload?.isCurrentScenario ? 3 : 1} />;
}

type TradeoffTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: TradeoffScenario }>;
};

function TradeoffTooltip({ active, payload }: TradeoffTooltipProps) {
  const scenario = payload?.[0]?.payload;
  if (!active || !scenario) {
    return null;
  }

  return (
    <div className="tradeoff-tooltip">
      <strong>{scenario.label}</strong>
      <span>Strategy: {scenario.strategyFamily}</span>
      <span>Draw rule: {scenario.drawLabel}</span>
      <span>BTC path: {scenario.pricePathLabel}</span>
      <span>Total income funded: {formatWholeUsd(scenario.totalIncomeFundedUsd)}</span>
      <span>Skipped income: {formatWholeUsd(scenario.totalSkippedIncomeUsd)}</span>
      <span>Min drop-to-liquidation: {scenario.minDropToLiquidationPct.toFixed(1)}%</span>
      <span>Max LTV: {scenario.maxLtvPct.toFixed(1)}%</span>
      <span>Final net BTC: {scenario.finalNetBtcAfterDebt.toFixed(6)}</span>
      <span>First warning: {scenario.firstWarningYear ?? 'none'}</span>
      <span>First constrained: {scenario.firstConstrainedYear ?? 'none'}</span>
      <span>Liquidation: {scenario.liquidationYear ?? 'none'}</span>
    </div>
  );
}

function statusColor(status: TradeoffScenario['status']): string {
  switch (status) {
    case 'green':
      return '#22c55e';
    case 'warning':
      return '#f59e0b';
    case 'constrained':
      return '#f97316';
    case 'liquidated':
      return '#ef4444';
  }
}

type ChartCardProps = {
  title: string;
  children: ReactNode;
};

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <article className="projection-chart-card" aria-label={title}>
      <h3>{title}</h3>
      <div className="projection-chart-frame">{children}</div>
    </article>
  );
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsdTooltip(value: unknown): [string, string] {
  return [formatWholeUsd(Number(value)), ''];
}

function formatWholeUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPctAxis(value: number): string {
  return `${value}%`;
}

function formatPctTooltip(value: unknown): [string, string] {
  return [`${Number(value).toFixed(1)}%`, ''];
}

function formatBtcAxis(value: number): string {
  return value.toFixed(2);
}

function formatBtcTooltip(value: unknown): [string, string] {
  return [`${Number(value).toFixed(6)} BTC`, ''];
}
