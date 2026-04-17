import { useEffect, useRef, useState } from 'react';
import UploadPage, { type UploadResult } from './pages/UploadPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import ComparisonPage from './pages/ComparisonPage.tsx';
import HomePage from './pages/HomePage.tsx';
import AboutPage from './pages/AboutPage.tsx';
import RaceResultsPage from './pages/RaceResultsPage.tsx';
import FinancialsPage from './pages/FinancialsPage.tsx';
import { ThemeProvider, useTheme } from './ThemeContext.tsx';
import ThemeSwitcher from './components/ThemeSwitcher.tsx';
import { isHolidayTheme } from './themes.ts';
import type { UploadResponse } from './types.ts';
import './App.css';

export type Section = 'home' | 'participants' | 'results' | 'financials' | 'about';

const HOLIDAY_BADGES: Record<string, string> = {
  newyear: '🥂',
  valentine: '💝',
  stpatricks: '🍀',
  july4: '🎆',
  halloween: '🎃',
  thanksgiving: '🍂',
  christmas: '🎄',
};

export type ParticipantSession =
  | { mode: 'single'; session: UploadResponse; label: string }
  | { mode: 'comparison'; sessions: Array<{ sessionId: string; label: string; raceName: string }> }
  | null;

const NAV_ITEMS: Array<{ id: Section; label: string; shortLabel: string }> = [
  { id: 'home',         label: 'Home',                  shortLabel: 'Home' },
  { id: 'participants', label: 'Participant Analytics',  shortLabel: 'Participants' },
  { id: 'results',      label: 'Race Results',           shortLabel: 'Results' },
  { id: 'financials',   label: 'Financials',             shortLabel: 'Financials' },
  { id: 'about',        label: 'About',                  shortLabel: 'About' },
];

function AppShell() {
  const { theme } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [participantSession, setParticipantSession] = useState<ParticipantSession>(null);
  const [showBurst, setShowBurst] = useState(false);
  const previousThemeRef = useRef(theme.id);

  function navigateTo(section: Section) {
    // Leaving participants resets any loaded session
    if (section !== 'participants') {
      setParticipantSession(null);
    }
    setActiveSection(section);
  }

  function handleUploadComplete(result: UploadResult) {
    if (result.mode === 'single') {
      setParticipantSession({ mode: 'single', session: result.session, label: result.label });
    } else {
      const sorted = [...result.sessions].sort((a, b) => {
        const ya = parseInt(a.label, 10);
        const yb = parseInt(b.label, 10);
        if (!isNaN(ya) && !isNaN(yb)) return ya - yb;
        return a.label.localeCompare(b.label);
      });
      setParticipantSession({
        mode: 'comparison',
        sessions: sorted.map(s => ({
          sessionId: s.response.sessionId,
          label: s.label,
          raceName: s.response.raceName,
        })),
      });
    }
    setActiveSection('participants');
  }

  function handleDemoLaunch(session: ParticipantSession) {
    setParticipantSession(session);
    setActiveSection('participants');
  }

  function handleParticipantReset() {
    setParticipantSession(null);
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

          <nav className="app-nav" aria-label="Main navigation">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                className={`app-nav-btn${activeSection === item.id ? ' app-nav-btn--active' : ''}`}
                onClick={() => navigateTo(item.id)}
                aria-current={activeSection === item.id ? 'page' : undefined}
              >
                <span className="app-nav-label">{item.label}</span>
                <span className="app-nav-label--short">{item.shortLabel}</span>
              </button>
            ))}
          </nav>

          <div className="app-header-right">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        {activeSection === 'home' && (
          <HomePage onDemoLaunch={handleDemoLaunch} onNavigate={navigateTo} />
        )}

        {activeSection === 'participants' && participantSession === null && (
          <UploadPage onUploadComplete={handleUploadComplete} />
        )}
        {activeSection === 'participants' && participantSession?.mode === 'single' && (
          <DashboardPage
            session={participantSession.session}
            label={participantSession.label}
            onBack={handleParticipantReset}
          />
        )}
        {activeSection === 'participants' && participantSession?.mode === 'comparison' && (
          <ComparisonPage
            sessions={participantSession.sessions}
            onBack={handleParticipantReset}
          />
        )}

        {activeSection === 'results' && <RaceResultsPage />}
        {activeSection === 'financials' && <FinancialsPage />}
        {activeSection === 'about' && <AboutPage />}
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
