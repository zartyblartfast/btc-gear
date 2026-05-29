import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { StrategyPage } from './pages/StrategyPage';
import { WhatIfPage } from './pages/WhatIfPage';
import { ReviewPage } from './pages/ReviewPage';
import { ProfilePage } from './pages/ProfilePage';

export type PageId = 'dashboard' | 'strategy' | 'what-if' | 'review' | 'profile';

type Page = {
  id: PageId;
  label: string;
  title: string;
  element: ReactNode;
};

export function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  const pages = useMemo<Page[]>(
    () => [
      { id: 'dashboard', label: 'Dashboard', title: 'Dashboard', element: <DashboardPage /> },
      { id: 'strategy', label: 'Strategy', title: 'Strategy / Inputs', element: <StrategyPage /> },
      { id: 'what-if', label: 'What If', title: 'What If', element: <WhatIfPage /> },
      { id: 'review', label: 'Review', title: 'Review', element: <ReviewPage /> },
      { id: 'profile', label: 'Profile', title: 'Profile', element: <ProfilePage /> },
    ],
    [],
  );

  const currentPage = pages.find((page) => page.id === activePage) ?? pages[0];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">local-first bitcoin strategy planner</p>
          <h1>btc-gear</h1>
        </div>
        <nav aria-label="Primary navigation" className="nav-tabs">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              aria-current={activePage === page.id ? 'page' : undefined}
              onClick={() => setActivePage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="page-card">
        <h2>{currentPage.title}</h2>
        {currentPage.element}
      </main>
    </div>
  );
}
