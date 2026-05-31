import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { PROFILE_CONFIG_KEY, createProfileStore } from './store/profileStore';
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
});
