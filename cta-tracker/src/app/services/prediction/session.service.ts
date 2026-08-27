// Session identity and the inter-session gap.
//
// Two thresholds live in this file and they are deliberately different numbers:
//
//  - SESSION_GAP_MS (30 min) decides where one visit ends and the next begins. It exists to group
//    events, and 30 minutes is the conventional web-analytics boundary.
//  - COLD_START_GAP_MS (2 h) decides when the app considers the user "back after a while" and worth
//    predicting for. It is the feature's actual trigger.
//
// Only the second is a modelling choice, and it is stored on each event as a raw duration rather
// than a boolean so the right value can be found from data later instead of guessed now.

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Exported so Settings can keep them out of Clear Cache: losing mid-session state would make the
 *  next load look like a fresh visit and mislabel an ordinary continuation as a session's first stop. */
export const LAST_ACTIVITY_KEY = 'predict-last-activity';
export const SESSION_KEY = 'predict-session';

export const SESSION_GAP_MS = 30 * 60 * 1000;
export const COLD_START_GAP_MS = 2 * 60 * 60 * 1000;

interface PersistedSession {
  id: string;
  seq: number;
  gapMs: number | null;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private session: PersistedSession = { id: '', seq: 0, gapMs: null };
  private started = false;

  /**
   * Idempotent, and called from afterNextRender so it never runs during the prerender of '/',
   * '/routes' or '/favorites'.
   */
  start(now = Date.now()): void {
    if (this.started || !this.isBrowser) {
      return;
    }
    this.started = true;

    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = raw === null ? null : Number(raw);
    const gap = lastActivity !== null && Number.isFinite(lastActivity) ? now - lastActivity : null;

    // A reload or a PWA relaunch inside the session window continues the same session, sequence
    // counter included. Minting a fresh session on every document load would reset seqInSession to
    // 0 and so label an ordinary mid-session reload as "the first stop the user opened after being
    // away" — which is precisely the event the predictor trains on.
    const resumed = gap !== null && gap < SESSION_GAP_MS ? this.load() : null;
    this.session = resumed ?? {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      seq: 0,
      // Only a genuinely new session carries a gap, so this stays readable as "how long the user
      // was away before this visit".
      gapMs: gap !== null && gap >= SESSION_GAP_MS ? gap : null
    };
    this.persist();
    this.touch(now);
  }

  /** Marks the app as active so the next launch can measure the gap correctly. */
  touch(now = Date.now()): void {
    if (this.isBrowser) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }
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

  /** Sequence number for the next stop view; 0 identifies the session's first, the prediction target. */
  takeSeq(): number {
    const seq = this.session.seq++;
    this.persist();
    return seq;
  }

  /** Whether any stop has been opened yet this session — the suggestion hides once one has. */
  hasViewedStop(): boolean {
    return this.session.seq > 0;
  }

  private load(): PersistedSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedSession;
      return typeof parsed?.id === 'string' && typeof parsed.seq === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (this.isBrowser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    }
  }
}
