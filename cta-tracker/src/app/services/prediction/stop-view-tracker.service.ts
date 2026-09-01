// The single write path for stop-view events.
//
// Hooked at the router rather than inside the two arrivals components, for two reasons: a new way
// into a stop view can't silently skip logging, and the previous navigation is available here,
// which is what `entry` is inferred from.

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { BustimeResponse } from '../../busResponse';
import { CTAComprehensiveData } from '../../trainResponse';
import { Favorite } from '../Favorite';
import { FavoritesService } from '../favorites.service';
import { isUserDriven } from './candidates';
import { EventLogStore } from './event-log.store';
import { LocationService } from './location.service';
import { PredictionPreferencesService } from './prediction-preferences.service';
import { SessionService } from './session.service';
import { stopKeyOf } from './stop-key';
import {
  DocumentNavigationType, EntrySource, SCHEMA_VERSION, StopKey, StopKind, StopViewEvent
} from './stop-view-event';

const ARRIVALS_PATH = 'arrivals/:route/:direction/:stopId/:stopName';
const TRAIN_ARRIVALS_PATH = 'train-arrivals/:routeId/:stationId/:stationName';

/** What the router told us about a stop view, before any enrichment. */
interface StopViewParams {
  kind: StopKind;
  stopId: string;
  stopName: string;
  route: string;
  direction: string;
}

interface PendingView {
  id: number;
  visibleSince: number | null;
  accumulatedMs: number;
  refreshCount: number;
}

@Injectable({ providedIn: 'root' })
export class StopViewTrackerService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly store = inject(EventLogStore);
  private readonly session = inject(SessionService);
  private readonly prefs = inject(PredictionPreferencesService);
  private readonly location = inject(LocationService);
  private readonly favoritesService = inject(FavoritesService);

  private started = false;
  private pending: PendingView | null = null;
  private previousUrl: string | null = null;
  private lastStopKey: StopKey | null = null;
  private navigationType: DocumentNavigationType = 'unknown';
  /** Increments per navigation so a slow record() can tell it has been superseded. */
  private navigationToken = 0;

  /**
   * Called from AppComponent inside afterNextRender. Idempotent, browser-only, and it also arms the
   * two lifecycle listeners that close out a view when the user leaves without navigating.
   */
  start(): void {
    if (this.started || !this.isBrowser) {
      return;
    }
    this.started = true;
    this.navigationType = this.readNavigationType();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Bank the elapsed time now: a backgrounded tab may be discarded without another event, and
        // a dwell of "however long until they came back" would be worse than none at all.
        this.accumulateDwell();
        this.flushDwell();
        this.session.touch();
      } else if (this.pending) {
        this.pending.visibleSince = Date.now();
      }
    });
    window.addEventListener('pagehide', () => {
      this.accumulateDwell();
      this.flushDwell();
      this.session.touch();
    });
  }

  /**
   * Entry point for the AppComponent NavigationEnd subscription, which already exists for
   * LS_SAVED_ROUTE. `entry` is read from navigation state where the navigating code set it
   * explicitly, and otherwise inferred from the URL we came from.
   *
   * Resolves with the stop that was opened, so AppComponent can hand it to the predictor to close
   * out an open impression. Returned rather than pushed so this service stays unaware of the
   * predictor, which already depends on it.
   */
  async handleNavigation(event: NavigationEnd, stateEntry: EntrySource | null): Promise<StopKey | null> {
    if (!this.isBrowser) {
      return null;
    }
    this.session.touch();

    // Close out whatever was open before recording anything new.
    this.accumulateDwell();
    this.flushDwell();
    this.pending = null;
    const token = ++this.navigationToken;

    const params = this.matchStopView();
    const from = this.previousUrl;
    const isFirstOfDocument = this.previousUrl === null;
    this.previousUrl = event.urlAfterRedirects;
    if (!params) {
      return null;
    }
    const stopKey = stopKeyOf(params.kind, params.stopId);
    if (this.prefs.collectHistory()) {
      const entry = stateEntry ?? this.inferEntry(from, isFirstOfDocument);
      // Claimed synchronously, before any await: record() resolves after several IndexedDB
      // round-trips, so claiming it there would let two interleaved navigations assign sequence
      // numbers in a different order than their timestamps. `isUserDriven` keeps a restore or a
      // reload from counting as the user having chosen a stop, which would suppress the suggestion
      // for the rest of the launch.
      const seq = this.session.takeSeq(isUserDriven(entry));
      await this.record(params, entry, from, seq, token);
    }
    return stopKey;
  }

  /** Called by the arrivals components when the user taps refresh — engagement dwell alone misses. */
  noteRefresh(): void {
    if (this.pending) {
      this.pending.refreshCount++;
      void this.store.patch(this.pending.id, { refreshCount: this.pending.refreshCount });
    }
  }

  /** The stop opened most recently, for the transition feature. */
  previousStopKey(): StopKey | null {
    return this.lastStopKey;
  }

  /**
   * Walks to the deepest activated route and reads its params, rather than regexing the URL —
   * the router has already decoded the segments, and stop names contain spaces and punctuation.
   */
  private matchStopView(): StopViewParams | null {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
    }
    const path = snapshot?.routeConfig?.path;
    if (!snapshot || !path) {
      return null;
    }

    if (path === ARRIVALS_PATH) {
      return {
        kind: 'bus',
        stopId: snapshot.params['stopId'] ?? '',
        stopName: snapshot.params['stopName'] ?? '',
        route: snapshot.params['route'] ?? '',
        direction: snapshot.params['direction'] ?? ''
      };
    }
    if (path === TRAIN_ARRIVALS_PATH) {
      return {
        kind: 'train',
        stopId: snapshot.params['stationId'] ?? '',
        stopName: snapshot.params['stationName'] ?? '',
        route: snapshot.params['routeId'] ?? '',
        direction: ''
      };
    }
    return null;
  }

  /**
   * Where the user came from, by previous URL.
   *
   * The absence of a previous URL means this is the first navigation of the document — a genuine
   * deep link. The two cases that would otherwise be misread as one, a restored session and a
   * tapped suggestion, are passed in as explicit navigation state instead of guessed here.
   */
  private inferEntry(from: string | null, isFirstOfDocument: boolean): EntrySource {
    if (from === null) {
      // No previous URL means this is the document's first navigation. Whether that is a real deep
      // link or the browser putting the user back where they already were is the difference between
      // a training label and a fabricated one, and only the navigation type can tell them apart.
      if (isFirstOfDocument && this.navigationType !== 'navigate' && this.navigationType !== 'unknown') {
        return 'reload';
      }
      return 'deep-link';
    }
    if (from.startsWith('/favorites')) return 'favorites';
    if (from.startsWith('/stops/') || from.startsWith('/train-stops/')) return 'browse';
    if (from.startsWith('/follow/') || from.startsWith('/train-follow/')) return 'follow';
    if (from === '/' || from.startsWith('/routes')) return 'search';
    return 'unknown';
  }

  private readNavigationType(): DocumentNavigationType {
    try {
      const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return (entry?.type as DocumentNavigationType) ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async record(
    params: StopViewParams,
    entry: EntrySource,
    fromUrl: string | null,
    seqInSession: number,
    token: number
  ): Promise<void> {
    const now = Date.now();
    const stopKey = stopKeyOf(params.kind, params.stopId);
    const coordinates = this.stopCoordinates(params);
    const favorite = await this.favoriteState(stopKey);

    const event: StopViewEvent = {
      v: SCHEMA_VERSION,
      ts: now,
      tzOffsetMin: new Date(now).getTimezoneOffset(),
      sessionId: this.session.currentSessionId(),
      seqInSession,
      msSincePrevEvent: null,
      msSinceLastAppOpen: this.session.gapMs(),
      stopKey,
      kind: params.kind,
      stopId: params.stopId,
      stopName: params.stopName,
      route: params.route,
      direction: params.direction,
      stopLat: coordinates?.lat ?? null,
      stopLon: coordinates?.lon ?? null,
      entry,
      navigationType: this.navigationType,
      fromUrl,
      isFavorite: favorite.index >= 0,
      favoriteRank: favorite.index >= 0 ? favorite.index : null,
      userLat: null,
      userLon: null,
      userAccuracyM: null,
      userPosAgeMs: null,
      locSource: this.prefs.useLocation() ? 'unavailable' : 'off',
      dwellMs: null,
      refreshCount: 0,
      launchedStandalone: this.isStandalone()
    };

    // `msSincePrevEvent` needs the row before this one; the log is the source of truth for it, so
    // it is read rather than tracked in memory (a reload would otherwise reset it to null forever).
    // The window spans the whole retained log rather than a day: a shorter one silently collapses
    // "the previous view was 25 hours ago" into the same null that means "there was no previous
    // view", which is not recoverable offline.
    const previous = await this.store.lastEvent();
    if (previous) {
      event.msSincePrevEvent = now - previous.ts;
    }

    const id = await this.store.append(event);
    if (id === null) {
      return;
    }
    // A newer navigation may have landed while the writes above were in flight. Installing this
    // view as `pending` now would attribute the *next* stop's dwell time and refresh taps to this
    // row, and leave `lastStopKey` — the Markov feature's previous stop — pointing at the wrong one.
    if (token !== this.navigationToken) {
      return;
    }
    this.lastStopKey = stopKey;
    this.pending = {
      id,
      visibleSince: document.visibilityState === 'visible' ? Date.now() : null,
      accumulatedMs: 0,
      refreshCount: 0
    };

    // Never awaited before the write: a slow or absent fix must not delay or drop the event.
    void this.location.current().then((position) => {
      if (position.userLat !== null || position.locSource !== 'off') {
        void this.store.patch(id, position);
      }
    });
  }

  /**
   * Reads the stop's coordinates straight out of the caches the app already maintains, so the write
   * path stays free of network calls. They are copied onto the event because these very cache
   * entries are what Settings > Clear Cache wipes.
   */
  private stopCoordinates(params: StopViewParams): { lat: number; lon: number } | null {
    try {
      if (params.kind === 'train') {
        const raw = localStorage.getItem('traindata');
        if (!raw) return null;
        const data = JSON.parse(raw) as CTAComprehensiveData;
        const station = data.stations?.[params.stopId];
        return station ? { lat: station.latitude, lon: station.longitude } : null;
      }
      const exact = this.busStopFrom(
        `busroutestops?route=${params.route}&direction=${params.direction}`, params.stopId);
      return exact ?? this.searchCachedBusStops(params.stopId);
    } catch {
      return null;
    }
  }

  /**
   * Last resort for a bus stop whose own route/direction list was never cached.
   *
   * Opening a stop from Favorites goes straight to the arrivals URL without ever fetching that
   * route's stop list, so the exact-key lookup above misses — and it misses on precisely the stops
   * the user cares most about. Their coordinates are usually still on disk under a *different*
   * route or direction the user did browse, because stop ids are global rather than per-route.
   * Scanning a handful of localStorage keys is far cheaper than a network call on the write path,
   * and a miss just leaves the coordinates null as before.
   */
  private searchCachedBusStops(stopId: string): { lat: number; lon: number } | null {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('busroutestops?')) {
        continue;
      }
      const found = this.busStopFrom(key, stopId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private busStopFrom(key: string, stopId: string): { lat: number; lon: number } | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as BustimeResponse;
      const stop = data.stops?.find(candidate => candidate.stpid === stopId);
      return stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lon)
        ? { lat: stop.lat, lon: stop.lon }
        : null;
    } catch {
      return null;
    }
  }

  private favoriteState(stopKey: StopKey): Promise<{ index: number }> {
    return new Promise((resolve) => {
      this.favoritesService.getFavorites().subscribe({
        next: (favorites: Array<Favorite>) => {
          const index = favorites.findIndex(favorite =>
            stopKeyOf(favorite.type ?? 'bus', favorite.stopId) === stopKey);
          resolve({ index });
        },
        error: () => resolve({ index: -1 })
      });
    });
  }

  private isStandalone(): boolean {
    return this.isBrowser && window.matchMedia('(display-mode: standalone)').matches;
  }

  private accumulateDwell(): void {
    if (this.pending && this.pending.visibleSince !== null) {
      this.pending.accumulatedMs += Date.now() - this.pending.visibleSince;
      this.pending.visibleSince = null;
    }
  }

  /** Patches rather than finalizes, so a view resumed after backgrounding keeps growing. */
  private flushDwell(): void {
    if (this.pending && this.pending.accumulatedMs > 0) {
      void this.store.patch(this.pending.id, { dwellMs: this.pending.accumulatedMs });
    }
  }
}
