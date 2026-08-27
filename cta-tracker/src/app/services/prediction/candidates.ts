// Candidate set construction and offline training-example extraction.
//
// The prediction is a ranking over stops the user has actually used, not a classification over
// every stop in Chicago. That keeps the arm count in the low tens, which is what makes a linear
// model the right size for this problem.

import { EntrySource, StopKey, StopViewEvent } from './stop-view-event';

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
 * Entries the app produced rather than the user: a restore into a saved route, a document reload
 * onto a stop page, or a tap on our own suggestion. None of them is a choice, and the last one is
 * actively circular — training on it teaches the model that its own past guesses were right.
 */
const APP_DRIVEN = new Set<EntrySource>(['restored', 'reload', 'suggestion']);

export function isUserDriven(entry: EntrySource): boolean {
  return !APP_DRIVEN.has(entry);
}

/**
 * Extracts supervised examples for offline experimentation.
 *
 * An example is the stop a user *chose* first in a session that followed a gap of at least `gapMs`,
 * which is the situation the shipped predictor fires in. `gapMs` is a parameter rather than a
 * constant because the log stores the raw gap: whether the useful threshold is one hour or three is
 * a question to answer from data, not to guess now.
 *
 * "Chose first" is deliberately not `seqInSession === 0`. When LS_SAVED_ROUTE points at a stop page
 * the restore takes seq 0, so excluding app-driven views *and* requiring seq 0 would discard the
 * whole session — the real label along with the fake one, on what is the dominant PWA launch path.
 * Instead this skips over any leading app-driven views and takes the first genuine one.
 *
 * Requires `events` to be in chronological order, as the ts index returns them.
 */
export function extractTrainingExamples(
  events: StopViewEvent[],
  gapMs: number,
  favoriteKeys: StopKey[] = []
): TrainingExample[] {
  const examples: TrainingExample[] = [];
  const claimed = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (claimed.has(event.sessionId) || !isUserDriven(event.entry)) {
      continue;
    }
    // First user-driven view of this session. Whether or not it qualifies below, the session has
    // had its chance — a later view is a follow-up, not the opening choice.
    claimed.add(event.sessionId);

    if (event.msSinceLastAppOpen === null || event.msSinceLastAppOpen < gapMs) continue;

    const history = events.slice(0, i);
    if (!history.length) continue;

    const candidates = buildCandidates(history, favoriteKeys, event.ts).map(c => c.stopKey);
    if (candidates.length < 2) continue;

    examples.push({ context: event, label: event.stopKey, history, candidates });
  }
  return examples;
}
