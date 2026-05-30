import { useMemo } from 'react';
import { buildDashboardSummaryCards } from '../dashboard/summaryCards';
import { buildProjection } from '../engine/projection';
import type { BtcGearConfig } from '../engine/types';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';

type DashboardPageProps = {
  config?: BtcGearConfig;
};

export function DashboardPage({ config = DEFAULT_BTC_GEAR_CONFIG }: DashboardPageProps) {
  const cards = useMemo(() => buildDashboardSummaryCards(buildProjection(config)), [config]);

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
    </section>
  );
}
