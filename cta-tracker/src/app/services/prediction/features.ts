// Feature derivation. Pure functions over StopViewEvent[] — no I/O, no injection, no storage.
//
// Nothing in the log is an encoding, so this file is the only thing that has to change when feature
// engineering changes, and any such change applies retroactively to all history already collected.

import { haversineFeet } from '../distance';
import { StopKey, StopViewEvent } from './stop-view-event';

/** Bump when the meaning of any emitted feature changes, so old prediction records stay comparable. */
export const FEATURE_VERSION = '1';

const MINUTES_PER_DAY = 1440;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Local wall-clock fields for an event, reconstructed from the offset captured *at the time it
 * happened* rather than the device's current offset.
 *
 * This matters more than it looks. Reading `new Date(ts).getHours()` uses today's offset, so after
 * a DST change every event recorded on the other side of it shifts by an hour, and anything logged
 * while travelling is interpreted in the wrong zone entirely. Both silently smear the time-of-day
 * signal that the whole model depends on.
 */
export function localParts(event: Pick<StopViewEvent, 'ts' | 'tzOffsetMin'>): {
  minuteOfDay: number;
  dayOfWeek: number;
} {
  const shifted = new Date(event.ts - event.tzOffsetMin * 60_000);
  return {
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay()
  };
}

/**
 * Projects a value on a cycle of length `period` onto the unit circle, once per harmonic.
 *
 * The problem this solves: minute-of-day is an integer in [0, 1440), so 23:59 is 1439 and 00:01 is
 * 1 — numerically 1438 apart, actually 2 minutes apart. A model reading the raw number learns a
 * cliff at midnight that does not exist. Mapping to (cos θ, sin θ) with θ = 2π·t/period makes
 * euclidean distance monotone in true circular distance, and both outputs land in [-1, 1] so no
 * scaling is needed.
 *
 * Why more than one harmonic: a single (cos, sin) pair is one sinusoid over the cycle, which can
 * only express a single peak. Transit use is bimodal — a morning rush and an evening rush — and a
 * linear model given only k=1 cannot represent that shape at all. k=2 supplies the twice-daily
 * structure and k=3 picks up a midday bump.
 */
export function cyclic(value: number, period: number, harmonics = 1): number[] {
  const theta = (2 * Math.PI * value) / period;
  const out: number[] = [];
  for (let k = 1; k <= harmonics; k++) {
    out.push(Math.cos(k * theta), Math.sin(k * theta));
  }
  return out;
}

/**
 * Shortest distance between two points on a cycle, e.g. 23:50 and 00:10 are 20 minutes apart.
 * Any "around the same time of day" comparison has to use this rather than a plain difference,
 * for exactly the reason the cyclic encoding exists.
 */
export function circularDistance(a: number, b: number, period: number): number {
  const diff = Math.abs(a - b) % period;
  return Math.min(diff, period - diff);
}

export type PartOfDay = 'early' | 'am-peak' | 'midday' | 'pm-peak' | 'evening';

/**
 * Coarse buckets alongside the harmonics. Trees and interaction terms consume these directly, and
 * the boundaries encode something the harmonics have to spend capacity learning: CTA rush hours.
 */
export function partOfDay(minuteOfDay: number): PartOfDay {
  const hour = minuteOfDay / 60;
  if (hour < 6) return 'early';
  if (hour < 9.5) return 'am-peak';
  if (hour < 15) return 'midday';
  if (hour < 19) return 'pm-peak';
  return 'evening';
}

const PARTS_OF_DAY: PartOfDay[] = ['early', 'am-peak', 'midday', 'pm-peak', 'evening'];

/** The moment a prediction is being made for. */
export interface PredictionContext {
  ts: number;
  tzOffsetMin: number;
  msSinceLastAppOpen: number | null;
  userLat: number | null;
  userLon: number | null;
  launchedStandalone: boolean;
  /** Last stop opened before this session, for the first-order transition feature. */
  previousStopKey: StopKey | null;
}

export interface NamedFeatures {
  names: string[];
  values: number[];
}

/** Features of the moment, computed once per prediction and shared across all candidates. */
export function contextFeatures(context: PredictionContext): NamedFeatures {
  const { minuteOfDay, dayOfWeek } = localParts(context);
  const timeOfDay = cyclic(minuteOfDay, MINUTES_PER_DAY, 3);
  const weekday = cyclic(dayOfWeek, 7, 1);
  const bucket = partOfDay(minuteOfDay);
  const hoursAway = context.msSinceLastAppOpen === null
    ? 0
    : context.msSinceLastAppOpen / MS_PER_HOUR;

  const names = [
    'tod_cos1', 'tod_sin1', 'tod_cos2', 'tod_sin2', 'tod_cos3', 'tod_sin3',
    'dow_cos', 'dow_sin',
    ...PARTS_OF_DAY.map(part => `part_${part}`),
    'is_weekend',
    'log_hours_away',
    'gap_known',
    'standalone'
  ];
  const values = [
    ...timeOfDay,
    ...weekday,
    ...PARTS_OF_DAY.map(part => (part === bucket ? 1 : 0)),
    dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
    Math.log1p(hoursAway),
    context.msSinceLastAppOpen === null ? 0 : 1,
    context.launchedStandalone ? 1 : 0
  ];
  return { names, values };
}

/** Everything about one candidate stop that the log can supply, plus the raw pieces the scorer wants. */
export interface CandidateFeatures {
  stopKey: StopKey;
  named: NamedFeatures;

  // Raw components, kept out of the vector so baseline-scorer.ts can weight them by name and stay
  // readable. The learned model consumes `named` and ignores these.
  recency7d: number;
  recency1d: number;
  viewCount: number;
  hoursSinceLastView: number | null;
  timeAffinity: number;
  dowAffinity: number;
  markovProb: number;
  isFavorite: boolean;
  favoriteRankNorm: number;
  distanceFeet: number | null;
}

/**
 * Exponentially-decayed view count: recent visits count for close to 1, a visit one half-life ago
 * for ~0.37, one a month ago for nearly nothing. The single strongest classical signal in the
 * next-item-prediction literature, and it subsumes both "frequency" and "recency" in one number.
 */
function decayedCount(timestamps: number[], now: number, tauMs: number): number {
  let total = 0;
  for (const ts of timestamps) {
    total += Math.exp(-Math.max(0, now - ts) / tauMs);
  }
  return total;
}

/** Per-stop history, built once per prediction rather than per candidate. */
export interface HistoryIndex {
  byStop: Map<StopKey, StopViewEvent[]>;
  /** first-order transitions: previous stopKey -> next stopKey -> count. */
  transitions: Map<StopKey, Map<StopKey, number>>;
  favoriteRank: Map<StopKey, number>;
  favoriteCount: number;
}

export function buildHistoryIndex(
  events: StopViewEvent[],
  favoriteKeys: StopKey[]
): HistoryIndex {
  const byStop = new Map<StopKey, StopViewEvent[]>();
  const transitions = new Map<StopKey, Map<StopKey, number>>();

  let previous: StopViewEvent | null = null;
  for (const event of events) {
    const bucket = byStop.get(event.stopKey);
    if (bucket) {
      bucket.push(event);
    } else {
      byStop.set(event.stopKey, [event]);
    }

    // A repeat of the same stop *within* a session is a refresh, not a pattern. The same repeat
    // *across* sessions is the strongest habit in this dataset — the rider who opens their home
    // stop every morning — so self-transitions must be counted there or that pattern can never be
    // learned. The staleness bound stops two views months apart from counting as adjacency.
    const crossesSession = previous !== null && previous.sessionId !== event.sessionId;
    const differentStop = previous !== null && previous.stopKey !== event.stopKey;
    const recentEnough = previous !== null && event.ts - previous.ts <= MAX_TRANSITION_GAP_MS;
    if (previous && recentEnough && (crossesSession || differentStop)) {
      let row = transitions.get(previous.stopKey);
      if (!row) {
        row = new Map<StopKey, number>();
        transitions.set(previous.stopKey, row);
      }
      row.set(event.stopKey, (row.get(event.stopKey) ?? 0) + 1);
    }
    previous = event;
  }

  const favoriteRank = new Map<StopKey, number>();
  favoriteKeys.forEach((key, index) => favoriteRank.set(key, index));

  return { byStop, transitions, favoriteRank, favoriteCount: favoriteKeys.length };
}

/**
 * Beyond this, two consecutive views are not a transition — they are just the two nearest points in
 * a sparse log. A week keeps weekday-to-weekday and across-the-weekend pairs while excluding the
 * months-apart ones.
 */
const MAX_TRANSITION_GAP_MS = 7 * MS_PER_DAY;

/** ±90 minutes, circular. Wide enough to survive a rider who is not punctual. */
const TIME_AFFINITY_WINDOW_MIN = 90;

/**
 * Affinity is a ratio, and a ratio over one observation is 1.0 — a stop glanced at exactly once is
 * trivially "always viewed at this time, on this day". Smoothing toward the base rate makes thin
 * evidence read as weak rather than perfect, which is what it is. `k` is the number of pseudo-counts
 * at the base rate; 3 means a stop needs a handful of real views before its affinity moves much.
 */
const AFFINITY_SMOOTHING = 3;
/** Share of the day inside a ±90-minute window, and of the week inside one weekday. */
const TIME_WINDOW_BASE_RATE = (2 * TIME_AFFINITY_WINDOW_MIN) / MINUTES_PER_DAY;
const DOW_BASE_RATE = 1 / 7;

function smoothedRate(hits: number, total: number, baseRate: number): number {
  return (hits + AFFINITY_SMOOTHING * baseRate) / (total + AFFINITY_SMOOTHING);
}

export function candidateFeatures(
  stopKey: StopKey,
  context: PredictionContext,
  history: HistoryIndex,
  /** Rank of this candidate's distance among all candidates, in [0, 1]; 0.5 when unknown. */
  distanceRankNorm: number
): CandidateFeatures {
  const events = history.byStop.get(stopKey) ?? [];
  const timestamps = events.map(event => event.ts);
  const now = context.ts;
  const { minuteOfDay, dayOfWeek } = localParts(context);

  const recency7d = decayedCount(timestamps, now, 7 * MS_PER_DAY);
  const recency1d = decayedCount(timestamps, now, MS_PER_DAY);
  const viewCount = events.length;

  const lastTs = timestamps.length ? timestamps[timestamps.length - 1] : null;
  const hoursSinceLastView = lastTs === null ? null : (now - lastTs) / MS_PER_HOUR;

  let inTimeWindow = 0;
  let sameDow = 0;
  for (const event of events) {
    const parts = localParts(event);
    if (circularDistance(parts.minuteOfDay, minuteOfDay, MINUTES_PER_DAY) <= TIME_AFFINITY_WINDOW_MIN) {
      inTimeWindow++;
    }
    if (parts.dayOfWeek === dayOfWeek) {
      sameDow++;
    }
  }
  const timeAffinity = viewCount ? smoothedRate(inTimeWindow, viewCount, TIME_WINDOW_BASE_RATE) : 0;
  const dowAffinity = viewCount ? smoothedRate(sameDow, viewCount, DOW_BASE_RATE) : 0;

  let markovProb = 0;
  if (context.previousStopKey) {
    const row = history.transitions.get(context.previousStopKey);
    if (row) {
      let total = 0;
      for (const count of row.values()) {
        total += count;
      }
      markovProb = total ? (row.get(stopKey) ?? 0) / total : 0;
    }
  }

  const rank = history.favoriteRank.get(stopKey);
  const isFavorite = rank !== undefined;
  // Rank 0 (top of the list) scores 1; the bottom of the list scores near 0.
  const favoriteRankNorm = rank === undefined || history.favoriteCount <= 1
    ? (isFavorite ? 1 : 0)
    : 1 - rank / (history.favoriteCount - 1);

  const distanceFeet = distanceTo(stopKey, context, history);

  const named: NamedFeatures = {
    names: [
      'log_recency_7d', 'log_recency_1d', 'log_view_count', 'log_hours_since_view',
      'view_recorded', 'time_affinity', 'dow_affinity', 'markov_prob',
      'is_favorite', 'favorite_rank_norm',
      'log_distance_ft', 'distance_known', 'distance_rank_norm',
      'is_train'
    ],
    values: [
      Math.log1p(recency7d),
      Math.log1p(recency1d),
      Math.log1p(viewCount),
      Math.log1p(hoursSinceLastView ?? 0),
      hoursSinceLastView === null ? 0 : 1,
      timeAffinity,
      dowAffinity,
      markovProb,
      isFavorite ? 1 : 0,
      favoriteRankNorm,
      Math.log1p(distanceFeet ?? 0),
      distanceFeet === null ? 0 : 1,
      distanceRankNorm,
      stopKey.startsWith('train:') ? 1 : 0
    ]
  };

  return {
    stopKey,
    named,
    recency7d,
    recency1d,
    viewCount,
    hoursSinceLastView,
    timeAffinity,
    dowAffinity,
    markovProb,
    isFavorite,
    favoriteRankNorm,
    distanceFeet
  };
}

/**
 * Straight-line distance from the user to a candidate stop, or null when either end is unknown.
 *
 * Reuses `haversineFeet` from services/distance.ts rather than adding a second copy of the same
 * spherical math. The stop's coordinates come from the most recent event that carried them — they
 * are denormalized into every event precisely so this lookup never has to hit a cache that Clear
 * Cache may have emptied.
 */
export function distanceTo(
  stopKey: StopKey,
  context: PredictionContext,
  history: HistoryIndex
): number | null {
  if (context.userLat === null || context.userLon === null) {
    return null;
  }
  const events = history.byStop.get(stopKey);
  if (!events) {
    return null;
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const { stopLat, stopLon } = events[i];
    if (stopLat !== null && stopLon !== null) {
      const feet = haversineFeet(context.userLat, context.userLon, stopLat, stopLon);
      return Number.isFinite(feet) ? feet : null;
    }
  }
  return null;
}

/**
 * Ranks candidates by distance and normalizes to [0, 1], nearest = 0.
 *
 * The rank is more useful to a linear model than raw feet: what predicts the next stop is "this is
 * the closest one to me", and that holds whether the nearest stop is 200 ft or two miles away.
 * Unknown distances sit at 0.5 so they neither attract nor repel.
 */
export function distanceRanks(
  stopKeys: StopKey[],
  context: PredictionContext,
  history: HistoryIndex
): Map<StopKey, number> {
  const measured: Array<{ stopKey: StopKey; feet: number }> = [];
  for (const stopKey of stopKeys) {
    const feet = distanceTo(stopKey, context, history);
    if (feet !== null) {
      measured.push({ stopKey, feet });
    }
  }
  measured.sort((a, b) => a.feet - b.feet);

  const ranks = new Map<StopKey, number>();
  for (const stopKey of stopKeys) {
    ranks.set(stopKey, 0.5);
  }
  const denominator = Math.max(1, measured.length - 1);
  measured.forEach((entry, index) => ranks.set(entry.stopKey, index / denominator));
  return ranks;
}
