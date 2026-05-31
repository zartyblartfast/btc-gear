import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { StrategyPage } from './pages/StrategyPage';
import { WhatIfPage } from './pages/WhatIfPage';
import { ReviewPage } from './pages/ReviewPage';
import { ProfilePage } from './pages/ProfilePage';
import type { BtcGearConfig } from './engine/types';
import { createProfileStore, type ProfileStore } from './store/profileStore';
import { createBrowserStorage } from './store/storage';

export type PageId = 'dashboard' | 'strategy' | 'what-if' | 'review' | 'profile';

type Page = {
  id: PageId;
  label: string;
  title: string;
  element: ReactNode;
};

type AppProps = {
  profileStore?: ProfileStore;
};

export function App({ profileStore: injectedProfileStore }: AppProps = {}) {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const profileStore = useMemo(() => injectedProfileStore ?? createProfileStore(createBrowserStorage()), [injectedProfileStore]);
  const [config, setConfig] = useState<BtcGearConfig>(() => profileStore.loadConfig());

  function handleSaveConfig(nextConfig: BtcGearConfig) {
    profileStore.saveConfig(nextConfig);
    setConfig(nextConfig);
  }

  function handleResetConfig() {
    profileStore.resetConfig();
    setConfig(profileStore.loadConfig());
  }

  const pages = useMemo<Page[]>(
    () => [
      { id: 'dashboard', label: 'Dashboard', title: 'Dashboard', element: <DashboardPage config={config} /> },
      {
        id: 'strategy',
        label: 'Strategy',
        title: 'Strategy / Inputs',
        element: <StrategyPage config={config} onSaveConfig={handleSaveConfig} onResetConfig={handleResetConfig} />,
      },
      { id: 'what-if', label: 'What If', title: 'What If', element: <WhatIfPage /> },
      { id: 'review', label: 'Review', title: 'Review', element: <ReviewPage /> },
      { id: 'profile', label: 'Profile', title: 'Profile', element: <ProfilePage /> },
    ],
    [config, profileStore],
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
