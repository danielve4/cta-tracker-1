// The heuristic scorer: a hand-weighted linear combination of the derived features.
//
// It is deliberately the simplest thing that could work, and it has three jobs:
//
//  1. It ships. Users get suggestions now instead of after a model exists.
//  2. It is the number to beat. "Our model gets 61% top-1" is meaningless without a baseline;
//     against most-recently-used and against this, it means something.
//  3. It is the same functional form a logistic regression learns. Replacing it later is swapping
//     this weight object for a trained one and adding an update step — not a rewrite.
//
// Anything non-linear (a random forest via ml-random-forest, say) would slot in at the same seam.

import { CandidateFeatures } from './features';
import { StopKey } from './stop-view-event';

export const SCORER_VERSION = 'heuristic-1';

/**
 * All inputs are squashed to roughly [0, 1] before weighting so these read as relative importance.
 * Distance is the only negative: being far away is evidence against, and it is the one feature
 * that can override a strong habit (you do not check your usual morning stop from another
 * neighborhood).
 */
export const BASELINE_WEIGHTS = {
  recency7d: 1.0,
  timeAffinity: 0.8,
  markovProb: 0.6,
  dowAffinity: 0.5,
  favorite: 0.5,
  viewCount: 0.4,
  distanceRank: -0.7
} as const;

/** Maps an unbounded non-negative count into [0, 1) without a hard ceiling. */
function squash(value: number): number {
  return value / (1 + value);
}

export interface ScoredCandidate {
  stopKey: StopKey;
  score: number;
}

export function scoreCandidate(features: CandidateFeatures, distanceRankNorm: number): number {
  const w = BASELINE_WEIGHTS;
  return (
    w.recency7d * squash(features.recency7d) +
    w.timeAffinity * features.timeAffinity +
    w.markovProb * features.markovProb +
    w.dowAffinity * features.dowAffinity +
    w.favorite * (features.isFavorite ? features.favoriteRankNorm : 0) +
    w.viewCount * squash(features.viewCount / 5) +
    w.distanceRank * distanceRankNorm
  );
}

export function rankCandidates(
  scored: Array<{ features: CandidateFeatures; distanceRankNorm: number }>
): ScoredCandidate[] {
  return scored
    .map(({ features, distanceRankNorm }) => ({
      stopKey: features.stopKey,
      score: scoreCandidate(features, distanceRankNorm)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Below this the suggestion is not worth the screen space — a stop the user glanced at once three
 * weeks ago scores well above zero simply for existing, and offering it is worse than offering
 * nothing.
 */
export const MIN_CONFIDENT_SCORE = 0.45;

/** Fewer events than this and the history is too thin for any of the features to mean anything. */
export const MIN_EVENTS_FOR_SUGGESTION = 10;
