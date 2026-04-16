import { useEffect, useRef, useState } from 'react';
import UploadPage from './pages/UploadPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import { ThemeProvider, useTheme } from './ThemeContext.tsx';
import { isHolidayTheme } from './themes.ts';
import type { UploadResponse } from './types.ts';
import './App.css';

const HOLIDAY_BADGES: Record<string, string> = {
  newyear: '🥂',
  valentine: '💝',
  stpatricks: '🍀',
  july4: '🎆',
  halloween: '🎃',
  thanksgiving: '🍂',
  christmas: '🎄',
};

function AppShell() {
  const { theme } = useTheme();
  const [session, setSession] = useState<UploadResponse | null>(null);
  const [showBurst, setShowBurst] = useState(false);
  const previousThemeRef = useRef(theme.id);

  function handleUploadComplete(data: UploadResponse) {
    setSession(data);
  }

  function handleReset() {
    setSession(null);
  }

  useEffect(() => {
    const previousTheme = previousThemeRef.current;
    previousThemeRef.current = theme.id;
    if (previousTheme === theme.id || !isHolidayTheme(theme.id)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setShowBurst(true);
    const timer = window.setTimeout(() => setShowBurst(false), 850);
    return () => window.clearTimeout(timer);
  }, [theme.id]);

  const holidayBadge = HOLIDAY_BADGES[theme.id];

  return (
    <div className="app">
      {showBurst && <div className="holiday-burst" aria-hidden="true" />}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className={`app-header${holidayBadge ? ' app-header--holiday' : ''}`}>
        <div className="app-header-inner">
          <span className="app-logo">
            RaceStats
            {holidayBadge && <span className="app-logo-badge" aria-hidden="true">{holidayBadge}</span>}
          </span>
          {session && (
            <button type="button" className="btn-ghost" onClick={handleReset}>
              ← Upload another file
            </button>
          )}
        </div>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        {session === null
          ? <UploadPage onUploadComplete={handleUploadComplete} />
          : <DashboardPage session={session} />
        }
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
