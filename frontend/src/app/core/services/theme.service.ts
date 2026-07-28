import { Injectable, signal, effect } from '@angular/core';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aak_theme';
const THEME_ATTR = 'data-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private currentSignal = signal<Theme>(this.loadInitialTheme());

  /** Current theme */
  readonly current = this.currentSignal.asReadonly();

  /** Whether dark mode is active */
  readonly isDark = signal(this.loadInitialTheme() === 'dark');

  constructor() {
    // Apply theme on construction
    this.applyTheme(this.currentSignal());

    // Persist and apply whenever theme changes
    effect(() => {
      const theme = this.currentSignal();
      localStorage.setItem(STORAGE_KEY, theme);
      this.applyTheme(theme);
    });
  }

  /** Toggle between light and dark */
  toggle(): void {
    this.currentSignal.update(t => (t === 'light' ? 'dark' : 'light'));
  }

  /** Set a specific theme */
  setTheme(theme: Theme): void {
    this.currentSignal.set(theme);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute(THEME_ATTR, theme);
    // Toggle .dark class for CSS compatibility
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.isDark.set(theme === 'dark');
  }

  private loadInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;

    // Check system preference
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
}
