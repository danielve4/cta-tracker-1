import { Injectable, signal, effect, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Must be initialized before the signal fields below, which call into browser APIs.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly preference = signal<ThemePreference>(this.loadPreference());

  private readonly systemPrefersDark = signal(
    this.isBrowser && window.matchMedia('(prefers-color-scheme: dark)').matches
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
    // Browser-only: the prerender/server platform has no document/matchMedia, and the
    // inline script in index.html already sets data-theme at runtime before paint.
    if (this.isBrowser) {
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
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }

  toggle(): void {
    const next = this.resolvedTheme() === 'dark' ? 'light' : 'dark';
    this.setPreference(next);
  }

  private loadPreference(): ThemePreference {
    if (!this.isBrowser) {
      return 'system';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }
}
