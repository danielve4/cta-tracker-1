import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const SHOW_API_TIMESTAMP_KEY = 'show-api-timestamp';

@Injectable({ providedIn: 'root' })
export class DisplayPreferencesService {
  // Must be initialized before the signal below, which reads localStorage.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly showApiTimestamp = signal<boolean>(this.loadShowApiTimestamp());

  setShowApiTimestamp(show: boolean): void {
    this.showApiTimestamp.set(show);
    if (this.isBrowser) {
      localStorage.setItem(SHOW_API_TIMESTAMP_KEY, String(show));
    }
  }

  toggleApiTimestamp(): void {
    this.setShowApiTimestamp(!this.showApiTimestamp());
  }

  private loadShowApiTimestamp(): boolean {
    if (!this.isBrowser) {
      return true;
    }
    // Defaults to on, so only an explicit opt-out sticks.
    return localStorage.getItem(SHOW_API_TIMESTAMP_KEY) !== 'false';
  }
}
