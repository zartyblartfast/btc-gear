import { FormEvent, useMemo, useState } from 'react';
import type { BtcGearConfig } from '../engine/types';
import { buildReviewChartData, sortReviews } from '../review/reviewChartData';
import { DEFAULT_BTC_GEAR_CONFIG } from '../store/profileStore';
import { createReviewStore, type BaselineSnapshot, type ReviewSnapshot, type ReviewStore } from '../store/reviewStore';
import { createBrowserStorage } from '../store/storage';

type ReviewPageProps = {
  config?: BtcGearConfig;
  reviewStore?: ReviewStore;
};

type ReviewForm = {
  reviewDate: string;
  btcPriceUsd: string;
  totalBtcHeld: string;
  collateralBtc: string;
  debtUsd: string;
  actualIncomeDrawnUsd: string;
  notes: string;
};

export function ReviewPage({ config = DEFAULT_BTC_GEAR_CONFIG, reviewStore: injectedReviewStore }: ReviewPageProps) {
  const defaultReviewStore = useMemo(() => createReviewStore(createBrowserStorage()), []);
  const reviewStore = injectedReviewStore ?? defaultReviewStore;
  const [reviews, setReviews] = useState<ReviewSnapshot[]>(() => reviewStore.listReviews());
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(() => reviewStore.getBaseline());
  const [form, setForm] = useState<ReviewForm>(() => formFromConfig(config));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestReview = reviewStore.getLatestReview();
  const strategyChanged = reviewStore.hasStrategyChanged(config);
  const chartData = buildReviewChartData({ config, reviews, baseline });
  const actualRows = chartData.actualRows;
  const revisedStart = chartData.revisedRows[0];
  const sortedReviews = sortReviews(reviews).reverse();

  function refresh() {
    setReviews(reviewStore.listReviews());
    setBaseline(reviewStore.getBaseline());
  }

  function handleInput(name: keyof ReviewForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = parseReviewForm(form);
    if (parsed === null) {
      setError('Enter finite non-negative values before saving a review.');
      return;
    }

    const review: ReviewSnapshot = {
      id: `review-${parsed.reviewDate}-${Date.now()}`,
      reviewDate: parsed.reviewDate,
      btcPriceUsd: parsed.btcPriceUsd,
      btcPriceSource: 'manual',
      totalBtcHeld: parsed.totalBtcHeld,
      collateralBtc: parsed.collateralBtc,
      debtUsd: parsed.debtUsd,
      actualIncomeDrawnUsd: parsed.actualIncomeDrawnUsd,
      strategyKind: config.strategy.kind,
      strategyParams: strategyParams(config),
      notes: parsed.notes,
    };

    reviewStore.addReview(review);
    refresh();
    setMessage('Review saved. Export a profile backup now so your local-first review history is recoverable.');
  }

  function handleLockBaseline() {
    reviewStore.lockBaseline(config, new Date().toISOString());
    refresh();
    setMessage('Baseline locked for plan-vs-actual review.');
  }

  function handleRebaseline() {
    const nextBaseline = reviewStore.rebaselineFromLatestReview(config, new Date().toISOString());
    refresh();
    setMessage(nextBaseline === null ? 'Save a review before rebaseline.' : 'Baseline updated from latest review.');
  }

  return (
    <section aria-label="Review and rebaseline">
      <p>Record actual BTC, debt, income, and rebaseline the forward plan.</p>

      {strategyChanged ? <p role="alert">Strategy changed. Plan-vs-actual comparison is paused until rebaseline.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? (
        <div role="status">
          <p>{message}</p>
          {message.startsWith('Review saved') ? <button type="button">Export backup</button> : null}
        </div>
      ) : null}

      <form aria-label="Review actuals form" onSubmit={handleSave}>
        <label>
          Review date
          <input value={form.reviewDate} onChange={(event) => handleInput('reviewDate', event.target.value)} />
        </label>
        <label>
          BTC price USD
          <input
            type="number"
            min="0"
            step="any"
            value={form.btcPriceUsd}
            onChange={(event) => handleInput('btcPriceUsd', event.target.value)}
          />
        </label>
        <label>
          Total BTC held
          <input
            type="number"
            min="0"
            step="any"
            value={form.totalBtcHeld}
            onChange={(event) => handleInput('totalBtcHeld', event.target.value)}
          />
        </label>
        <label>
          Collateral BTC
          <input
            type="number"
            min="0"
            step="any"
            value={form.collateralBtc}
            onChange={(event) => handleInput('collateralBtc', event.target.value)}
          />
        </label>
        <label>
          Debt USD
          <input type="number" min="0" step="any" value={form.debtUsd} onChange={(event) => handleInput('debtUsd', event.target.value)} />
        </label>
        <label>
          Actual income drawn USD
          <input
            type="number"
            min="0"
            step="any"
            value={form.actualIncomeDrawnUsd}
            onChange={(event) => handleInput('actualIncomeDrawnUsd', event.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea value={form.notes} onChange={(event) => handleInput('notes', event.target.value)} />
        </label>
        <button type="submit">Save review</button>
      </form>

      <section aria-label="Baseline controls">
        <h3>Baseline</h3>
        {baseline === null ? (
          <p>No baseline locked yet.</p>
        ) : (
          <p>
            Baseline locked {formatDateTime(baseline.lockedAt)}. Baseline starts at {formatUsd(baseline.config.position.btcPriceUsd)} BTC price and{' '}
            {formatUsd(baseline.config.position.debtUsd)} debt.
          </p>
        )}
        <button type="button" onClick={handleLockBaseline}>
          Lock baseline
        </button>
        <button type="button" onClick={handleRebaseline} disabled={latestReview === null}>
          Rebaseline from latest review
        </button>
        {latestReview === null ? <p>Save a review before rebaseline.</p> : null}
      </section>

      <section aria-label="Revised projection">
        <h3>Revised projection</h3>
        {latestReview === null || revisedStart === undefined ? (
          <p>Save a review to generate a projection from actuals.</p>
        ) : (
          <p>
            <strong>Starts from latest actuals</strong>: <span>{formatUsd(revisedStart.btcPriceUsd)}</span> BTC price, <span>{formatUsd(revisedStart.debtUsd)}</span> debt,{' '}
            <span>{formatUsd(revisedStart.incomeDrawnUsd)}</span> next planned draw.
          </p>
        )}
      </section>

      <section aria-label="Actual history chart data">
        <h3>Actual history chart data</h3>
        <ul>
          <li>Actual BTC price</li>
          <li>Actual debt</li>
          <li>Actual LTV</li>
          <li>Actual income</li>
          <li>Actual net BTC after debt</li>
          <li>Baseline vs actual vs revised</li>
        </ul>
        {actualRows.length === 0 ? (
          <p>No actual review dots yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>BTC price</th>
                <th>Debt</th>
                <th>LTV</th>
                <th>Income</th>
                <th>Net BTC after debt</th>
              </tr>
            </thead>
            <tbody>
              {actualRows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{formatUsd(row.btcPriceUsd)}</td>
                  <td>{formatUsd(row.debtUsd)}</td>
                  <td>{formatPct(row.ltvPct)}</td>
                  <td>{formatUsd(row.incomeDrawnUsd)}</td>
                  <td>{formatBtc(row.netBtcAfterDebt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Review history">
        <h3>Review history</h3>
        {sortedReviews.length === 0 ? (
          <p>No saved reviews.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Debt</th>
                <th>Income</th>
                <th>LTV</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedReviews.map((review) => {
                const ltvPct = review.collateralBtc * review.btcPriceUsd > 0 ? (review.debtUsd / (review.collateralBtc * review.btcPriceUsd)) * 100 : 0;
                return (
                  <tr key={review.id}>
                    <td>{review.reviewDate}</td>
                    <td>{formatUsd(review.btcPriceUsd)}</td>
                    <td>{formatUsd(review.debtUsd)}</td>
                    <td>{formatUsd(review.actualIncomeDrawnUsd)}</td>
                    <td>{formatPct(ltvPct)}</td>
                    <td>{review.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}

function formFromConfig(config: BtcGearConfig): ReviewForm {
  return {
    reviewDate: new Date().toISOString().slice(0, 10),
    btcPriceUsd: String(config.position.btcPriceUsd),
    totalBtcHeld: String(config.position.totalBtcHeld),
    collateralBtc: String(config.position.collateralBtc),
    debtUsd: String(config.position.debtUsd),
    actualIncomeDrawnUsd: '0',
    notes: '',
  };
}

function parseReviewForm(form: ReviewForm): (Omit<ReviewForm, 'btcPriceUsd' | 'totalBtcHeld' | 'collateralBtc' | 'debtUsd' | 'actualIncomeDrawnUsd'> & {
  btcPriceUsd: number;
  totalBtcHeld: number;
  collateralBtc: number;
  debtUsd: number;
  actualIncomeDrawnUsd: number;
}) | null {
  const reviewDate = form.reviewDate.trim();
  const btcPriceUsd = parseNonNegativeNumber(form.btcPriceUsd);
  const totalBtcHeld = parseNonNegativeNumber(form.totalBtcHeld);
  const collateralBtc = parseNonNegativeNumber(form.collateralBtc);
  const debtUsd = parseNonNegativeNumber(form.debtUsd);
  const actualIncomeDrawnUsd = parseNonNegativeNumber(form.actualIncomeDrawnUsd);

  if (reviewDate.length === 0 || btcPriceUsd === null || totalBtcHeld === null || collateralBtc === null || debtUsd === null || actualIncomeDrawnUsd === null) {
    return null;
  }

  return { reviewDate, btcPriceUsd, totalBtcHeld, collateralBtc, debtUsd, actualIncomeDrawnUsd, notes: form.notes };
}

function parseNonNegativeNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function strategyParams(config: BtcGearConfig): Record<string, unknown> {
  const { kind: _kind, ...params } = config.strategy;
  return params;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatBtc(value: number): string {
  return `${value.toFixed(4)} BTC`;
}

function formatDateTime(value: string): string {
  return value.slice(0, 10);
}
