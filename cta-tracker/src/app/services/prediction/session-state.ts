// Session identity and the inter-session gap, as plain logic over a SafeStorage.
//
// Kept free of Angular so it can be tested directly; SessionService is the injectable wrapper.
//
// Two thresholds live here and they are deliberately different numbers:
//
//  - SESSION_GAP_MS (30 min) decides where one visit ends and the next begins. It exists to group
//    events, and 30 minutes is the conventional web-analytics boundary.
//  - COLD_START_GAP_MS (2 h) decides when the app considers the user "back after a while" and worth
//    predicting for. It is the feature's actual trigger.
//
// Only the second is a modelling choice, and it is stored on each event as a raw duration rather
// than a boolean so the right value can be found from data later instead of guessed now.

import { SafeStorage } from './safe-storage';

/** Exported so Settings can keep them out of Clear Cache: losing mid-session state would make the
 *  next load look like a fresh visit and mislabel an ordinary continuation as a session's first stop. */
export const LAST_ACTIVITY_KEY = 'predict-last-activity';
export const SESSION_KEY = 'predict-session';

export const SESSION_GAP_MS = 30 * 60 * 1000;
export const COLD_START_GAP_MS = 2 * 60 * 60 * 1000;

export interface PersistedSession {
  id: string;
  seq: number;
  /**
   * Views the *user* chose, as opposed to `seq`, which counts every stop view including the ones
   * the app itself caused. The suggestion gate reads this one; see `hasViewedStop`.
   */
  userSeq: number;
  gapMs: number | null;
}

export class SessionState {
  private session: PersistedSession = { id: '', seq: 0, userSeq: 0, gapMs: null };
  private started = false;

  constructor(private readonly storage: SafeStorage) {}

  /** Idempotent. Safe to call before any storage is available — it simply mints an ephemeral session. */
  start(now = Date.now()): void {
    if (this.started) {
      return;
    }

    const raw = this.storage.get(LAST_ACTIVITY_KEY);
    const lastActivity = raw === null ? null : Number(raw);
    // A negative gap means the system clock moved backwards. Treat it as unknown rather than as a
    // tiny gap, which would wrongly resume a session that may be days old.
    const elapsed = lastActivity !== null && Number.isFinite(lastActivity) ? now - lastActivity : null;
    const gap = elapsed !== null && elapsed >= 0 ? elapsed : null;

    // A reload or a PWA relaunch inside the session window continues the same session, sequence
    // counter included. Minting a fresh session on every document load would reset seqInSession to
    // 0 and so label an ordinary mid-session reload as "the first stop the user opened after being
    // away" — which is precisely the event the predictor trains on.
    const resumed = gap !== null && gap < SESSION_GAP_MS ? this.load() : null;
    this.session = resumed ?? {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      seq: 0,
      userSeq: 0,
      // Only a genuinely new session carries a gap, so this stays readable as "how long the user
      // was away before this visit".
      gapMs: gap !== null && gap >= SESSION_GAP_MS ? gap : null
    };
    this.persist();
    this.touch(now);

    // Set last, so a storage failure mid-way leaves start() retryable rather than latching a
    // half-initialized state. Callers run it once from afterNextRender either way.
    this.started = true;
  }

  hasStarted(): boolean {
    return this.started;
  }

  /** Marks the app as active so the next launch can measure the gap correctly. */
  touch(now = Date.now()): void {
    this.storage.set(LAST_ACTIVITY_KEY, String(now));
  }

  currentSessionId(): string {
    return this.session.id;
  }

  gapMs(): number | null {
    return this.session.gapMs;
  }

  /** True when this launch is the situation the predictor exists for. */
  isColdStart(): boolean {
    return this.session.gapMs !== null && this.session.gapMs >= COLD_START_GAP_MS;
  }

  /**
   * Claims the next sequence number for this session.
   *
   * Re-reads storage first rather than trusting the in-memory counter: two tabs open at once share
   * one localStorage, so a tab that cached `seq` at construction would hand out a number another
   * tab already used — producing two events in the same session both claiming to be its first,
   * which is two contradictory positive labels. Read-modify-write closes the realistic window;
   * fully serializing it would need Web Locks and is not worth the cost here.
   *
   * `userDriven` is false for the views the app caused rather than the user — a LS_SAVED_ROUTE
   * restore or a reload onto a stop page. Those still take a sequence number, because they really
   * did happen and the log has to stay a faithful record of the session, but they must not count
   * as the user having made a choice; see `hasViewedStop`.
   */
  takeSeq(userDriven = true): number {
    const stored = this.load();
    if (stored && stored.id === this.session.id) {
      if (stored.seq > this.session.seq) {
        this.session.seq = stored.seq;
      }
      if (stored.userSeq > this.session.userSeq) {
        this.session.userSeq = stored.userSeq;
      }
    }
    const seq = this.session.seq++;
    if (userDriven) {
      this.session.userSeq++;
    }
    this.persist();
    return seq;
  }

  /**
   * Whether the user has opened a stop yet this session — the suggestion hides once they have.
   *
   * Deliberately counts `userSeq` rather than `seq`. When LS_SAVED_ROUTE restores into a stop page,
   * or iOS reloads a discarded PWA onto one, the app has opened a stop but the user has not chosen
   * anything, and gating on the raw sequence number suppressed the suggestion for the rest of that
   * launch. That is the same confusion `extractTrainingExamples` already corrects for offline
   * labels; this is the runtime half of it.
   */
  hasViewedStop(): boolean {
    const stored = this.load();
    const userSeq = stored && stored.id === this.session.id
      ? Math.max(stored.userSeq, this.session.userSeq)
      : this.session.userSeq;
    return userSeq > 0;
  }

  private load(): PersistedSession | null {
    try {
      const raw = this.storage.get(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedSession;
      if (typeof parsed?.id !== 'string' || typeof parsed.seq !== 'number' || !Number.isFinite(parsed.seq)) {
        return null;
      }
      // Sessions persisted before userSeq existed fall back to seq, which is what the gate used to
      // read. That keeps an in-flight session behaving as it did rather than suddenly re-arming.
      const userSeq = typeof parsed.userSeq === 'number' && Number.isFinite(parsed.userSeq)
        ? parsed.userSeq
        : parsed.seq;
      return { ...parsed, userSeq };
    } catch {
      return null;
    }
  }

  private persist(): void {
    this.storage.set(SESSION_KEY, JSON.stringify(this.session));
  }
}
