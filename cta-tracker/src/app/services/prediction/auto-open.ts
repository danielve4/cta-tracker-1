// The two decisions layered on top of the ranking: whether to open the top stop without asking, and
// whether the stop on screen looks like a mistake worth questioning.
//
// Both are plain functions over the scorer's output so they can be tested without Angular, and both
// are deliberately stricter than the chip. A chip that is wrong costs a glance; opening the wrong
// stop costs a back-tap and some trust, and a "did you mean" on a stop the user chose on purpose is
// a nag. Each bar below was set by replaying `real-world-log.spec.ts`, and `auto-open.spec.ts` pins
// what that replay showed.

import { MIN_CONFIDENT_SCORE, ScoredCandidate } from './baseline-scorer';
import { CandidateFeatures } from './features';
import { StopKey } from './stop-view-event';

/** What happens on a cold start: the "Heading to your usual stop?" chip, or opening it outright. */
export type SuggestionMode = 'suggest' | 'auto';

export const DEFAULT_SUGGESTION_MODE: SuggestionMode = 'suggest';

/** The options the Settings picker offers, in order. */
export const SUGGESTION_MODES: ReadonlyArray<{ id: SuggestionMode; title: string; blurb: string }> = [
  { id: 'suggest', title: 'Suggest', blurb: 'Offer your usual stop at the top of Routes and Favorites.' },
  { id: 'auto', title: 'Open automatically', blurb: 'Go straight to it when the app is confident.' }
];

/** Falls back to the default for anything a build no longer offers, like `parseArrivalsLayout`. */
export function parseSuggestionMode(raw: string | null): SuggestionMode {
  return SUGGESTION_MODES.some(mode => mode.id === raw) ? raw as SuggestionMode : DEFAULT_SUGGESTION_MODE;
}

/**
 * Above the chip's floor, because being wrong here costs more than a glance. Real top scores sit
 * around 2.1-2.3 against the chip's 0.80, so the floor alone filters almost nothing; it is here to
 * keep a thin history (a handful of views, all weak) from ever auto-opening.
 */
export const MIN_AUTO_OPEN_SCORE = 1.5;

/**
 * The lead the top stop needs over the runner-up. This is the bar that does the work: in the
 * replayed log, the two launches the ranking got wrong because two stops were a near-tie led by
 * 0.36, and the ones it got right led by 0.50 and 0.67. A near-tie should fall back to the chip,
 * which can show both.
 */
export const AUTO_OPEN_MARGIN = 0.4;

/** The stop to open without asking, or null when the ranking is not decisive enough to. */
export function pickAutoOpen(ranked: ScoredCandidate[]): StopKey | null {
  const [top, runnerUp] = ranked;
  if (!top || top.score < MIN_AUTO_OPEN_SCORE) {
    return null;
  }
  if (runnerUp && top.score - runnerUp.score < AUTO_OPEN_MARGIN) {
    return null;
  }
  return top.stopKey;
}

/**
 * At or below this, the stop on screen is "not one you usually view at this time". The smoothed
 * affinity of a stop never viewed within ±90 minutes of now is at most the window's base rate of
 * 0.125, so this admits that case plus one stray view among several, and nothing like a habit.
 */
export const UNUSUAL_TIME_AFFINITY = 0.15;

/**
 * At or above this, the alternative really is a time-of-day routine, not merely the stop that
 * scored highest. Without it the chip fired in the replay on a launch whose top stop had no
 * time-of-day pattern at all (affinity 0.04) and ranked first on recency alone, which amounts to
 * asking "did you mean the last stop you looked at?".
 */
export const ROUTINE_TIME_AFFINITY = 0.5;

/**
 * The stop to ask "did you mean…?" about, or null when the one on screen is plausible.
 *
 * `viewed` is undefined when the stop on screen has no history at all. That is treated as
 * deliberate rather than suspicious: a stop the user has never opened was reached by browsing to it
 * or following a new link, not by a mis-tap on a list of familiar ones, and it is the case the
 * replay caught the chip getting wrong.
 */
export function didYouMean(
  viewed: CandidateFeatures | undefined,
  ranked: ScoredCandidate[],
  featuresOf: (stopKey: StopKey) => CandidateFeatures | undefined
): StopKey | null {
  const [top] = ranked;
  if (!viewed || !top || top.stopKey === viewed.stopKey || top.score < MIN_CONFIDENT_SCORE) {
    return null;
  }
  if (viewed.timeAffinity > UNUSUAL_TIME_AFFINITY) {
    return null;
  }
  const routine = featuresOf(top.stopKey);
  return routine && routine.timeAffinity >= ROUTINE_TIME_AFFINITY ? top.stopKey : null;
}
