import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  type Theme,
  findTheme,
  applyTheme,
  getStoredThemeId,
  storeThemeId,
  DEFAULT_THEME,
} from './themes.ts';

interface ThemeContextValue {
  theme: Theme;
  setThemeById: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setThemeById: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = findTheme(getStoredThemeId());
    applyTheme(t); // apply synchronously before first paint
    return t;
  });

  // Re-apply on mount to handle any hydration edge cases
  useEffect(() => { applyTheme(theme); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setThemeById(id: string) {
    const t = findTheme(id);
    applyTheme(t);
    storeThemeId(id);
    setTheme(t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setThemeById }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
