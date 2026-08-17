import { Injectable, signal, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * A ticking wall clock. Arrival countdowns are derived from an absolute arrival instant minus
 * `now()`, so reading this signal is what makes them decay between the 30s polls instead of
 * sitting frozen at whatever the API said when the prediction was generated.
 *
 * The tick is finer than the poll interval so a minute boundary is never more than one tick late.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly now = signal(Date.now());

  constructor() {
    // The prerender platform has no need to tick and would keep the render alive.
    if (!this.isBrowser) {
      return;
    }
    const intervalId = setInterval(() => this.now.set(Date.now()), 15 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }
}
