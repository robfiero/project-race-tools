export interface Theme {
  id: string;
  label: string;
  primary: string;         // CSS accent — buttons, borders, active states
  primaryHover: string;    // Darker variant for hover
  primaryLight: string;    // Very light tint for hover backgrounds
  chart: readonly [string, string, string, string]; // 4 distinct chart colors
}

interface ThemeVisuals {
  headerBackground: string;
  headerForeground: string;
  sectionDividerImage: string;
  burstColorA: string;
  burstColorB: string;
}

function parseHexColor(hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function srgbToLinear(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function bestOnColor(bgHex: string): string {
  const rgb = parseHexColor(bgHex);
  if (!rgb) return '#ffffff';
  const bgLum = relativeLuminance(rgb);
  const whiteContrast = contrastRatio(1, bgLum);
  const blackContrast = contrastRatio(0, bgLum);
  return whiteContrast >= blackContrast ? '#ffffff' : '#111111';
}

// ─── Standard themes ─────────────────────────────────────────────────────────

const STANDARD: Theme[] = [
  {
    id: 'default',
    label: 'Default',
    primary: '#c65a1e', primaryHover: '#a94b17', primaryLight: '#fff4ed',
    chart: ['#c65a1e', '#2563eb', '#15803d', '#7c3aed'],
  },
  {
    id: 'ultrasignup',
    label: 'UltraSignup',
    primary: '#3a7d32', primaryHover: '#2d6227', primaryLight: '#f0f8ee',
    chart: ['#3a7d32', '#c8a017', '#1e6b8a', '#7c5a28'],
  },
  {
    id: 'forest',
    label: 'Forest',
    primary: '#1f6b3a', primaryHover: '#17542d', primaryLight: '#eef8f1',
    chart: ['#1f6b3a', '#4d7c0f', '#0f766e', '#8b5e34'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    primary: '#0b5e8a', primaryHover: '#094b6e', primaryLight: '#ecf7fd',
    chart: ['#0b5e8a', '#0e7490', '#2563eb', '#14b8a6'],
  },
  {
    id: 'crimson',
    label: 'Crimson',
    primary: '#a61b2b', primaryHover: '#861624', primaryLight: '#fdf0f2',
    chart: ['#a61b2b', '#dc2626', '#1d4ed8', '#7e22ce'],
  },
  {
    id: 'slate',
    label: 'Slate',
    primary: '#3f4e5e', primaryHover: '#2f3a47', primaryLight: '#eef2f6',
    chart: ['#3f4e5e', '#0284c7', '#0f766e', '#ca8a04'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    primary: '#2e3a8c', primaryHover: '#232d6d', primaryLight: '#eef1ff',
    chart: ['#2e3a8c', '#4338ca', '#0e7490', '#f59e0b'],
  },
  {
    id: 'violet',
    label: 'Violet',
    primary: '#6d28d9', primaryHover: '#5b21b6', primaryLight: '#f5f0ff',
    chart: ['#6d28d9', '#a855f7', '#0ea5e9', '#f97316'],
  },
];

// ─── Holiday themes ───────────────────────────────────────────────────────────

const HOLIDAYS: Theme[] = [
  {
    id: 'newyear',
    label: "🥂 New Year's",
    primary: '#b8870b', primaryHover: '#916b09', primaryLight: '#fffae8',
    chart: ['#b8870b', '#1e3a8a', '#9333ea', '#334155'],
  },
  {
    id: 'valentine',
    label: "💝 Valentine's",
    primary: '#c2185b', primaryHover: '#9f124a', primaryLight: '#fff0f6',
    chart: ['#c2185b', '#e11d48', '#f472b6', '#7c3aed'],
  },
  {
    id: 'stpatricks',
    label: "🍀 St. Patrick's",
    primary: '#0f8a43', primaryHover: '#0c6f36', primaryLight: '#ecfbf3',
    chart: ['#0f8a43', '#65a30d', '#ca8a04', '#166534'],
  },
  {
    id: 'july4',
    label: '🎆 4th of July',
    primary: '#1e3a8a', primaryHover: '#172e6e', primaryLight: '#eff4ff',
    chart: ['#1e3a8a', '#dc2626', '#2563eb', '#94a3b8'],
  },
  {
    id: 'halloween',
    label: '🎃 Halloween',
    primary: '#c2410c', primaryHover: '#9a3412', primaryLight: '#fff4ed',
    chart: ['#c2410c', '#7c2d12', '#6d28d9', '#1f2937'],
  },
  {
    id: 'thanksgiving',
    label: '🍂 Thanksgiving',
    primary: '#9a5a1a', primaryHover: '#7a4614', primaryLight: '#fff7ed',
    chart: ['#9a5a1a', '#b45309', '#d97706', '#6b3e26'],
  },
  {
    id: 'christmas',
    label: '🎄 Christmas',
    primary: '#be123c', primaryHover: '#9f1239', primaryLight: '#fff1f2',
    chart: ['#be123c', '#15803d', '#ca8a04', '#1d4ed8'],
  },
];

export const STANDARD_THEMES = STANDARD;
export const HOLIDAY_THEMES = HOLIDAYS;
export const ALL_THEMES = [...STANDARD, ...HOLIDAYS];
export const DEFAULT_THEME = STANDARD[0];
const HOLIDAY_THEME_IDS = new Set(HOLIDAYS.map(theme => theme.id));

export function isHolidayTheme(id: string): boolean {
  return HOLIDAY_THEME_IDS.has(id);
}

export function findTheme(id: string): Theme {
  return ALL_THEMES.find(t => t.id === id) ?? DEFAULT_THEME;
}

// Write the CSS custom properties that drive all themed CSS rules.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-primary-hover', theme.primaryHover);
  root.style.setProperty('--color-primary-light', theme.primaryLight);
  root.style.setProperty('--color-background', theme.primaryLight);
  root.style.setProperty('--color-on-primary', bestOnColor(theme.primary));
  root.style.setProperty('--color-on-primary-hover', bestOnColor(theme.primaryHover));

  const visuals = getThemeVisuals(theme.id, theme.primary);
  root.style.setProperty('--header-background', visuals.headerBackground);
  root.style.setProperty('--header-foreground', visuals.headerForeground);
  root.style.setProperty('--section-divider-image', visuals.sectionDividerImage);
  root.style.setProperty('--burst-color-a', visuals.burstColorA);
  root.style.setProperty('--burst-color-b', visuals.burstColorB);
}

export function getStoredThemeId(): string {
  try { return localStorage.getItem('racestats-theme') ?? 'default'; }
  catch { return 'default'; }
}

export function storeThemeId(id: string): void {
  try { localStorage.setItem('racestats-theme', id); }
  catch { /* ignore */ }
}

function getThemeVisuals(themeId: string, primary: string): ThemeVisuals {
  const defaults: ThemeVisuals = {
    headerBackground: '#1a1a1a',
    headerForeground: '#ffffff',
    sectionDividerImage: `linear-gradient(90deg, ${primary}, ${primary})`,
    burstColorA: primary,
    burstColorB: '#fbbf24',
  };

  switch (themeId) {
    case 'ultrasignup':
      return {
        headerBackground: 'linear-gradient(110deg, #1a2332 0%, #2c3e50 55%, #3a7d32 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #3a7d32 0 11px, #c8a017 11px 20px, #f0f8ee 20px 24px)',
        burstColorA: '#3a7d32',
        burstColorB: '#c8a017',
      };
    case 'newyear':
      return {
        headerBackground: 'linear-gradient(110deg, #0f172a 0%, #312e81 45%, #b8870b 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #b8870b 0 10px, #312e81 10px 20px, #ffffff 20px 24px)',
        burstColorA: '#b8870b',
        burstColorB: '#a855f7',
      };
    case 'valentine':
      return {
        headerBackground: 'linear-gradient(110deg, #7f1d5a 0%, #be185d 55%, #ec4899 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #c2185b 0 12px, #f472b6 12px 20px, #ffffff 20px 24px)',
        burstColorA: '#c2185b',
        burstColorB: '#f472b6',
      };
    case 'stpatricks':
      return {
        headerBackground: 'linear-gradient(110deg, #064e3b 0%, #0f8a43 60%, #65a30d 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #0f8a43 0 11px, #65a30d 11px 21px, #ca8a04 21px 26px)',
        burstColorA: '#0f8a43',
        burstColorB: '#ca8a04',
      };
    case 'july4':
      return {
        headerBackground: 'linear-gradient(110deg, #172554 0%, #1e3a8a 52%, #dc2626 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #1e3a8a 0 10px, #ffffff 10px 16px, #dc2626 16px 26px)',
        burstColorA: '#1e3a8a',
        burstColorB: '#dc2626',
      };
    case 'halloween':
      return {
        headerBackground: 'linear-gradient(110deg, #111827 0%, #4c1d95 50%, #c2410c 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #c2410c 0 11px, #111827 11px 20px, #6d28d9 20px 27px)',
        burstColorA: '#c2410c',
        burstColorB: '#6d28d9',
      };
    case 'thanksgiving':
      return {
        headerBackground: 'linear-gradient(110deg, #451a03 0%, #9a5a1a 55%, #d97706 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #9a5a1a 0 11px, #b45309 11px 20px, #d97706 20px 27px)',
        burstColorA: '#9a5a1a',
        burstColorB: '#d97706',
      };
    case 'christmas':
      return {
        headerBackground: 'linear-gradient(110deg, #14532d 0%, #15803d 48%, #be123c 100%)',
        headerForeground: '#ffffff',
        sectionDividerImage: 'repeating-linear-gradient(90deg, #be123c 0 10px, #ffffff 10px 16px, #15803d 16px 26px)',
        burstColorA: '#be123c',
        burstColorB: '#15803d',
      };
    default:
      return defaults;
  }
}
