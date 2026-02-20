import { Injectable, signal, effect, computed } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.loadPreference());

  private readonly systemPrefersDark = signal(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  constructor() {
    effect(() => {
      const theme = this.resolvedTheme();
      document.documentElement.setAttribute('data-theme', theme);

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
      }
    });

    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        this.systemPrefersDark.set(e.matches);
      });
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    localStorage.setItem(STORAGE_KEY, pref);
  }

  toggle(): void {
    const next = this.resolvedTheme() === 'dark' ? 'light' : 'dark';
    this.setPreference(next);
  }

  private loadPreference(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }
}
