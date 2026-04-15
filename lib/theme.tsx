'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

type ThemeCtx = {
  theme: Theme;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  // Read stored preference on mount.
  // Sync-on-mount is the correct React pattern for hydrating from localStorage
  // (we can't read it during render because it's undefined on the server).
  useEffect(() => {
    const stored = localStorage.getItem('cb-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored);
      document.documentElement.className = stored;
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cb-theme', next);
      document.documentElement.className = next;
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
