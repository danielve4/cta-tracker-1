// The on-device record of "the user opened this stop".
//
// Guiding principle for everything in this folder: log raw observations, derive features at read
// time. Nothing here stores an encoding — no sin/cos, no `isColdStart` boolean, no bucketed hour.
// Feature engineering will change many times before a model ships, and a log that stores encodings
// has to be migrated (or thrown away) every time it does. Storing `ts` and the raw inter-session
// gap instead means a change to features.ts applies retroactively to all history already collected.

export const SCHEMA_VERSION = 2;

export type StopKind = 'bus' | 'train';

/**
 * Canonical stop identifier: 'bus:1234' | 'train:40380'.
 *
 * Namespaced because the two id spaces overlap numerically and nothing in the app unifies them —
 * bus stops are keyed by `stpid`, train stations by CTA `mapid`, and the backend confusingly
 * receives both as a `stopId` query param.
 */
export type StopKey = `${StopKind}:${string}`;

/**
 * How the user arrived at the stop view. Two of these exist purely to keep the training set honest:
 *
 * - `suggestion` — the user tapped our own prediction, so the event was *caused by the model*.
 *   Training on it teaches the model that its past guesses were correct regardless of whether they
 *   were, which is a feedback loop that gets worse with every retrain.
 * - `restored` — AppComponent auto-navigates to LS_SAVED_ROUTE when the app is launched from '/'.
 *   Untagged, every cold launch looks like a deliberate deep-link and injects a stop the user never
 *   chose as the "first stop of the session" label.
 * - `reload` — the document was reloaded or restored onto a stop page rather than navigated to it.
 *   iOS discards a backgrounded PWA and reloads the URL it was on, so without this the browser
 *   putting the user back where they already were is indistinguishable from them deliberately
 *   opening that stop after hours away — and it lands in exactly the cold-start situation the
 *   predictor targets.
 */
export type EntrySource =
  | 'browse'
  | 'favorites'
  | 'search'
  | 'follow'
  | 'deep-link'
  | 'restored'
  | 'reload'
  | 'suggestion'
  | 'unknown';

/** Mirrors PerformanceNavigationTiming.type; 'unknown' when the API is unavailable. */
export type DocumentNavigationType = 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'unknown';

export type LocationSource = 'live' | 'cached' | 'denied' | 'unavailable' | 'off';

export interface StopViewEvent {
  /** SCHEMA_VERSION at write time. Present on every row so a migration can tell generations apart. */
  v: number;
  /** IndexedDB autoincrement key; absent until the row is written. */
  id?: number;

  /** Epoch ms. Raw — all temporal features derive from this. */
  ts: number;
  /**
   * `Date.prototype.getTimezoneOffset()` at event time. Local-time features must be computed from
   * this rather than the device's current offset, or a DST change silently rotates months of
   * history by an hour and a trip out of Chicago corrupts everything recorded during it.
   */
  tzOffsetMin: number;

  sessionId: string;
  /**
   * Position of this view within its session, 0-based.
   *
   * Note this is *not* the same as "the stop the user chose": seq 0 is frequently the app's own
   * doing (a LS_SAVED_ROUTE restore, a reload). `extractTrainingExamples` derives the real choice
   * by taking the session's first user-driven entry rather than trusting this field.
   */
  seqInSession: number;
  msSincePrevEvent: number | null;
  /**
   * Gap between this session and the previous one. Stored raw so the "user has been away a while"
   * threshold stays a hyperparameter to tune offline rather than a constant baked into the log.
   */
  msSinceLastAppOpen: number | null;

  stopKey: StopKey;
  kind: StopKind;
  /** `stpid` for bus, `mapid` for train. */
  stopId: string;
  stopName: string;
  /** `rt` for bus, `routeId` for train. */
  route: string;
  /** Bus only; '' for train, whose direction is per-arrival rather than per-URL. */
  direction: string;
  /**
   * The stop's own coordinates, denormalized at write time from caches that already exist.
   * Copied in rather than looked up later so the distance feature survives Settings > Clear Cache,
   * which wipes the very localStorage entries these come from.
   */
  stopLat: number | null;
  stopLon: number | null;

  entry: EntrySource;
  /**
   * How the *document* was loaded, independent of `entry`. Stored raw as well as folded into
   * `entry` so an offline consumer can re-derive the distinction differently later.
   */
  navigationType: DocumentNavigationType;
  fromUrl: string | null;
  isFavorite: boolean;
  favoriteRank: number | null;

  /** Rounded to 3 decimals (~110 m) before storage — enough to rank stops, not a movement trace. */
  userLat: number | null;
  userLon: number | null;
  userAccuracyM: number | null;
  userPosAgeMs: number | null;
  locSource: LocationSource;

  /** Patched in when the view is left. Separates a real look from a mis-tap. */
  dwellMs: number | null;
  /** Manual refresh taps while the view was open — an engagement signal dwell alone misses. */
  refreshCount: number;
  launchedStandalone: boolean;
}

/** A ranking the predictor produced, written before the outcome is known. */
export interface PredictionRecord {
  v: number;
  id?: number;
  ts: number;
  sessionId: string;
  /** Ranked best-first. */
  ranked: Array<{ stopKey: StopKey; score: number }>;
  candidateCount: number;
  /** Most-recently-used, the trivial baseline any scorer has to beat. */
  mruStopKey: StopKey | null;
  scorerVersion: string;
  featureVersion: string;
  msSinceLastAppOpen: number | null;

  /** Resolved once the session's first stop view lands, or on dismissal. */
  actualStopKey: StopKey | null;
  /** 0-based position of the actual stop in `ranked`; -1 if it was not ranked at all. */
  rankOfActual: number | null;
  dismissed: boolean;
  resolvedAt: number | null;
}
