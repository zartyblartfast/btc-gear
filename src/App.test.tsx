import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

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
});
