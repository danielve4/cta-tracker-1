import { describe, expect, it } from 'vitest';
import {
  AUTO_OPEN_MARGIN, MIN_AUTO_OPEN_SCORE, ROUTINE_TIME_AFFINITY, UNUSUAL_TIME_AFFINITY,
  didYouMean, parseSuggestionMode, pickAutoOpen
} from './auto-open';
import { MIN_CONFIDENT_SCORE, ScoredCandidate, rankCandidates } from './baseline-scorer';
import { buildCandidates } from './candidates';
import { CandidateFeatures, PredictionContext, buildHistoryIndex, candidateFeatures } from './features';
import { StopKey, StopViewEvent } from './stop-view-event';
import { DAY, HOUR, evt, sorted } from './test-fixtures';

/** 8:00 UTC, with tzOffsetMin 0 throughout, so this is also local time. */
const MORNING = Date.UTC(2026, 4, 20, 8, 0, 0);

function scored(...entries: Array<[StopKey, number]>): ScoredCandidate[] {
  return entries.map(([stopKey, score]) => ({ stopKey, score }));
}

/** One view a day for `days` days, at `hourOfDay`, ending the day before `now`. */
function daily(now: number, stopKey: StopKey, days: number, hourOfDay: number): StopViewEvent[] {
  const midnight = now - (now % DAY);
  return Array.from({ length: days }, (_, i) => evt({
    ts: midnight - (days - i) * DAY + hourOfDay * HOUR,
    stopKey,
    sessionId: `${stopKey}-${i}`
  }));
}

/** Ranks `events` the way PredictorService does, returning what `didYouMean` takes. */
function rankAt(now: number, events: StopViewEvent[]) {
  const context: PredictionContext = {
    ts: now, tzOffsetMin: 0, msSinceLastAppOpen: 3 * HOUR, userLat: null, userLon: null,
    launchedStandalone: false, previousStopKey: null
  };
  const index = buildHistoryIndex(events, []);
  const features = new Map<StopKey, CandidateFeatures>(buildCandidates(events, [], now).map(candidate =>
    [candidate.stopKey, candidateFeatures(candidate.stopKey, context, index, 0.5)]));
  const ranked = rankCandidates([...features.values()].map(f => ({ features: f, distanceRankNorm: 0.5 })));
  return { ranked, featuresOf: (stopKey: StopKey) => features.get(stopKey) };
}

describe('pickAutoOpen', () => {
  it('opens a decisive top pick', () => {
    expect(pickAutoOpen(scored(['bus:1', 2.2], ['bus:2', 1.6]))).toBe('bus:1');
  });

  it('never auto-opens a near-tie, however high both score', () => {
    expect(pickAutoOpen(scored(['bus:1', 2.3], ['bus:2', 2.3 - AUTO_OPEN_MARGIN + 0.01]))).toBeNull();
  });

  it('opens just past the margin', () => {
    expect(pickAutoOpen(scored(['bus:1', 2], ['bus:2', 2 - AUTO_OPEN_MARGIN - 0.01]))).toBe('bus:1');
  });

  it('holds a higher bar than the chip', () => {
    expect(MIN_AUTO_OPEN_SCORE).toBeGreaterThan(MIN_CONFIDENT_SCORE);
    // Clears the chip, leads by a mile, and still does not open: the history is too thin to act on.
    expect(pickAutoOpen(scored(['bus:1', MIN_AUTO_OPEN_SCORE - 0.01], ['bus:2', 0]))).toBeNull();
  });

  it('opens the only candidate when it clears the bar', () => {
    expect(pickAutoOpen(scored(['bus:1', MIN_AUTO_OPEN_SCORE]))).toBe('bus:1');
  });

  it('opens nothing from an empty ranking', () => {
    expect(pickAutoOpen([])).toBeNull();
  });
});

describe('didYouMean', () => {
  // A morning stop and an evening stop, each checked every day for two weeks.
  const log = sorted(daily(MORNING, 'bus:1001', 14, 8), daily(MORNING, 'bus:1002', 14, 18));

  it('asks about the morning stop when the evening one is opened in the morning', () => {
    const { ranked, featuresOf } = rankAt(MORNING, log);
    expect(didYouMean(featuresOf('bus:1002'), ranked, featuresOf)).toBe('bus:1001');
  });

  it('stays quiet when the stop on screen is the routine one', () => {
    const { ranked, featuresOf } = rankAt(MORNING, log);
    expect(didYouMean(featuresOf('bus:1001'), ranked, featuresOf)).toBeNull();
  });

  it('stays quiet at a time of day with no routine to point to', () => {
    const midday = MORNING + 5 * HOUR;
    const { ranked, featuresOf } = rankAt(midday, log);
    expect(didYouMean(featuresOf('bus:1002'), ranked, featuresOf)).toBeNull();
  });

  it('treats a stop with no history as deliberate', () => {
    const { ranked, featuresOf } = rankAt(MORNING, log);
    expect(didYouMean(featuresOf('bus:9999'), ranked, featuresOf)).toBeNull();
  });

  it('stays quiet about a stop the user does sometimes check at this time', () => {
    // The evening stop, but with a real share of morning views as well.
    const mixed = sorted(log, daily(MORNING, 'bus:1002', 6, 8).map(e => ({ ...e, sessionId: `m${e.ts}` })));
    const { ranked, featuresOf } = rankAt(MORNING, mixed);
    expect(featuresOf('bus:1002')!.timeAffinity).toBeGreaterThan(UNUSUAL_TIME_AFFINITY);
    expect(didYouMean(featuresOf('bus:1002'), ranked, featuresOf)).toBeNull();
  });

  it('keeps its two affinity bars on opposite sides of the base rate', () => {
    // The window's base rate is 180/1440 = 0.125: "unusual" has to admit a stop with no views in the
    // window, and "routine" has to demand far more than chance.
    expect(UNUSUAL_TIME_AFFINITY).toBeGreaterThan(0.125);
    expect(ROUTINE_TIME_AFFINITY).toBeGreaterThan(3 * UNUSUAL_TIME_AFFINITY);
  });
});

describe('parseSuggestionMode', () => {
  it('reads both modes and defaults anything else to the chip', () => {
    expect(parseSuggestionMode('auto')).toBe('auto');
    expect(parseSuggestionMode('suggest')).toBe('suggest');
    expect(parseSuggestionMode(null)).toBe('suggest');
    expect(parseSuggestionMode('autopilot')).toBe('suggest');
  });
});
