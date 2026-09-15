import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ArrivalsLayout, DEFAULT_ARRIVALS_LAYOUT, TRAIN_ARRIVALS_LAYOUT_KEY, parseArrivalsLayout
} from './arrivals-layout';

export const SHOW_API_TIMESTAMP_KEY = 'show-api-timestamp';
export const SHOW_DISTANCE_KEY = 'show-distance';
export { TRAIN_ARRIVALS_LAYOUT_KEY };
export type { ArrivalsLayout };

@Injectable({ providedIn: 'root' })
export class DisplayPreferencesService {
  // Must be initialized before the signals below, which read localStorage.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly showApiTimestamp = signal<boolean>(this.load(SHOW_API_TIMESTAMP_KEY));
  readonly showDistance = signal<boolean>(this.load(SHOW_DISTANCE_KEY));
  readonly arrivalsLayout = signal<ArrivalsLayout>(this.loadLayout());

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

  setArrivalsLayout(layout: ArrivalsLayout): void {
    this.arrivalsLayout.set(layout);
    this.storeLayout(layout);
  }

  toggleArrivalsLayout(): void {
    this.setArrivalsLayout(this.arrivalsLayout() === 'columns' ? 'list' : 'columns');
  }

  private store(key: string, show: boolean): void {
    if (this.isBrowser) {
      localStorage.setItem(key, String(show));
    }
  }

  private storeLayout(layout: ArrivalsLayout): void {
    if (this.isBrowser) {
      localStorage.setItem(TRAIN_ARRIVALS_LAYOUT_KEY, layout);
    }
  }

  private load(key: string): boolean {
    if (!this.isBrowser) {
      return true;
    }
    // Defaults to on, so only an explicit opt-out sticks.
    return localStorage.getItem(key) !== 'false';
  }

  private loadLayout(): ArrivalsLayout {
    // The server render has no stored preference, so it draws the default layout; the browser
    // picks the stored one up on hydration.
    if (!this.isBrowser) {
      return DEFAULT_ARRIVALS_LAYOUT;
    }
    return parseArrivalsLayout(localStorage.getItem(TRAIN_ARRIVALS_LAYOUT_KEY));
  }
}
