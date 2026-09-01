import { beforeEach, describe, expect, it } from 'vitest';
import { SafeStorage } from './safe-storage';
import {
  COLD_START_GAP_MS, LAST_ACTIVITY_KEY, SESSION_GAP_MS, SESSION_KEY, SessionState
} from './session-state';
import { memoryStorage as fakeStorage } from './test-fixtures';

/** Storage that fails every operation, as a full quota or blocked site data would. */
function throwingStorage(): SafeStorage {
  return { get: () => null, set: () => false };
}

const NOW = Date.UTC(2026, 4, 20, 9, 0, 0);
const HOUR = 60 * 60 * 1000;

describe('SessionState.start', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => { storage = fakeStorage(); });

  it('mints a session with no gap on a first-ever launch', () => {
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.currentSessionId()).not.toBe('');
    expect(session.gapMs()).toBeNull();
    expect(session.isColdStart()).toBe(false);
  });

  it('records the gap and reports a cold start after a long absence', () => {
    storage.backing.set(LAST_ACTIVITY_KEY, String(NOW - 4 * HOUR));
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.gapMs()).toBe(4 * HOUR);
    expect(session.isColdStart()).toBe(true);
  });

  it('does not report a cold start for a gap under the threshold', () => {
    storage.backing.set(LAST_ACTIVITY_KEY, String(NOW - COLD_START_GAP_MS + 1000));
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.isColdStart()).toBe(false);
  });

  it('resumes the same session and sequence across a reload inside the window', () => {
    const first = new SessionState(storage);
    first.start(NOW);
    first.takeSeq();
    first.takeSeq();

    const afterReload = new SessionState(storage);
    afterReload.start(NOW + 5 * 60 * 1000);

    expect(afterReload.currentSessionId()).toBe(first.currentSessionId());
    // The reload must not re-claim seq 0 — that would label a mid-session reload as the session's
    // first stop, which is the event the predictor trains on.
    expect(afterReload.takeSeq()).toBe(2);
    expect(afterReload.hasViewedStop()).toBe(true);
  });

  it('starts a new session once the window has passed', () => {
    const first = new SessionState(storage);
    first.start(NOW);
    first.takeSeq();

    const later = new SessionState(storage);
    later.start(NOW + SESSION_GAP_MS + 1000);

    expect(later.currentSessionId()).not.toBe(first.currentSessionId());
    expect(later.takeSeq()).toBe(0);
  });

  it('treats a backwards system clock as an unknown gap, not a resumable session', () => {
    storage.backing.set(LAST_ACTIVITY_KEY, String(NOW + 10 * HOUR));
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.gapMs()).toBeNull();
    expect(session.isColdStart()).toBe(false);
  });

  it('ignores a non-numeric last-activity value', () => {
    storage.backing.set(LAST_ACTIVITY_KEY, 'not-a-number');
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.gapMs()).toBeNull();
  });

  it('mints a fresh session when the persisted one is corrupt', () => {
    storage.backing.set(LAST_ACTIVITY_KEY, String(NOW - 1000));
    storage.backing.set(SESSION_KEY, '{ this is not json');
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.currentSessionId()).not.toBe('');
    expect(session.takeSeq()).toBe(0);
  });

  it('mints a fresh session when the persisted one is the wrong shape', () => {
    storage.backing.set(LAST_ACTIVITY_KEY, String(NOW - 1000));
    storage.backing.set(SESSION_KEY, JSON.stringify({ id: 42, seq: 'nope' }));
    const session = new SessionState(storage);
    session.start(NOW);
    expect(session.currentSessionId()).not.toBe('');
  });

  it('is idempotent', () => {
    const session = new SessionState(storage);
    session.start(NOW);
    const id = session.currentSessionId();
    session.start(NOW + 10 * HOUR);
    expect(session.currentSessionId()).toBe(id);
  });
});

describe('SessionState with failing storage', () => {
  it('still yields a usable session rather than throwing', () => {
    const session = new SessionState(throwingStorage());
    expect(() => session.start(NOW)).not.toThrow();
    expect(session.currentSessionId()).not.toBe('');
    expect(session.takeSeq()).toBe(0);
    expect(session.takeSeq()).toBe(1);
    expect(() => session.touch(NOW)).not.toThrow();
  });

  it('leaves start() retryable when storage never succeeds', () => {
    // start() must not latch `started` before its work completes, or a transient failure would
    // permanently skip the rest of the app's startup hook.
    const session = new SessionState(throwingStorage());
    session.start(NOW);
    expect(session.hasStarted()).toBe(true);
  });
});

describe('SessionState across two tabs', () => {
  it('never hands the same sequence number to both tabs', () => {
    const shared = new Map<string, string>();
    shared.set(LAST_ACTIVITY_KEY, String(NOW - 4 * HOUR));

    const tabA = new SessionState(fakeStorage(shared));
    tabA.start(NOW);
    const tabB = new SessionState(fakeStorage(shared));
    tabB.start(NOW + 1000);

    // Same session — the second tab opened well inside the window.
    expect(tabB.currentSessionId()).toBe(tabA.currentSessionId());

    const claimed = [tabA.takeSeq(), tabB.takeSeq(), tabA.takeSeq(), tabB.takeSeq()];
    expect(new Set(claimed).size).toBe(claimed.length);
    // Exactly one of them may claim seq 0, the session's first stop.
    expect(claimed.filter(seq => seq === 0)).toHaveLength(1);
  });

  it('treats a session persisted before userSeq existed as already viewed', () => {
    // Deploying this mid-session must not re-arm the suggestion for someone who has already been
    // using the app: without a userSeq to read, seq is the closest honest answer and is what the
    // gate used to consult.
    const storage = fakeStorage();
    const session = new SessionState(storage);
    session.start(NOW);
    const legacy = JSON.parse(storage.backing.get(SESSION_KEY)!);
    delete legacy.userSeq;
    legacy.seq = 2;
    storage.backing.set(SESSION_KEY, JSON.stringify(legacy));

    // A reload inside the session window resumes that same session, now through the new code.
    const resumed = new SessionState(storage);
    resumed.start(NOW + 60_000);

    expect(resumed.hasViewedStop()).toBe(true);
  });

  it('reports hasViewedStop across tabs, so the chip does not fire twice', () => {
    const shared = new Map<string, string>();
    shared.set(LAST_ACTIVITY_KEY, String(NOW - 4 * HOUR));

    const tabA = new SessionState(fakeStorage(shared));
    tabA.start(NOW);
    const tabB = new SessionState(fakeStorage(shared));
    tabB.start(NOW + 1000);

    expect(tabB.hasViewedStop()).toBe(false);
    tabA.takeSeq();
    expect(tabB.hasViewedStop()).toBe(true);
  });
});
