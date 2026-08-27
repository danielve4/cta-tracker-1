import { describe, expect, it } from 'vitest';
import {
  buildHistoryIndex, candidateFeatures, circularDistance, contextFeatures, cyclic,
  distanceRanks, localParts, partOfDay, PredictionContext
} from './features';
import { DAY, HOUR, evt, sorted } from './test-fixtures';

const NOW = Date.UTC(2026, 4, 20, 14, 0, 0);

function context(overrides: Partial<PredictionContext> = {}): PredictionContext {
  return {
    ts: NOW,
    tzOffsetMin: 0,
    msSinceLastAppOpen: 3 * HOUR,
    userLat: null,
    userLon: null,
    launchedStandalone: false,
    previousStopKey: null,
    ...overrides
  };
}

describe('localParts', () => {
  it('reads local wall-clock time from the offset stored on the event', () => {
    // 14:00 UTC at Chicago's CDT offset (UTC-5, so getTimezoneOffset() === 300) is 09:00 local.
    const parts = localParts({ ts: Date.UTC(2026, 4, 20, 14, 0), tzOffsetMin: 300 });
    expect(parts.minuteOfDay).toBe(9 * 60);
    expect(parts.dayOfWeek).toBe(3);
  });

  it('handles a negative offset (east of UTC)', () => {
    const parts = localParts({ ts: Date.UTC(2026, 4, 20, 14, 0), tzOffsetMin: -120 });
    expect(parts.minuteOfDay).toBe(16 * 60);
  });

  it('does not shift history recorded on the other side of a DST change', () => {
    // Both events are 08:30 local; only the offset differs, as it would across the March change.
    const winter = localParts({ ts: Date.UTC(2026, 0, 15, 14, 30), tzOffsetMin: 360 }); // CST
    const summer = localParts({ ts: Date.UTC(2026, 6, 15, 13, 30), tzOffsetMin: 300 }); // CDT
    expect(winter.minuteOfDay).toBe(8 * 60 + 30);
    expect(summer.minuteOfDay).toBe(8 * 60 + 30);
  });

  it('rolls the day backwards when the offset crosses midnight', () => {
    const parts = localParts({ ts: Date.UTC(2026, 4, 20, 2, 0), tzOffsetMin: 300 });
    expect(parts.minuteOfDay).toBe(21 * 60);
    expect(parts.dayOfWeek).toBe(2);
  });
});

describe('cyclic', () => {
  const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  it('places 23:59 and 00:01 next to each other', () => {
    const near = distance(cyclic(1439, 1440), cyclic(1, 1440));
    const far = distance(cyclic(1439, 1440), cyclic(720, 1440));
    expect(near).toBeLessThan(0.02);
    expect(far).toBeGreaterThan(1.9);
    expect(near).toBeLessThan(far);
  });

  it('emits two values per harmonic', () => {
    expect(cyclic(0, 1440, 1)).toHaveLength(2);
    expect(cyclic(0, 1440, 3)).toHaveLength(6);
  });

  it('separates the two daily rush peaks at the second harmonic', () => {
    // 08:00 and 17:00 are far apart on the fundamental, but the k=2 term brings them close —
    // that is the whole reason for going past one harmonic.
    const [, , am2cos, am2sin] = cyclic(8 * 60, 1440, 2);
    const [, , pm2cos, pm2sin] = cyclic(17 * 60, 1440, 2);
    const fundamental = distance(cyclic(8 * 60, 1440), cyclic(17 * 60, 1440));
    expect(distance([am2cos, am2sin], [pm2cos, pm2sin])).toBeLessThan(fundamental);
  });
});

describe('circularDistance', () => {
  it('wraps around the end of the cycle', () => {
    expect(circularDistance(1430, 10, 1440)).toBe(20);
    expect(circularDistance(10, 1430, 1440)).toBe(20);
    expect(circularDistance(0, 720, 1440)).toBe(720);
    expect(circularDistance(6, 1, 7)).toBe(2);
  });
});

describe('partOfDay', () => {
  it('buckets the CTA rush hours', () => {
    expect(partOfDay(3 * 60)).toBe('early');
    expect(partOfDay(8 * 60)).toBe('am-peak');
    expect(partOfDay(12 * 60)).toBe('midday');
    expect(partOfDay(17 * 60)).toBe('pm-peak');
    expect(partOfDay(22 * 60)).toBe('evening');
  });
});

describe('buildHistoryIndex transitions', () => {
  it('counts a stop repeating across sessions, which is the commute pattern', () => {
    // The rider opens the same home stop every morning. Within a session that is a refresh; across
    // sessions it is the single most predictive habit in this dataset and must be learnable.
    const events = [
      evt({ ts: NOW - 2 * DAY, stopKey: 'bus:1001', sessionId: 'a' }),
      evt({ ts: NOW - DAY, stopKey: 'bus:1001', sessionId: 'b' })
    ];
    const index = buildHistoryIndex(events, []);
    expect(index.transitions.get('bus:1001')?.get('bus:1001')).toBe(1);
  });

  it('ignores a repeat within one session, which is just a refresh', () => {
    const events = [
      evt({ ts: NOW - 2 * HOUR, stopKey: 'bus:1001', sessionId: 'a' }),
      evt({ ts: NOW - HOUR, stopKey: 'bus:1001', sessionId: 'a' })
    ];
    expect(buildHistoryIndex(events, []).transitions.get('bus:1001')).toBeUndefined();
  });

  it('still counts a move between distinct stops inside one session', () => {
    const events = [
      evt({ ts: NOW - 2 * HOUR, stopKey: 'bus:1001', sessionId: 'a' }),
      evt({ ts: NOW - HOUR, stopKey: 'bus:1002', sessionId: 'a' })
    ];
    expect(buildHistoryIndex(events, []).transitions.get('bus:1001')?.get('bus:1002')).toBe(1);
  });

  it('does not treat two events months apart as adjacent', () => {
    const events = [
      evt({ ts: NOW - 90 * DAY, stopKey: 'bus:1001', sessionId: 'a' }),
      evt({ ts: NOW, stopKey: 'bus:1002', sessionId: 'b' })
    ];
    expect(buildHistoryIndex(events, []).transitions.get('bus:1001')).toBeUndefined();
  });
});

describe('candidateFeatures', () => {
  it('does not let a future-dated event explode the recency score', () => {
    // Clock skew, or a device whose time was moved backwards.
    const events = [evt({ ts: NOW + 10 * DAY, stopKey: 'bus:1001' })];
    const index = buildHistoryIndex(events, []);
    const features = candidateFeatures('bus:1001', context(), index, 0.5);
    expect(features.recency7d).toBeCloseTo(1, 5);
    expect(Number.isFinite(features.recency7d)).toBe(true);
  });

  it('matches time of day circularly, so 23:50 and 00:10 count as the same slot', () => {
    const lateNight = Date.UTC(2026, 4, 19, 23, 50);
    const events = [evt({ ts: lateNight, stopKey: 'bus:1001', tzOffsetMin: 0 })];
    const index = buildHistoryIndex(events, []);
    const justAfterMidnight = context({ ts: Date.UTC(2026, 4, 20, 0, 10) });
    const midMorning = context({ ts: Date.UTC(2026, 4, 20, 10, 0) });

    expect(candidateFeatures('bus:1001', justAfterMidnight, index, 0.5).timeAffinity)
      .toBeGreaterThan(candidateFeatures('bus:1001', midMorning, index, 0.5).timeAffinity);
  });

  it('does not let a single view claim a perfect time-of-day habit', () => {
    // A ratio over one observation is 1.0 by construction. Smoothing toward the base rate keeps
    // thin evidence weak, so one glance cannot outrank a real routine.
    const once = buildHistoryIndex([evt({ ts: NOW - DAY, stopKey: 'bus:1001' })], []);
    const routine = buildHistoryIndex(
      Array.from({ length: 12 }, (_, i) =>
        evt({ ts: NOW - (i + 1) * DAY, stopKey: 'bus:1002', sessionId: `r${i}` })).reverse(), []);

    const thin = candidateFeatures('bus:1001', context(), once, 0.5);
    const habit = candidateFeatures('bus:1002', context(), routine, 0.5);

    expect(thin.timeAffinity).toBeLessThan(0.5);
    expect(habit.timeAffinity).toBeGreaterThan(thin.timeAffinity);
    expect(thin.dowAffinity).toBeLessThan(0.5);
  });

  it('scores a lone favourite at the top of the rank', () => {
    const index = buildHistoryIndex([evt({ ts: NOW - DAY, stopKey: 'bus:1001' })], ['bus:1001']);
    const features = candidateFeatures('bus:1001', context(), index, 0.5);
    expect(features.isFavorite).toBe(true);
    expect(features.favoriteRankNorm).toBe(1);
  });

  it('reports an unseen stop as having no history rather than throwing', () => {
    const features = candidateFeatures('bus:4242', context(), buildHistoryIndex([], []), 0.5);
    expect(features.viewCount).toBe(0);
    expect(features.hoursSinceLastView).toBeNull();
    expect(features.timeAffinity).toBe(0);
    expect(features.named.values.every(Number.isFinite)).toBe(true);
  });
});

describe('distanceRanks', () => {
  const withCoords = (stopKey: 'bus:1001' | 'bus:1002', lat: number, lon: number) =>
    evt({ ts: NOW - DAY, stopKey, stopLat: lat, stopLon: lon });

  it('ranks nearest at 0 and furthest at 1', () => {
    const events = sorted([withCoords('bus:1001', 41.8858, -87.6307)],
                          [withCoords('bus:1002', 41.9396, -87.6537)]);
    const index = buildHistoryIndex(events, []);
    const ranks = distanceRanks(['bus:1001', 'bus:1002'],
      context({ userLat: 41.8857, userLon: -87.6305 }), index);
    expect(ranks.get('bus:1001')).toBe(0);
    expect(ranks.get('bus:1002')).toBe(1);
  });

  it('sits every candidate at 0.5 when the user position is unknown', () => {
    const index = buildHistoryIndex([withCoords('bus:1001', 41.88, -87.63)], []);
    const ranks = distanceRanks(['bus:1001'], context(), index);
    expect(ranks.get('bus:1001')).toBe(0.5);
  });

  it('does not divide by zero with a single measured candidate', () => {
    const index = buildHistoryIndex([withCoords('bus:1001', 41.88, -87.63)], []);
    const ranks = distanceRanks(['bus:1001', 'bus:1002'],
      context({ userLat: 41.88, userLon: -87.63 }), index);
    expect(ranks.get('bus:1001')).toBe(0);
    expect(ranks.get('bus:1002')).toBe(0.5);
  });
});

describe('contextFeatures', () => {
  it('emits a finite value for every named feature', () => {
    const { names, values } = contextFeatures(context());
    expect(values).toHaveLength(names.length);
    expect(values.every(Number.isFinite)).toBe(true);
  });

  it('survives a session with no recorded gap', () => {
    const { values } = contextFeatures(context({ msSinceLastAppOpen: null }));
    expect(values.every(Number.isFinite)).toBe(true);
  });
});
