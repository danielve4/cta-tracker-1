import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const COLLECT_STOP_HISTORY_KEY = 'predict-collect-history';
export const USE_LOCATION_KEY = 'predict-use-location';

/**
 * Toggles for the prediction feature, mirroring DisplayPreferencesService.
 *
 * The two defaults differ on purpose. History collection defaults on: it is a few hundred rows of
 * which-stop-when that never leave the device, and a suggestion feature that collects nothing until
 * the user finds a settings screen would never have data to work with. Location defaults off and
 * stays off until the user turns it on, because enabling it is what fires the browser permission
 * prompt — an unexplained prompt is worse than a slightly weaker model.
 */
@Injectable({ providedIn: 'root' })
export class PredictionPreferencesService {
  // Must be initialized before the signals below, which read localStorage.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly collectHistory = signal<boolean>(this.load(COLLECT_STOP_HISTORY_KEY, true));
  readonly useLocation = signal<boolean>(this.load(USE_LOCATION_KEY, false));

  setCollectHistory(enabled: boolean): void {
    this.collectHistory.set(enabled);
    this.store(COLLECT_STOP_HISTORY_KEY, enabled);
  }

  setUseLocation(enabled: boolean): void {
    this.useLocation.set(enabled);
    this.store(USE_LOCATION_KEY, enabled);
  }

  private store(key: string, value: boolean): void {
    if (this.isBrowser) {
      localStorage.setItem(key, String(value));
    }
  }

  private load(key: string, fallback: boolean): boolean {
    if (!this.isBrowser) {
      return fallback;
    }
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  }
}
