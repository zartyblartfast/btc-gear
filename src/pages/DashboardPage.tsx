import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildProjectionChartRows } from '../dashboard/chartData';
import { buildDashboardSummaryCards } from '../dashboard/summaryCards';
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
    </section>
  );
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
