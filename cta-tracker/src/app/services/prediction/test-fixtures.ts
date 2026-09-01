// Shared builders for the prediction specs. Not imported by app code.

import { SafeStorage } from './safe-storage';
import { EntrySource, SCHEMA_VERSION, StopKey, StopViewEvent } from './stop-view-event';

/** A SafeStorage backed by a plain Map, so two SessionStates can share one "browser". */
export function memoryStorage(
  backing = new Map<string, string>()
): SafeStorage & { backing: Map<string, string> } {
  return {
    backing,
    get: (key) => backing.get(key) ?? null,
    set: (key, value) => { backing.set(key, value); return true; }
  };
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** A stop view with sane defaults, so each test states only the fields it is actually about. */
export function evt(overrides: Partial<StopViewEvent> & { ts: number; stopKey: StopKey }): StopViewEvent {
  const [kind, stopId] = overrides.stopKey.split(':');
  return {
    v: SCHEMA_VERSION,
    tzOffsetMin: 0,
    sessionId: 'session-1',
    seqInSession: 0,
    msSincePrevEvent: null,
    msSinceLastAppOpen: 3 * HOUR,
    kind: kind as 'bus' | 'train',
    stopId,
    stopName: `Stop ${stopId}`,
    route: '22',
    direction: 'Northbound',
    stopLat: null,
    stopLon: null,
    entry: 'browse' as EntrySource,
    navigationType: 'navigate',
    fromUrl: null,
    isFavorite: false,
    favoriteRank: null,
    userLat: null,
    userLon: null,
    userAccuracyM: null,
    userPosAgeMs: null,
    locSource: 'off',
    dwellMs: null,
    refreshCount: 0,
    launchedStandalone: false,
    ...overrides
  };
}

/**
 * Background views of one stop, oldest first, a day apart, ending a day before `now`.
 *
 * `msSinceLastAppOpen: null` marks these as ordinary mid-session views so they are not themselves
 * picked up as training examples — a test asserting on example extraction wants to control exactly
 * which events are eligible.
 */
export function history(now: number, stopKey: StopKey, count: number, sessionPrefix = 'h'): StopViewEvent[] {
  return Array.from({ length: count }, (_, i) =>
    evt({
      ts: now - (count - i) * DAY,
      stopKey,
      sessionId: `${sessionPrefix}${i}`,
      msSinceLastAppOpen: null
    }));
}

/**
 * The log is always read back through the `ts` index, so anything fed to the feature code must be
 * chronological. Test data assembled from several `history()` calls is not.
 */
export function sorted(...groups: StopViewEvent[][]): StopViewEvent[] {
  return groups.flat().sort((a, b) => a.ts - b.ts);
}
