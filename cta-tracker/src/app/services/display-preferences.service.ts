import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ArrivalsLayout, ColumnStyle, DEFAULT_ARRIVALS_LAYOUT, DEFAULT_COLUMN_STYLE,
  TRAIN_ARRIVALS_COLUMN_STYLE_KEY, TRAIN_ARRIVALS_LAYOUT_KEY, TRAIN_ARRIVALS_SWAPPED_LINES_KEY,
  parseArrivalsLayout, parseColumnStyle, parseSwappedLines
} from './arrivals-layout';

export const SHOW_API_TIMESTAMP_KEY = 'show-api-timestamp';
export const SHOW_DISTANCE_KEY = 'show-distance';
export { TRAIN_ARRIVALS_LAYOUT_KEY, TRAIN_ARRIVALS_COLUMN_STYLE_KEY, TRAIN_ARRIVALS_SWAPPED_LINES_KEY };
export type { ArrivalsLayout, ColumnStyle };

@Injectable({ providedIn: 'root' })
export class DisplayPreferencesService {
  // Must be initialized before the signals below, which read localStorage.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly showApiTimestamp = signal<boolean>(this.load(SHOW_API_TIMESTAMP_KEY));
  readonly showDistance = signal<boolean>(this.load(SHOW_DISTANCE_KEY));
  readonly arrivalsLayout = signal<ArrivalsLayout>(this.loadLayout());
  readonly columnStyle = signal<ColumnStyle>(this.loadColumnStyle());
  /** Route ids whose columns show trDr '5' on the left instead of '1'. */
  readonly swappedLines = signal<ReadonlySet<string>>(this.loadSwappedLines());

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
    this.storeString(TRAIN_ARRIVALS_LAYOUT_KEY, layout);
  }

  toggleArrivalsLayout(): void {
    this.setArrivalsLayout(this.arrivalsLayout() === 'columns' ? 'list' : 'columns');
  }

  setColumnStyle(style: ColumnStyle): void {
    this.columnStyle.set(style);
    this.storeString(TRAIN_ARRIVALS_COLUMN_STYLE_KEY, style);
  }

  isLineSwapped(route: string): boolean {
    return this.swappedLines().has(route);
  }

  toggleLineSwapped(route: string): void {
    const next = new Set(this.swappedLines());
    if (!next.delete(route)) {
      next.add(route);
    }
    this.swappedLines.set(next);
    this.storeString(TRAIN_ARRIVALS_SWAPPED_LINES_KEY, JSON.stringify([...next]));
  }

  private store(key: string, show: boolean): void {
    if (this.isBrowser) {
      localStorage.setItem(key, String(show));
    }
  }

  private storeString(key: string, value: string): void {
    if (this.isBrowser) {
      localStorage.setItem(key, value);
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

  private loadColumnStyle(): ColumnStyle {
    if (!this.isBrowser) {
      return DEFAULT_COLUMN_STYLE;
    }
    return parseColumnStyle(localStorage.getItem(TRAIN_ARRIVALS_COLUMN_STYLE_KEY));
  }

  private loadSwappedLines(): ReadonlySet<string> {
    if (!this.isBrowser) {
      return new Set();
    }
    return parseSwappedLines(localStorage.getItem(TRAIN_ARRIVALS_SWAPPED_LINES_KEY));
  }
}
