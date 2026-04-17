import { useEffect, useRef, useState } from 'react';
import UploadPage, { type UploadResult } from './pages/UploadPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import ComparisonPage from './pages/ComparisonPage.tsx';
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

type AppSession =
  | { mode: 'single'; session: UploadResponse; label: string }
  | { mode: 'comparison'; sessions: Array<{ sessionId: string; label: string; raceName: string }> }
  | null;

function AppShell() {
  const { theme } = useTheme();
  const [appSession, setAppSession] = useState<AppSession>(null);
  const [showBurst, setShowBurst] = useState(false);
  const previousThemeRef = useRef(theme.id);

  function handleUploadComplete(result: UploadResult) {
    if (result.mode === 'single') {
      setAppSession({ mode: 'single', session: result.session, label: result.label });
    } else {
      // Always present oldest → newest so trend charts read left-to-right.
      // Sort numerically when labels are years; fall back to lexicographic.
      const sorted = [...result.sessions].sort((a, b) => {
        const ya = parseInt(a.label, 10);
        const yb = parseInt(b.label, 10);
        if (!isNaN(ya) && !isNaN(yb)) return ya - yb;
        return a.label.localeCompare(b.label);
      });
      setAppSession({
        mode: 'comparison',
        sessions: sorted.map(s => ({
          sessionId: s.response.sessionId,
          label: s.label,
          raceName: s.response.raceName,
        })),
      });
    }
  }

  function handleReset() {
    setAppSession(null);
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
          {appSession !== null && (
            <button type="button" className="btn-ghost" onClick={handleReset}>
              ← Upload another file
            </button>
          )}
        </div>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        {appSession === null && (
          <UploadPage onUploadComplete={handleUploadComplete} />
        )}
        {appSession?.mode === 'single' && (
          <DashboardPage session={appSession.session} label={appSession.label} />
        )}
        {appSession?.mode === 'comparison' && (
          <ComparisonPage sessions={appSession.sessions} />
        )}
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
