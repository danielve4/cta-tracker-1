import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const SHOW_API_TIMESTAMP_KEY = 'show-api-timestamp';
export const SHOW_DISTANCE_KEY = 'show-distance';

@Injectable({ providedIn: 'root' })
export class DisplayPreferencesService {
  // Must be initialized before the signal below, which reads localStorage.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly showApiTimestamp = signal<boolean>(this.load(SHOW_API_TIMESTAMP_KEY));
  readonly showDistance = signal<boolean>(this.load(SHOW_DISTANCE_KEY));

  setShowApiTimestamp(show: boolean): void {
    this.showApiTimestamp.set(show);
    this.store(SHOW_API_TIMESTAMP_KEY, show);
  }

  toggleApiTimestamp(): void {
    this.setShowApiTimestamp(!this.showApiTimestamp());
  }

  setShowDistance(show: boolean): void {
    this.showDistance.set(show);
    this.store(SHOW_DISTANCE_KEY, show);
  }

  toggleDistance(): void {
    this.setShowDistance(!this.showDistance());
  }

  private store(key: string, show: boolean): void {
    if (this.isBrowser) {
      localStorage.setItem(key, String(show));
    }
  }

  private load(key: string): boolean {
    if (!this.isBrowser) {
      return true;
    }
    // Defaults to on, so only an explicit opt-out sticks.
    return localStorage.getItem(key) !== 'false';
  }
}
