import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Get initial theme from DOM (already set by inline script in BaseLayout)
function getInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
  return 'light';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: getInitialTheme(),
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        applyTheme(newTheme);
      },
      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: 'theme',
      onRehydrateStorage: () => (state) => {
        // Only apply if we have a saved state AND it differs from current DOM state
        if (state && typeof document !== 'undefined') {
          const currentIsDark = document.documentElement.classList.contains('dark');
          const savedIsDark = state.theme === 'dark';
          // Only apply if different - the inline script already handled initial load
          if (currentIsDark !== savedIsDark) {
            applyTheme(state.theme);
          }
        }
      },
    }
  )
);

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
