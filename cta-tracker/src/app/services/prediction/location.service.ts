// Opt-in coarse location.
//
// Distance to a candidate stop is probably the strongest single feature available — you check the
// stop you are standing near — but it is also the only one that needs a permission, so the whole
// service is built so that nothing here ever surprises the user:
//
//  - The permission prompt fires in exactly one place: the moment the user turns the Settings
//    toggle on. Logging never triggers it.
//  - A fix is never awaited on the write path. Events are written immediately with a null position
//    and patched if a fix arrives, so a slow or absent GPS can't delay or drop an event.
//  - Coordinates are rounded to ~110 m before they are stored. Street-level is plenty to rank a
//    handful of stops, and it is the difference between "roughly where they were" and a precise
//    movement trace sitting in a database on their phone.

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PredictionPreferencesService } from './prediction-preferences.service';
import { LocationSource } from './stop-view-event';

export interface CoarsePosition {
  userLat: number | null;
  userLon: number | null;
  userAccuracyM: number | null;
  userPosAgeMs: number | null;
  locSource: LocationSource;
}

const UNAVAILABLE: CoarsePosition = {
  userLat: null, userLon: null, userAccuracyM: null, userPosAgeMs: null, locSource: 'unavailable'
};

/** ~110 m at Chicago's latitude. */
function coarsen(value: number): number {
  return Math.round(value * 1000) / 1000;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly prefs = inject(PredictionPreferencesService);

  private lastDenied = false;

  /**
   * Turns the feature on and asks for permission in the same gesture, so the prompt always has
   * visible cause. Resolves false if the user declines, leaving the toggle off rather than showing
   * an "on" switch that can't do anything.
   */
  async enable(): Promise<boolean> {
    if (!this.isBrowser || !('geolocation' in navigator)) {
      return false;
    }
    const granted = await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 }
      );
    });
    this.lastDenied = !granted;
    this.prefs.setUseLocation(granted);
    return granted;
  }

  disable(): void {
    this.prefs.setUseLocation(false);
  }

  /**
   * Best-effort position for the write path. Deliberately cheap: a two-minute-old cached fix is
   * fine for ranking stops, high accuracy is off, and the timeout is short enough that the patch
   * lands while the user is still looking at the same screen.
   */
  async current(): Promise<CoarsePosition> {
    if (!this.prefs.useLocation()) {
      return { ...UNAVAILABLE, locSource: 'off' };
    }
    if (!this.isBrowser || !('geolocation' in navigator)) {
      return UNAVAILABLE;
    }

    return new Promise<CoarsePosition>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const age = Date.now() - position.timestamp;
          resolve({
            userLat: coarsen(position.coords.latitude),
            userLon: coarsen(position.coords.longitude),
            userAccuracyM: Math.round(position.coords.accuracy),
            userPosAgeMs: age,
            // A fix older than the max age we asked for came from the platform's cache.
            locSource: age > 5_000 ? 'cached' : 'live'
          });
        },
        (error) => {
          const denied = error.code === error.PERMISSION_DENIED;
          this.lastDenied = denied;
          if (denied) {
            // Permission was revoked in browser settings behind our back. Flip the toggle so the
            // UI stops claiming a capability the app no longer has.
            this.prefs.setUseLocation(false);
          }
          resolve({ ...UNAVAILABLE, locSource: denied ? 'denied' : 'unavailable' });
        },
        { enableHighAccuracy: false, timeout: 3_000, maximumAge: 120_000 }
      );
    });
  }

  wasDenied(): boolean {
    return this.lastDenied;
  }
}
