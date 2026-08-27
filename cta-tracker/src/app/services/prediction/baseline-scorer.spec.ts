import { describe, expect, it } from 'vitest';
import { MIN_CONFIDENT_SCORE, rankCandidates, scoreCandidate } from './baseline-scorer';
import { buildHistoryIndex, candidateFeatures, PredictionContext } from './features';
import { DAY, HOUR, evt } from './test-fixtures';
import { StopKey } from './stop-view-event';

const NOW = Date.UTC(2026, 4, 20, 8, 30, 0);

const context = (overrides: Partial<PredictionContext> = {}): PredictionContext => ({
  ts: NOW,
  tzOffsetMin: 0,
  msSinceLastAppOpen: 3 * HOUR,
  userLat: null,
  userLon: null,
  launchedStandalone: false,
  previousStopKey: null,
  ...overrides
});

const featuresFor = (stopKey: StopKey, events = [] as ReturnType<typeof evt>[], favorites: StopKey[] = []) =>
  candidateFeatures(stopKey, context(), buildHistoryIndex(events, favorites), 0.5);

describe('scoreCandidate', () => {
  it('prefers the stop viewed more often and more recently', () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => evt({ ts: NOW - (i + 1) * DAY, stopKey: 'bus:1001', sessionId: `a${i}` })),
      evt({ ts: NOW - 60 * DAY, stopKey: 'bus:1002', sessionId: 'b' })
    ].sort((a, b) => a.ts - b.ts);
    const index = buildHistoryIndex(events, []);

    const strong = scoreCandidate(candidateFeatures('bus:1001', context(), index, 0.5), 0.5);
    const weak = scoreCandidate(candidateFeatures('bus:1002', context(), index, 0.5), 0.5);
    expect(strong).toBeGreaterThan(weak);
  });

  it('treats distance as the only penalty', () => {
    const features = featuresFor('bus:1001', [evt({ ts: NOW - DAY, stopKey: 'bus:1001' })]);
    expect(scoreCandidate(features, 1)).toBeLessThan(scoreCandidate(features, 0));
  });

  it('gives a never-seen stop a lower score than a familiar one', () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      evt({ ts: NOW - (i + 1) * DAY, stopKey: 'bus:1001', sessionId: `a${i}` })).sort((a, b) => a.ts - b.ts);
    const index = buildHistoryIndex(events, []);
    expect(scoreCandidate(candidateFeatures('bus:9999', context(), index, 0.5), 0.5))
      .toBeLessThan(scoreCandidate(candidateFeatures('bus:1001', context(), index, 0.5), 0.5));
  });

  it('always produces a finite score, even with no history at all', () => {
    expect(Number.isFinite(scoreCandidate(featuresFor('bus:1001'), 0.5))).toBe(true);
  });
});

describe('rankCandidates', () => {
  it('returns candidates ordered best first', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => evt({ ts: NOW - (i + 1) * DAY, stopKey: 'bus:1001', sessionId: `a${i}` })),
      evt({ ts: NOW - 40 * DAY, stopKey: 'bus:1002', sessionId: 'b' })
    ].sort((a, b) => a.ts - b.ts);
    const index = buildHistoryIndex(events, []);
    const ranked = rankCandidates((['bus:1001', 'bus:1002'] as StopKey[]).map(stopKey => ({
      features: candidateFeatures(stopKey, context(), index, 0.5),
      distanceRankNorm: 0.5
    })));

    expect(ranked.map(r => r.stopKey)).toEqual(['bus:1001', 'bus:1002']);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('is deterministic for the same inputs', () => {
    const events = [evt({ ts: NOW - DAY, stopKey: 'bus:1001' })];
    const index = buildHistoryIndex(events, []);
    const run = () => rankCandidates((['bus:1001', 'bus:1002'] as StopKey[]).map(stopKey => ({
      features: candidateFeatures(stopKey, context(), index, 0.5),
      distanceRankNorm: 0.5
    })));
    expect(run()).toEqual(run());
  });

  it('leaves a single stale view below the confidence floor', () => {
    // One glance three weeks ago should not be worth the screen space.
    const events = [evt({ ts: NOW - 21 * DAY, stopKey: 'bus:1001' })];
    const index = buildHistoryIndex(events, []);
    const [top] = rankCandidates([{
      features: candidateFeatures('bus:1001', context(), index, 0.5),
      distanceRankNorm: 0.5
    }]);
    expect(top.score).toBeLessThan(MIN_CONFIDENT_SCORE);
  });

  it('carries a daily habit above the confidence floor', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      evt({ ts: NOW - (i + 1) * DAY, stopKey: 'bus:1001', sessionId: `a${i}` })).sort((a, b) => a.ts - b.ts);
    const index = buildHistoryIndex(events, []);
    const [top] = rankCandidates([{
      features: candidateFeatures('bus:1001', context(), index, 0.5),
      distanceRankNorm: 0.5
    }]);
    expect(top.score).toBeGreaterThan(MIN_CONFIDENT_SCORE);
  });
});
