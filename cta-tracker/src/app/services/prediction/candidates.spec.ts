import { describe, expect, it } from 'vitest';
import { buildCandidates, extractTrainingExamples, mostRecentlyUsed } from './candidates';
import { DAY, HOUR, evt, history, sorted } from './test-fixtures';

const NOW = Date.UTC(2026, 4, 20, 9, 0, 0);

describe('extractTrainingExamples', () => {
  it('takes the stop the user chose after an app-driven restore, not the restored one', () => {
    // The regression this exists for: AppComponent restores LS_SAVED_ROUTE into a stop page, so the
    // session's first event is the app's doing. Excluding it must not also discard the stop the
    // user then deliberately opened — that is the only real label the session has.
    const events = sorted(
      history(NOW, 'bus:1001', 6, 'old'),
      history(NOW, 'bus:1002', 6, 'old2'),
      // Real sequence numbers: the restore takes seq 0, so the user's own choice is seq 1 —
      // which is exactly what a `seqInSession !== 0` filter throws away.
      [evt({ ts: NOW, stopKey: 'bus:1001', sessionId: 'cold', entry: 'restored', seqInSession: 0 }),
       evt({ ts: NOW + 1000, stopKey: 'bus:1002', sessionId: 'cold', entry: 'browse', seqInSession: 1 })]
    );

    const examples = extractTrainingExamples(events, 2 * HOUR);

    expect(examples).toHaveLength(1);
    expect(examples[0].label).toBe('bus:1002');
  });

  it('never labels an example with an app-driven view', () => {
    for (const entry of ['restored', 'suggestion'] as const) {
      const events = sorted(
        history(NOW, 'bus:1001', 6, 'old'),
        history(NOW, 'bus:1002', 6, 'old2'),
        [evt({ ts: NOW, stopKey: 'bus:1001', sessionId: 'cold', entry })]
      );
      expect(extractTrainingExamples(events, 2 * HOUR)).toHaveLength(0);
    }
  });

  it('yields at most one example per session', () => {
    const events = sorted(
      history(NOW, 'bus:1001', 6, 'old'),
      history(NOW, 'bus:1002', 6, 'old2'),
      [evt({ ts: NOW, stopKey: 'bus:1002', sessionId: 'cold', entry: 'browse', seqInSession: 0 }),
       evt({ ts: NOW + 1000, stopKey: 'bus:1001', sessionId: 'cold', entry: 'browse', seqInSession: 1 }),
       evt({ ts: NOW + 2000, stopKey: 'bus:1002', sessionId: 'cold', entry: 'favorites', seqInSession: 2 })]
    );

    const examples = extractTrainingExamples(events, 2 * HOUR);

    expect(examples).toHaveLength(1);
    expect(examples[0].label).toBe('bus:1002');
  });

  it('honours the gap threshold as a parameter, not a baked-in constant', () => {
    const events = sorted(
      history(NOW, 'bus:1001', 6, 'old'),
      history(NOW, 'bus:1002', 6, 'old2'),
      [evt({ ts: NOW, stopKey: 'bus:1002', sessionId: 'cold', msSinceLastAppOpen: 90 * 60 * 1000 })]
    );

    expect(extractTrainingExamples(events, 2 * HOUR)).toHaveLength(0);
    expect(extractTrainingExamples(events, 1 * HOUR)).toHaveLength(1);
  });

  it('skips a session that was never away long enough to have a gap', () => {
    const events = sorted(
      history(NOW, 'bus:1001', 6, 'old'),
      history(NOW, 'bus:1002', 6, 'old2'),
      [evt({ ts: NOW, stopKey: 'bus:1002', sessionId: 'warm', msSinceLastAppOpen: null })]
    );
    expect(extractTrainingExamples(events, 2 * HOUR)).toHaveLength(0);
  });

  it('gives each example only history strictly before it', () => {
    const events = sorted(
      history(NOW, 'bus:1001', 6, 'old'),
      history(NOW, 'bus:1002', 6, 'old2'),
      [evt({ ts: NOW, stopKey: 'bus:1002', sessionId: 'cold' })]
    );

    const [example] = extractTrainingExamples(events, 2 * HOUR);

    expect(example.history).toHaveLength(12);
    expect(example.history.every(e => e.ts < example.context.ts)).toBe(true);
  });

  it('builds candidates as of the example, not the wall clock', () => {
    // A stop last seen 120 days before the example is outside the 90-day window at that moment,
    // even though both are in the past relative to "now".
    const events = sorted(
      history(NOW - 120 * DAY, 'bus:9999', 3, 'ancient'),
      history(NOW, 'bus:1001', 6, 'old'),
      history(NOW, 'bus:1002', 6, 'old2'),
      [evt({ ts: NOW, stopKey: 'bus:1002', sessionId: 'cold' })]
    );

    const [example] = extractTrainingExamples(events, 2 * HOUR);

    expect(example.candidates).toContain('bus:1001');
    expect(example.candidates).not.toContain('bus:9999');
  });

  it('drops a session with nothing to rank against', () => {
    const events = sorted(
      history(NOW, 'bus:1001', 6, 'old'),
      [evt({ ts: NOW, stopKey: 'bus:1001', sessionId: 'cold' })]
    );
    expect(extractTrainingExamples(events, 2 * HOUR)).toHaveLength(0);
  });
});

describe('buildCandidates', () => {
  it('keeps a favourite whose last view has aged out of the window', () => {
    const events = history(NOW - 120 * DAY, 'bus:9999', 2, 'ancient');
    expect(buildCandidates(events, [], NOW)).toHaveLength(0);
    expect(buildCandidates(events, ['bus:9999'], NOW).map(c => c.stopKey)).toEqual(['bus:9999']);
  });

  it('carries the latest event for each stop, for rebuilding the deep link', () => {
    const events = [
      evt({ ts: NOW - DAY, stopKey: 'bus:1001', stopName: 'Old Name' }),
      evt({ ts: NOW, stopKey: 'bus:1001', stopName: 'New Name' })
    ];
    expect(buildCandidates(events, [], NOW)[0].latest.stopName).toBe('New Name');
  });
});

describe('mostRecentlyUsed', () => {
  it('is the last event, and null on an empty log', () => {
    expect(mostRecentlyUsed([])).toBeNull();
    expect(mostRecentlyUsed([
      evt({ ts: NOW - DAY, stopKey: 'bus:1001' }),
      evt({ ts: NOW, stopKey: 'bus:1002' })
    ])).toBe('bus:1002');
  });
});
