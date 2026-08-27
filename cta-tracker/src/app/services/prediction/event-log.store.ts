// IndexedDB-backed append-only log of stop views, plus the shadow-mode prediction records.
//
// IndexedDB rather than the localStorage the rest of the app uses, for three reasons: the log grows
// without bound where every existing key is a bounded snapshot; localStorage writes are synchronous
// on the main thread of a screen that already polls every 30 s; and the ~5 MB origin budget is
// shared with the cached CTA payloads ('traindata' and one entry per route/direction stop list),
// which are large enough that an append-only log would eventually evict them.
//
// Hand-rolled rather than pulling in `idb`: the app has no runtime dependency outside Angular and
// RxJS, and the production budget (500 kB warn / 1 MB error) is tight enough to be worth respecting
// for a feature the user never asked to pay for.

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PredictionRecord, SCHEMA_VERSION, StopKey, StopViewEvent } from './stop-view-event';

const DB_NAME = 'cta-prediction';
const DB_VERSION = 1;

const STORE_VIEWS = 'stopViews';
const STORE_PREDICTIONS = 'predictions';
const STORE_META = 'meta';

/** Retention: whichever bound bites first. Enough history for a year-round weekly pattern. */
const MAX_EVENTS = 5000;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

@Injectable({ providedIn: 'root' })
export class EventLogStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  /**
   * Every public method funnels through here and tolerates a null database.
   *
   * IndexedDB is genuinely unavailable in more situations than it looks: the prerender has no
   * `indexedDB` at all, Firefox in permanent private mode rejects `open()`, and Safari can throw
   * on a cross-origin-framed page. None of those should break the app — the worst acceptable
   * outcome of a telemetry layer failing is that no telemetry is collected.
   */
  private open(): Promise<IDBDatabase | null> {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    if (!this.isBrowser || typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        resolve(null);
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_VIEWS)) {
          const views = db.createObjectStore(STORE_VIEWS, { keyPath: 'id', autoIncrement: true });
          views.createIndex('ts', 'ts');
          views.createIndex('stopKey', 'stopKey');
          views.createIndex('sessionId', 'sessionId');
        }
        if (!db.objectStoreNames.contains(STORE_PREDICTIONS)) {
          const predictions = db.createObjectStore(STORE_PREDICTIONS, { keyPath: 'id', autoIncrement: true });
          predictions.createIndex('ts', 'ts');
          predictions.createIndex('sessionId', 'sessionId');
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.dbPromise;
  }

  private async withStore<T>(
    store: string,
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => Promise<T>
  ): Promise<T | null> {
    const db = await this.open();
    if (!db) {
      return null;
    }
    try {
      return await work(db.transaction(store, mode).objectStore(store));
    } catch {
      return null;
    }
  }

  /** Returns the new row's key so the caller can patch dwell time onto it later. */
  async append(event: StopViewEvent): Promise<number | null> {
    const key = await this.withStore(STORE_VIEWS, 'readwrite', (store) =>
      promisify(store.add(event)));
    return typeof key === 'number' ? key : null;
  }

  /**
   * Read-modify-write of a single row, used for the fields that are only known after the fact
   * (dwell time, refresh count, a late-arriving GPS fix).
   */
  async patch(id: number, changes: Partial<StopViewEvent>): Promise<void> {
    await this.withStore(STORE_VIEWS, 'readwrite', async (store) => {
      const existing = await promisify<StopViewEvent | undefined>(store.get(id));
      if (existing) {
        await promisify(store.put({ ...existing, ...changes, id }));
      }
    });
  }

  /** All events, oldest first. The whole log is the feature window; it is capped by pruning. */
  async allEvents(): Promise<StopViewEvent[]> {
    const events = await this.withStore(STORE_VIEWS, 'readonly', (store) =>
      promisify<StopViewEvent[]>(store.index('ts').getAll()));
    return events ?? [];
  }

  async recentEvents(sinceMs: number): Promise<StopViewEvent[]> {
    const events = await this.withStore(STORE_VIEWS, 'readonly', (store) =>
      promisify<StopViewEvent[]>(store.index('ts').getAll(IDBKeyRange.lowerBound(sinceMs))));
    return events ?? [];
  }

  /**
   * The most recent event, or null on an empty log. Uses a reverse cursor rather than reading a
   * time window, so it cannot silently return null just because the previous view is older than
   * whatever window the caller guessed.
   */
  async lastEvent(): Promise<StopViewEvent | null> {
    const event = await this.withStore(STORE_VIEWS, 'readonly', (store) =>
      new Promise<StopViewEvent | null>((resolve, reject) => {
        const request = store.index('ts').openCursor(null, 'prev');
        request.onsuccess = () => resolve(request.result?.value ?? null);
        request.onerror = () => reject(request.error);
      }));
    return event ?? null;
  }

  async countEvents(): Promise<number> {
    return (await this.withStore(STORE_VIEWS, 'readonly', (store) => promisify(store.count()))) ?? 0;
  }

  async appendPrediction(record: PredictionRecord): Promise<number | null> {
    const key = await this.withStore(STORE_PREDICTIONS, 'readwrite', (store) =>
      promisify(store.add(record)));
    return typeof key === 'number' ? key : null;
  }

  async patchPrediction(id: number, changes: Partial<PredictionRecord>): Promise<void> {
    await this.withStore(STORE_PREDICTIONS, 'readwrite', async (store) => {
      const existing = await promisify<PredictionRecord | undefined>(store.get(id));
      if (existing) {
        await promisify(store.put({ ...existing, ...changes, id }));
      }
    });
  }

  async allPredictions(): Promise<PredictionRecord[]> {
    const records = await this.withStore(STORE_PREDICTIONS, 'readonly', (store) =>
      promisify<PredictionRecord[]>(store.index('ts').getAll()));
    return records ?? [];
  }

  /**
   * Stable per-install id, minted on first use. Only meaningful inside an export — it exists so a
   * researcher merging exports from a phone and a laptop can tell the two logs apart, not to
   * identify anyone. Nothing transmits it.
   */
  async installId(): Promise<string> {
    const existing = await this.withStore(STORE_META, 'readonly', (store) =>
      promisify<string | undefined>(store.get('installId')));
    if (existing) {
      return existing;
    }
    const minted = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await this.withStore(STORE_META, 'readwrite', (store) =>
      promisify(store.put(minted, 'installId')));
    return minted;
  }

  /** Drops rows past either retention bound. Cheap enough to run once per launch, off the hot path. */
  async prune(now = Date.now()): Promise<void> {
    await this.withStore(STORE_VIEWS, 'readwrite', async (store) => {
      const index = store.index('ts');
      const expired = await promisify<number[]>(
        index.getAllKeys(IDBKeyRange.upperBound(now - MAX_AGE_MS)) as IDBRequest<number[]>);
      for (const key of expired) {
        store.delete(key);
      }
      const remaining = await promisify<number[]>(index.getAllKeys() as IDBRequest<number[]>);
      const overflow = remaining.length - MAX_EVENTS;
      for (let i = 0; i < overflow; i++) {
        store.delete(remaining[i]);
      }
    });

    await this.withStore(STORE_PREDICTIONS, 'readwrite', async (store) => {
      const expired = await promisify<number[]>(
        store.index('ts').getAllKeys(IDBKeyRange.upperBound(now - MAX_AGE_MS)) as IDBRequest<number[]>);
      for (const key of expired) {
        store.delete(key);
      }
    });
  }

  async clear(): Promise<void> {
    await this.withStore(STORE_VIEWS, 'readwrite', (store) => promisify(store.clear()));
    await this.withStore(STORE_PREDICTIONS, 'readwrite', (store) => promisify(store.clear()));
  }

  /**
   * The escape hatch. Iterating on features is far faster in a notebook than in a browser, so the
   * log is only useful if it can leave the device by the user's own hand.
   */
  async exportJson(): Promise<string> {
    const [events, predictions, installId] = await Promise.all([
      this.allEvents(),
      this.allPredictions(),
      this.installId()
    ]);
    return JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      installId,
      events,
      predictions
    }, null, 2);
  }
}

export type { StopKey };
