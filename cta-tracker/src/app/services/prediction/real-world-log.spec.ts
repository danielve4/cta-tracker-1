// Regression cover for the bug that kept the suggestion from ever appearing.
//
// The synthetic specs alongside this one each exercise a single function with a shape chosen to
// make that function's behaviour obvious. None of them caught this: the ranking was working the
// whole time, and what failed was the arrangement of gates around it. So this replays the shape of
// a real exported log — the session boundaries, inter-session gaps, entry sources and favorite
// order taken from an actual device — and asserts on the outcome a user would have seen.
//
// The stop identifiers and the absolute dates are anonymized. A commute log names where somebody
// lives and works, which is not something to commit to a repository, and pinning a fixture to real
// 2026 timestamps would make it rot. Nothing the assertions depend on is lost: only the gaps
// between events, their order and their entry sources feed the features under test.

import { describe, expect, it } from 'vitest';
import { MIN_CONFIDENT_SCORE, MIN_EVENTS_FOR_SUGGESTION, rankCandidates } from './baseline-scorer';
import { buildCandidates, isUserDriven, mostRecentlyUsed } from './candidates';
import { PredictionContext, buildHistoryIndex, candidateFeatures, distanceRanks } from './features';
import { COLD_START_GAP_MS, SessionState } from './session-state';
import { EntrySource, StopKey, StopViewEvent } from './stop-view-event';
import { memoryStorage } from './test-fixtures';

const BASE = Date.UTC(2026, 0, 5, 14, 0, 0);
const FAVORITES: StopKey[] = ['train:A', 'train:B', 'bus:F', 'train:G'];

function ev(
  offsetSec: number,
  stopKey: StopKey,
  sessionId: string,
  entry: EntrySource,
  gapSec: number
): StopViewEvent {
  const [kind, stopId] = stopKey.split(':') as ['bus' | 'train', string];
  const rank = FAVORITES.indexOf(stopKey);
  return {
    v: 2,
    ts: BASE + offsetSec * 1000,
    tzOffsetMin: 300,
    sessionId,
    seqInSession: 0,
    msSincePrevEvent: null,
    msSinceLastAppOpen: gapSec * 1000,
    stopKey,
    kind,
    stopId,
    stopName: stopKey,
    route: stopId,
    direction: '',
    stopLat: null,
    stopLon: null,
    entry,
    navigationType: 'navigate',
    fromUrl: null,
    isFavorite: rank >= 0,
    favoriteRank: rank >= 0 ? rank : null,
    userLat: null,
    userLon: null,
    userAccuracyM: null,
    userPosAgeMs: null,
    // Location is opt-in and was never enabled on the device this came from, which is the case
    // that matters: it is the default every user is in.
    locSource: 'off',
    dwellMs: null,
    refreshCount: 0,
    launchedStandalone: true
  };
}

/** Nine launches over roughly five days: two favorited train stops, a browse session, a bus habit. */
const LOG: StopViewEvent[] = [
  ev(0, 'train:A', 's1', 'favorites', 6134),
  ev(326, 'train:A', 's1', 'favorites', 6134),
  ev(518, 'train:A', 's1', 'follow', 6134),
  ev(524, 'train:A', 's1', 'favorites', 6134),
  ev(31525, 'train:B', 's2', 'favorites', 10122),
  ev(31543, 'train:B', 's2', 'favorites', 10122),
  ev(35516, 'train:B', 's3', 'favorites', 2654),
  ev(86339, 'train:A', 's4', 'favorites', 50038),
  ev(86447, 'train:A', 's4', 'follow', 50038),
  ev(86459, 'train:A', 's4', 'favorites', 50038),
  ev(113877, 'train:B', 's5', 'favorites', 26356),
  ev(131680, 'train:B', 's6', 'restored', 17715),
  ev(131695, 'bus:C', 's6', 'browse', 17715),
  ev(133143, 'bus:D', 's6', 'browse', 17715),
  ev(133351, 'bus:D', 's6', 'follow', 17715),
  ev(133357, 'bus:E', 's6', 'browse', 17715),
  ev(260716, 'bus:F', 's7', 'favorites', 125846),
  ev(261055, 'bus:F', 's7', 'follow', 125846),
  ev(261228, 'bus:F', 's7', 'follow', 125846),
  ev(261244, 'bus:F', 's7', 'follow', 125846),
  ev(263099, 'train:G', 's7', 'favorites', 125846),
  ev(263110, 'train:G', 's7', 'follow', 125846),
  ev(263112, 'train:G', 's7', 'follow', 125846),
  ev(263127, 'train:G', 's7', 'favorites', 125846),
  ev(432874, 'train:A', 's8', 'favorites', 168773),
  ev(463419, 'train:B', 's9', 'favorites', 29680),
  ev(464158, 'train:B', 's9', 'favorites', 29680)
];

interface Replay {
  sessionId: string;
  actual: StopKey;
  topStopKey: StopKey;
  topScore: number;
  mru: StopKey | null;
}

/** Ranks each session's opening choice using only what the log knew strictly before it. */
function replayEligibleSessions(): Replay[] {
  const results: Replay[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < LOG.length; i++) {
    const event = LOG[i];
    if (seen.has(event.sessionId)) continue;
    seen.add(event.sessionId);

    const history = LOG.slice(0, i);
    const gap = event.msSinceLastAppOpen;
    if (gap === null || gap < COLD_START_GAP_MS) continue;
    if (history.length < MIN_EVENTS_FOR_SUGGESTION) continue;

    const candidates = buildCandidates(history, FAVORITES, event.ts);
    if (candidates.length < 2) continue;

    const context: PredictionContext = {
      ts: event.ts,
      tzOffsetMin: event.tzOffsetMin,
      msSinceLastAppOpen: gap,
      userLat: null,
      userLon: null,
      launchedStandalone: true,
      previousStopKey: mostRecentlyUsed(history)
    };
    const index = buildHistoryIndex(history, FAVORITES);
    const keys = candidates.map(candidate => candidate.stopKey);
    const ranks = distanceRanks(keys, context, index);
    const [top] = rankCandidates(keys.map(stopKey => ({
      features: candidateFeatures(stopKey, context, index, ranks.get(stopKey) ?? 0.5),
      distanceRankNorm: ranks.get(stopKey) ?? 0.5
    })));

    results.push({
      sessionId: event.sessionId,
      actual: event.stopKey,
      topStopKey: top.stopKey,
      topScore: top.score,
      mru: mostRecentlyUsed(history)
    });
  }
  return results;
}

describe('replaying a real exported log', () => {
  it('reaches the ranking on the launches the feature is meant for', () => {
    // Five of the nine sessions clear every gate. Before the fix all five still showed nothing,
    // because the chip only existed on a screen this user never landed on — which is exactly why
    // the failure was invisible to the unit specs.
    const replays = replayEligibleSessions();
    expect(replays.map(replay => replay.sessionId)).toEqual(['s5', 's6', 's7', 's8', 's9']);
  });

  it('scores its top pick above the confidence floor every time', () => {
    // The floor was a suspect while this was being diagnosed. It is not: real scores clear it with
    // room to spare, and this pins that down so a future weight change cannot quietly re-introduce
    // a floor that never fires.
    for (const replay of replayEligibleSessions()) {
      expect(replay.topScore).toBeGreaterThan(MIN_CONFIDENT_SCORE);
    }
  });

  it('beats the most-recently-used floor it has to justify itself against', () => {
    const replays = replayEligibleSessions();
    const heuristic = replays.filter(replay => replay.topStopKey === replay.actual).length;
    const mru = replays.filter(replay => replay.mru === replay.actual).length;

    expect(heuristic).toBeGreaterThan(mru);
    // Stated absolutely as well: a ratio holds just as well if both collapse to zero.
    expect(heuristic).toBe(3);
    expect(mru).toBe(1);
  });
});

describe('the restore that used to suppress the whole launch', () => {
  // Session s6 opens with entry 'restored': LS_SAVED_ROUTE put the user on a stop page before they
  // chose anything. That view is real and stays in the log, but it is not a choice.
  const restored = LOG.find(event => event.entry === 'restored')!;

  it('does not count an app-driven view as the user having picked a stop', () => {
    const session = new SessionState(memoryStorage());
    session.start();

    session.takeSeq(isUserDriven(restored.entry));

    expect(session.hasViewedStop()).toBe(false);
  });

  it('still counts the stop the user picks next', () => {
    const session = new SessionState(memoryStorage());
    session.start();

    session.takeSeq(isUserDriven('restored'));
    session.takeSeq(isUserDriven('browse'));

    expect(session.hasViewedStop()).toBe(true);
  });

  it('keeps the sequence numbers contiguous across both kinds', () => {
    // The log has to stay a faithful record of the session even though the gate ignores part of it.
    const session = new SessionState(memoryStorage());
    session.start();

    expect(session.takeSeq(isUserDriven('restored'))).toBe(0);
    expect(session.takeSeq(isUserDriven('browse'))).toBe(1);
  });
});
