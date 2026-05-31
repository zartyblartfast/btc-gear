import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { PROFILE_CONFIG_KEY, createProfileStore } from './store/profileStore';
import { createScenarioStore } from './store/scenarioStore';
import { createReviewStore } from './store/reviewStore';
import { createMemoryStorage } from './store/storage';

describe('App navigation', () => {
  it('renders Dashboard by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard overview')).toBeInTheDocument();
  });

  it.each([
    ['Strategy', 'Strategy / Inputs', 'Strategy and inputs'],
    ['What If', 'What If', 'What if sandbox'],
    ['Review', 'Review', 'Review and rebaseline'],
    ['Profile', 'Profile', 'Profile and local data'],
  ])('navigates to the %s page', async (navLabel, heading, sectionLabel) => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: navLabel }));

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByLabelText(sectionLabel)).toBeInTheDocument();
  });

  it('loads initial config from an injected memory profile store', () => {
    const store = createProfileStore(
      createMemoryStorage({
        [PROFILE_CONFIG_KEY]: JSON.stringify({
          startYear: 2026,
          projectionYears: 30,
          currentAge: 50,
          planningAge: 80,
          position: { totalBtcHeld: 4, collateralBtc: 2, debtUsd: 80_000, btcPriceUsd: 100_000 },
          loan: { aprPct: 6, liquidationLtvPct: 80, incomeLtvCeilingPct: 30, requiredDropBufferPct: 40 },
          pricePath: { kind: 'annualGrowth', annualGrowthPct: 5 },
          strategy: { kind: 'fixedDraw', annualDrawUsd: 20_000 },
        }),
      }),
    );

    render(<App profileStore={store} />);

    expect(screen.getByLabelText('Current BTC price')).toHaveTextContent('$100,000');
    expect(screen.getByLabelText('Current debt')).toHaveTextContent('$80,000');
  });

  it('saves Strategy edits, updates Dashboard, and persists through the profile store', async () => {
    const user = userEvent.setup();
    const store = createProfileStore(createMemoryStorage());
    render(<App profileStore={store} />);

    await user.click(screen.getByRole('button', { name: 'Strategy' }));
    await user.clear(screen.getByLabelText('Debt USD'));
    await user.type(screen.getByLabelText('Debt USD'), '125000');
    await user.click(screen.getByRole('button', { name: 'Save config' }));
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));

    expect(screen.getByLabelText('Current debt')).toHaveTextContent('$125,000');
    expect(store.loadConfig().position.debtUsd).toBe(125000);
  });

  it('uses injected scenario store while What If sandbox edits leave Dashboard live config unchanged', async () => {
    const user = userEvent.setup();
    const profileStore = createProfileStore(createMemoryStorage());
    const scenarioStore = createScenarioStore(createMemoryStorage());
    render(<App profileStore={profileStore} scenarioStore={scenarioStore} />);

    await user.click(screen.getByRole('button', { name: 'What If' }));
    await user.clear(screen.getByLabelText('Sandbox debt USD'));
    await user.type(screen.getByLabelText('Sandbox debt USD'), '135000');
    await user.clear(screen.getByLabelText('Scenario name'));
    await user.type(screen.getByLabelText('Scenario name'), 'App sandbox');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));

    expect(scenarioStore.listScenarios()).toHaveLength(1);
    expect(scenarioStore.listScenarios()[0].config.position.debtUsd).toBe(135000);
    expect(screen.getByLabelText('Current debt')).toHaveTextContent('$50,000');
    expect(profileStore.loadConfig().position.debtUsd).toBe(50000);
  });

  it('accepts an injected review store and saves Review page actuals there', async () => {
    const user = userEvent.setup();
    const profileStore = createProfileStore(createMemoryStorage());
    const reviewStore = createReviewStore(createMemoryStorage());
    render(<App profileStore={profileStore} reviewStore={reviewStore} />);

    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.clear(screen.getByLabelText('Debt USD'));
    await user.type(screen.getByLabelText('Debt USD'), '61000');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(reviewStore.listReviews()).toHaveLength(1);
    expect(reviewStore.listReviews()[0].debtUsd).toBe(61000);
  });
});
