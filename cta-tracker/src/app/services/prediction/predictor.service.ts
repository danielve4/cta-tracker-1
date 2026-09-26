// Ranking, shadow-mode impressions, and the accuracy readout.
//
// Every ranking is written to the log *before* the outcome is known and resolved afterwards with
// where the user actually went. That is the whole point of the shadow record: it turns "does this
// work?" into a number that exists before any ML is written, and it is the number a future model
// has to beat — alongside most-recently-used, which is the floor.

import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Favorite } from '../Favorite';
import { FavoritesService } from '../favorites.service';
import { didYouMean, pickAutoOpen } from './auto-open';
import { MIN_CONFIDENT_SCORE, MIN_EVENTS_FOR_SUGGESTION, SCORER_VERSION, ScoredCandidate, rankCandidates } from './baseline-scorer';
import { Candidate, buildCandidates, mostRecentlyUsed } from './candidates';
import { EventLogStore } from './event-log.store';
import {
  CandidateFeatures, FEATURE_VERSION, PredictionContext, buildHistoryIndex, candidateFeatures, distanceRanks
} from './features';
import { LocationService } from './location.service';
import { PredictionPreferencesService } from './prediction-preferences.service';
import { browserStorage, nullStorage } from './safe-storage';
import { SessionService } from './session.service';
import { stopKeyOf } from './stop-key';
import { PredictionAction, PredictionRecord, SCHEMA_VERSION, StopKey, StopViewEvent } from './stop-view-event';
import { StopView, StopViewTrackerService } from './stop-view-tracker.service';

/**
 * The session id whose "did you mean" check has been spent. Persisted rather than held in memory
 * because iOS reloads a discarded PWA mid-session, and a fresh document would otherwise ask again
 * about a stop the user already answered for.
 */
export const DID_YOU_MEAN_SESSION_KEY = 'predict-did-you-mean-session';

export interface Suggestion {
  stopKey: StopKey;
  score: number;
  /** The most recent event for the stop, carrying what the deep link needs. */
  event: StopViewEvent;
}

/**
 * Why the last cold-start check produced nothing, for the Settings readout.
 *
 * This exists because the feature failing is indistinguishable from the feature not triggering:
 * every gate below is a silent early return, and working out which one fired took exporting the
 * event log and replaying it offline. Naming the gate turns that into a glance.
 */
export type SuppressionReason =
  | 'ok'
  | 'below-auto-confidence'
  | 'not-evaluated'
  | 'collection-off'
  | 'not-cold-start'
  | 'already-viewed-stop'
  | 'too-few-events'
  | 'too-few-candidates'
  | 'below-confidence';

export interface AccuracyStats {
  /** Chip impressions only; the other two actions are counted separately below. */
  resolved: number;
  top1: number;
  top3: number;
  mruTop1: number;
  /** Stops opened automatically, and how many the user then left for a different stop. */
  autoOpened: number;
  autoCorrected: number;
  /** "Did you mean" chips shown, and how many were tapped. */
  didYouMeanShown: number;
  didYouMeanAccepted: number;
}

/** One ranking and everything the decisions layered on it read. */
interface Ranking {
  ranked: ScoredCandidate[];
  byStop: Map<StopKey, Candidate>;
  features: Map<StopKey, CandidateFeatures>;
  candidateCount: number;
  mruStopKey: StopKey | null;
  context: PredictionContext;
}

@Injectable({ providedIn: 'root' })
export class PredictorService {
  private readonly store = inject(EventLogStore);
  private readonly session = inject(SessionService);
  private readonly prefs = inject(PredictionPreferencesService);
  private readonly location = inject(LocationService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly tracker = inject(StopViewTrackerService);
  private readonly storage = isPlatformBrowser(inject(PLATFORM_ID)) ? browserStorage() : nullStorage();

  /** Top suggestions for the current cold start, or empty when there is nothing worth showing. */
  readonly suggestions = signal<Suggestion[]>([]);

  /** The stop to ask "did you mean…?" about, while the chip is up. */
  readonly didYouMean = signal<Suggestion | null>(null);

  /** Which gate the last evaluation stopped at. Surfaced in Settings; see SuppressionReason. */
  readonly suppressionReason = signal<SuppressionReason>('not-evaluated');

  private pendingRecordId: number | null = null;
  private didYouMeanRecordId: number | null = null;

  /**
   * The launch ranking, shared. SuggestedStopComponent re-mounts on every return to /routes, and
   * AppComponent needs the same answer to decide whether to auto-open, so it is computed once and
   * every caller awaits the same promise — a plain "already done" flag would hand the second caller
   * nothing to wait on.
   */
  private launch: Promise<Ranking | null> | null = null;

  /**
   * Set by AppComponent while it is holding the launch navigation to see whether it can auto-open.
   * While armed, the chip's suggestions are held back rather than published, so the chip never
   * flashes up on the screen the app is about to leave.
   */
  private autoArmed = false;
  private heldSuggestions: Suggestion[] = [];

  /** Bumped on every navigation, so a slow "did you mean" check can tell the user has moved on. */
  private navigationCount = 0;

  /**
   * The launch-time gates, in order, without side effects.
   *
   * Shared with `explain()` so the Settings readout cannot drift from what actually runs — the two
   * disagreeing would be worse than no readout, since the whole point is to be trusted.
   */
  private gateReason(): Exclude<SuppressionReason, 'ok' | 'below-auto-confidence' | 'too-few-events' | 'too-few-candidates' | 'below-confidence'> | null {
    if (!this.prefs.collectHistory()) return 'collection-off';
    if (!this.session.isColdStart()) return 'not-cold-start';
    if (this.session.hasViewedStop()) return 'already-viewed-stop';
    return null;
  }

  /**
   * Ranks the candidate stops and records the impression.
   *
   * Returns without doing anything unless this launch is actually the situation the feature exists
   * for: a genuine cold start, with enough history for the features to mean anything, and no stop
   * opened yet this session.
   */
  async predictForColdStart(): Promise<void> {
    await this.launchRanking();
  }

  private launchRanking(): Promise<Ranking | null> {
    if (this.launch) {
      return this.launch;
    }
    const blocked = this.gateReason();
    if (blocked) {
      this.suppressionReason.set(blocked);
      return Promise.resolve(null);
    }
    // Memoized before the first await, so two mounts in the same tick cannot both get through and
    // orphan the earlier impression by overwriting pendingRecordId. Only memoized once the gates
    // above pass: they can each flip during a launch, and latching earlier would mean the first
    // screen to mount permanently decided the answer for the whole session.
    this.launch = this.runLaunch();
    return this.launch;
  }

  private async runLaunch(): Promise<Ranking | null> {
    const ranking = await this.rankFromLog();
    if (typeof ranking === 'string') {
      this.suppressionReason.set(ranking);
      return null;
    }
    this.pendingRecordId = await this.store.appendPrediction(this.recordOf(ranking, 'chip'));

    // The impression is recorded whatever the score; only *showing* it is gated on confidence, so
    // the accuracy readout measures the ranker rather than the display rule.
    const suggestions = ranking.ranked
      .filter(entry => entry.score >= MIN_CONFIDENT_SCORE)
      .slice(0, 2)
      .map(entry => this.suggestionFor(ranking, entry.stopKey))
      .filter((entry): entry is Suggestion => entry !== null);
    if (this.autoArmed) {
      this.heldSuggestions = suggestions;
    } else {
      this.suggestions.set(suggestions);
    }
    this.suppressionReason.set(suggestions.length ? 'ok' : 'below-confidence');
    return ranking;
  }

  /**
   * Called by AppComponent, synchronously, before it decides where a cold launch lands. A no-op
   * unless the user chose "Open automatically".
   */
  armAutoOpen(): void {
    this.autoArmed = this.prefs.suggestionMode() === 'auto';
  }

  /**
   * The stop to open instead of restoring the last route, or null to restore as usual.
   *
   * Returns null without waiting when auto-open was never armed or AppComponent has already given up
   * on it (see `disarmAutoOpen`), so a slow IndexedDB can delay a launch by the timeout at most, never
   * redirect it after the user is already looking at something.
   */
  async claimAutoOpen(): Promise<Suggestion | null> {
    if (!this.autoArmed) {
      return null;
    }
    const ranking = await this.launchRanking();
    if (!this.autoArmed) {
      return null;
    }
    this.autoArmed = false;

    const pick = ranking ? pickAutoOpen(ranking.ranked) : null;
    const suggestion = ranking && pick ? this.suggestionFor(ranking, pick) : null;
    if (!suggestion) {
      // Not decisive enough to act on alone, so fall back to offering it.
      if (this.heldSuggestions.length) {
        this.suppressionReason.set('below-auto-confidence');
      }
      this.publishHeld();
      return null;
    }
    this.heldSuggestions = [];
    if (this.pendingRecordId !== null) {
      void this.store.patchPrediction(this.pendingRecordId, { action: 'auto' });
    }
    return suggestion;
  }

  /** AppComponent's timeout: stop waiting to auto-open, and show the chip instead if there is one. */
  disarmAutoOpen(): void {
    if (this.autoArmed) {
      this.autoArmed = false;
      this.publishHeld();
    }
  }

  private publishHeld(): void {
    if (this.heldSuggestions.length) {
      this.suggestions.set(this.heldSuggestions);
      this.heldSuggestions = [];
    }
  }

  /**
   * Called synchronously from AppComponent's NavigationEnd handler, before any stop view is known.
   * Any "did you mean" chip belongs to the page it was raised on, so it goes as soon as the user
   * leaves; the returned token lets `onStopView` tell whether a newer navigation overtook it.
   */
  noteNavigation(): number {
    this.didYouMean.set(null);
    this.didYouMeanRecordId = null;
    return ++this.navigationCount;
  }

  /** Everything the predictor does once a stop view has been logged. Never throws. */
  async onStopView(view: StopView, navigationToken: number): Promise<void> {
    // An auto-open is the model's own guess, so it cannot resolve the impression it came from: that
    // would score every auto-open as a hit. The impression stays open for the stop the user moves to
    // next, if they move at all.
    if (view.entry !== 'auto') {
      await this.resolveWith(view.stopKey);
    }
    await this.checkDidYouMean(view, navigationToken);
  }

  /**
   * Raises "did you mean…?" on the first stop of a cold-start session when that stop is out of
   * character for the time of day and a real routine points somewhere else.
   *
   * Only the session's first stop view is ever considered, whatever it was, so browsing around
   * afterwards never triggers it — and an auto-open or a tapped suggestion spends the check without
   * raising anything, since the user either accepted the model's pick or was handed it.
   */
  private async checkDidYouMean(view: StopView, navigationToken: number): Promise<void> {
    if (!this.session.hasStarted()) {
      return;
    }
    const sessionId = this.session.currentSessionId();
    if (this.storage.get(DID_YOU_MEAN_SESSION_KEY) === sessionId) {
      return;
    }
    this.storage.set(DID_YOU_MEAN_SESSION_KEY, sessionId);

    if (!this.prefs.didYouMean() || !this.prefs.collectHistory() || !this.session.isColdStart()) {
      return;
    }
    if (view.entry === 'auto' || view.entry === 'suggestion') {
      return;
    }

    // The launch ranking when there is one. A launch that restored or reloaded straight onto a stop
    // page never mounted the chip, so never ranked, and this is the only ranking it will get.
    const ranking = (this.launch ? await this.launch : null) ?? await this.rankFromLog();
    if (typeof ranking === 'string' || ranking === null) {
      return;
    }
    const pick = didYouMean(ranking.features.get(view.stopKey), ranking.ranked,
      stopKey => ranking.features.get(stopKey));
    const suggestion = pick ? this.suggestionFor(ranking, pick) : null;
    if (!suggestion || navigationToken !== this.navigationCount) {
      return;
    }
    this.didYouMean.set(suggestion);
    const id = await this.store.appendPrediction(this.recordOf(ranking, 'did-you-mean'));
    // Only kept if the chip is still the one on screen; otherwise the record is left unresolved,
    // which is what an ignored chip is.
    if (this.didYouMean() === suggestion) {
      this.didYouMeanRecordId = id;
    }
  }

  /** The user tapped "did you mean". The navigation itself is the component's to make. */
  async acceptDidYouMean(): Promise<void> {
    const suggestion = this.didYouMean();
    const id = this.didYouMeanRecordId;
    this.didYouMean.set(null);
    this.didYouMeanRecordId = null;
    if (suggestion && id !== null) {
      await this.store.patchPrediction(id, {
        actualStopKey: suggestion.stopKey,
        rankOfActual: 0,
        resolvedAt: Date.now()
      });
    }
  }

  async dismissDidYouMean(): Promise<void> {
    const id = this.didYouMeanRecordId;
    this.didYouMean.set(null);
    this.didYouMeanRecordId = null;
    if (id !== null) {
      await this.store.patchPrediction(id, { dismissed: true, resolvedAt: Date.now() });
    }
  }

  /**
   * Ranks every candidate from the log, or names the gate that stopped it.
   *
   * Views from the current session are left out. At launch the only ones there can be are the app's
   * own restore or reload, and for "did you mean" the view being judged has usually just been
   * written — either would count the stop on screen as having been viewed at this very time, which
   * is precisely the evidence the check is weighing.
   */
  private async rankFromLog(): Promise<Ranking | 'too-few-events' | 'too-few-candidates'> {
    const sessionId = this.session.currentSessionId();
    const events = (await this.store.allEvents()).filter(event => event.sessionId !== sessionId);
    if (events.length < MIN_EVENTS_FOR_SUGGESTION) {
      return 'too-few-events';
    }

    const favoriteKeys = await this.favoriteKeys();
    const candidates = buildCandidates(events, favoriteKeys);
    if (candidates.length < 2) {
      return 'too-few-candidates';
    }

    const position = await this.location.current();
    const context: PredictionContext = {
      ts: Date.now(),
      tzOffsetMin: new Date().getTimezoneOffset(),
      msSinceLastAppOpen: this.session.gapMs(),
      userLat: position.userLat,
      userLon: position.userLon,
      launchedStandalone: this.isStandalone(),
      previousStopKey: this.tracker.previousStopKey() ?? mostRecentlyUsed(events)
    };

    const history = buildHistoryIndex(events, favoriteKeys);
    const stopKeys = candidates.map(candidate => candidate.stopKey);
    const ranks = distanceRanks(stopKeys, context, history);
    const features = new Map<StopKey, CandidateFeatures>(stopKeys.map(stopKey =>
      [stopKey, candidateFeatures(stopKey, context, history, ranks.get(stopKey) ?? 0.5)]));
    const ranked = rankCandidates(stopKeys.map(stopKey => ({
      features: features.get(stopKey)!,
      distanceRankNorm: ranks.get(stopKey) ?? 0.5
    })));

    return {
      ranked,
      byStop: new Map<StopKey, Candidate>(candidates.map(c => [c.stopKey, c])),
      features,
      candidateCount: candidates.length,
      mruStopKey: mostRecentlyUsed(events),
      context
    };
  }

  private recordOf(ranking: Ranking, action: PredictionAction): PredictionRecord {
    return {
      v: SCHEMA_VERSION,
      ts: ranking.context.ts,
      sessionId: this.session.currentSessionId(),
      ranked: ranking.ranked.slice(0, 5).map(({ stopKey, score }) => ({ stopKey, score })),
      candidateCount: ranking.candidateCount,
      mruStopKey: ranking.mruStopKey,
      scorerVersion: SCORER_VERSION,
      featureVersion: FEATURE_VERSION,
      msSinceLastAppOpen: ranking.context.msSinceLastAppOpen,
      actualStopKey: null,
      rankOfActual: null,
      dismissed: false,
      resolvedAt: null,
      action
    };
  }

  private suggestionFor(ranking: Ranking, stopKey: StopKey): Suggestion | null {
    const candidate = ranking.byStop.get(stopKey);
    const scored = ranking.ranked.find(entry => entry.stopKey === stopKey);
    return candidate && scored ? { stopKey, score: scored.score, event: candidate.latest } : null;
  }

  private isStandalone(): boolean {
    // Unreachable on the server today only because the event log is empty there, which is too
    // incidental to rely on.
    return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  }

  /** Closes out the open impression with where the user actually went. */
  private async resolveWith(stopKey: StopKey): Promise<void> {
    // Cleared before the guard: if appendPrediction failed (IndexedDB unavailable) the chip was
    // still rendered but there is no record id, and returning early would leave it on screen
    // offering a stop the user has just opened, with no way to dismiss it.
    this.suggestions.set([]);
    const id = this.pendingRecordId;
    if (id === null) {
      return;
    }
    this.pendingRecordId = null;

    const records = await this.store.allPredictions();
    const record = records.find(candidate => candidate.id === id);
    const rank = record ? record.ranked.findIndex(entry => entry.stopKey === stopKey) : -1;
    await this.store.patchPrediction(id, {
      actualStopKey: stopKey,
      rankOfActual: rank,
      resolvedAt: Date.now()
    });
  }

  /**
   * The user said "not this". Recorded rather than merely hidden: an explicit rejection is a
   * cleaner negative than the absence of a tap, and a bandit will want it as a reward signal.
   */
  async dismiss(): Promise<void> {
    this.suggestions.set([]);
    const id = this.pendingRecordId;
    if (id === null) {
      return;
    }
    this.pendingRecordId = null;
    await this.store.patchPrediction(id, { dismissed: true, resolvedAt: Date.now() });
  }

  /**
   * Why there is no suggestion right now, for Settings.
   *
   * Settings is reachable without ever rendering the chip, so `suppressionReason` may still be
   * 'not-evaluated' when the user goes looking. This re-runs the cheap gates and falls back to the
   * live value once they pass, which is the only part that needs the log.
   */
  async explain(): Promise<SuppressionReason> {
    const blocked = this.gateReason();
    if (blocked) {
      return blocked;
    }
    const reason = this.suppressionReason();
    if (reason !== 'not-evaluated') {
      return reason;
    }
    return await this.store.countEvents() < MIN_EVENTS_FOR_SUGGESTION ? 'too-few-events' : 'ok';
  }

  /** Top-1 / top-3 hit rates against the MRU floor, straight from the impression store. */
  async accuracy(): Promise<AccuracyStats> {
    const records = await this.store.allPredictions();
    const stats: AccuracyStats = {
      resolved: 0, top1: 0, top3: 0, mruTop1: 0,
      autoOpened: 0, autoCorrected: 0, didYouMeanShown: 0, didYouMeanAccepted: 0
    };
    for (const record of records) {
      if (record.action === 'auto') {
        stats.autoOpened++;
        // Resolved only by a stop the user moved to afterwards, so any resolution is a correction
        // unless they came back round to the stop that was opened for them.
        if (record.actualStopKey !== null && record.actualStopKey !== record.ranked[0]?.stopKey) {
          stats.autoCorrected++;
        }
        continue;
      }
      if (record.action === 'did-you-mean') {
        stats.didYouMeanShown++;
        if (record.actualStopKey !== null) stats.didYouMeanAccepted++;
        continue;
      }
      if (record.actualStopKey === null) continue;
      stats.resolved++;
      if (record.rankOfActual === 0) stats.top1++;
      if (record.rankOfActual !== null && record.rankOfActual >= 0 && record.rankOfActual < 3) stats.top3++;
      if (record.mruStopKey === record.actualStopKey) stats.mruTop1++;
    }
    return stats;
  }

  private favoriteKeys(): Promise<StopKey[]> {
    return new Promise((resolve) => {
      this.favoritesService.getFavorites().subscribe({
        next: (favorites: Array<Favorite>) =>
          resolve(favorites.map(favorite => stopKeyOf(favorite.type ?? 'bus', favorite.stopId))),
        error: () => resolve([])
      });
    });
  }
}
