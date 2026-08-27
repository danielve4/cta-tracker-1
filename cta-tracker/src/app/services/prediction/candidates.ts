// Candidate set construction and offline training-example extraction.
//
// The prediction is a ranking over stops the user has actually used, not a classification over
// every stop in Chicago. That keeps the arm count in the low tens, which is what makes a linear
// model the right size for this problem.

import { StopKey, StopViewEvent } from './stop-view-event';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CANDIDATE_WINDOW_MS = 90 * MS_PER_DAY;

export interface Candidate {
  stopKey: StopKey;
  /** The most recent event for this stop, carrying the fields needed to rebuild its deep link. */
  latest: StopViewEvent;
}

/**
 * Every stop seen in the last 90 days, plus every current favorite regardless of age — a stop the
 * user deliberately saved is a plausible destination even if the log has aged out its last view.
 * Ordered most-recently-seen first so callers have a deterministic tie-break.
 */
export function buildCandidates(
  events: StopViewEvent[],
  favoriteKeys: StopKey[],
  now = Date.now()
): Candidate[] {
  const latestByStop = new Map<StopKey, StopViewEvent>();
  for (const event of events) {
    latestByStop.set(event.stopKey, event);
  }

  const cutoff = now - CANDIDATE_WINDOW_MS;
  const favorites = new Set<StopKey>(favoriteKeys);
  const candidates: Candidate[] = [];
  for (const [stopKey, latest] of latestByStop) {
    if (latest.ts >= cutoff || favorites.has(stopKey)) {
      candidates.push({ stopKey, latest });
    }
  }
  candidates.sort((a, b) => b.latest.ts - a.latest.ts);
  return candidates;
}

/** Most-recently-used: the trivial predictor every real one has to beat. */
export function mostRecentlyUsed(events: StopViewEvent[]): StopKey | null {
  return events.length ? events[events.length - 1].stopKey : null;
}

export interface TrainingExample {
  context: StopViewEvent;
  /** The stop actually opened — the positive label. */
  label: StopKey;
  /** Everything the log knew strictly before `context.ts`. Never include the event itself. */
  history: StopViewEvent[];
  candidates: StopKey[];
}

/**
 * Extracts supervised examples for offline experimentation.
 *
 * An example is the *first* stop view of a session that followed a gap of at least `gapMs`, which
 * is the exact situation the shipped predictor fires in. `gapMs` is a parameter rather than a
 * constant because the log stores the raw gap: whether the useful threshold is one hour or three is
 * a question to answer from data, not to guess now.
 *
 * Two exclusions keep the labels honest:
 * - `entry: 'suggestion'` — the model caused that view, so training on it is self-confirmation.
 * - `entry: 'restored'` — AppComponent's LS_SAVED_ROUTE navigation opened that stop, not the user.
 */
export function extractTrainingExamples(
  events: StopViewEvent[],
  gapMs: number,
  favoriteKeys: StopKey[] = []
): TrainingExample[] {
  const examples: TrainingExample[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.seqInSession !== 0) continue;
    if (event.msSinceLastAppOpen === null || event.msSinceLastAppOpen < gapMs) continue;
    if (event.entry === 'suggestion' || event.entry === 'restored') continue;

    const history = events.slice(0, i);
    if (!history.length) continue;

    const candidates = buildCandidates(history, favoriteKeys, event.ts).map(c => c.stopKey);
    if (candidates.length < 2) continue;

    examples.push({ context: event, label: event.stopKey, history, candidates });
  }
  return examples;
}
