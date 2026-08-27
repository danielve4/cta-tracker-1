// Ranking, shadow-mode impressions, and the accuracy readout.
//
// Every ranking is written to the log *before* the outcome is known and resolved afterwards with
// where the user actually went. That is the whole point of the shadow record: it turns "does this
// work?" into a number that exists before any ML is written, and it is the number a future model
// has to beat — alongside most-recently-used, which is the floor.

import { Injectable, inject, signal } from '@angular/core';
import { Favorite } from '../Favorite';
import { FavoritesService } from '../favorites.service';
import { MIN_CONFIDENT_SCORE, MIN_EVENTS_FOR_SUGGESTION, SCORER_VERSION, ScoredCandidate, rankCandidates } from './baseline-scorer';
import { Candidate, buildCandidates, mostRecentlyUsed } from './candidates';
import { EventLogStore } from './event-log.store';
import { FEATURE_VERSION, PredictionContext, buildHistoryIndex, candidateFeatures, distanceRanks } from './features';
import { LocationService } from './location.service';
import { PredictionPreferencesService } from './prediction-preferences.service';
import { SessionService } from './session.service';
import { stopKeyOf } from './stop-key';
import { PredictionRecord, SCHEMA_VERSION, StopKey, StopViewEvent } from './stop-view-event';
import { StopViewTrackerService } from './stop-view-tracker.service';

export interface Suggestion {
  stopKey: StopKey;
  score: number;
  /** The most recent event for the stop, carrying what the deep link needs. */
  event: StopViewEvent;
}

export interface AccuracyStats {
  resolved: number;
  top1: number;
  top3: number;
  mruTop1: number;
}

@Injectable({ providedIn: 'root' })
export class PredictorService {
  private readonly store = inject(EventLogStore);
  private readonly session = inject(SessionService);
  private readonly prefs = inject(PredictionPreferencesService);
  private readonly location = inject(LocationService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly tracker = inject(StopViewTrackerService);

  /** Top suggestions for the current cold start, or empty when there is nothing worth showing. */
  readonly suggestions = signal<Suggestion[]>([]);

  private pendingRecordId: number | null = null;
  /** SuggestedStopComponent re-mounts on every return to /routes; the ranking should not. */
  private hasPredicted = false;

  /**
   * Ranks the candidate stops and records the impression.
   *
   * Returns without doing anything unless this launch is actually the situation the feature exists
   * for: a genuine cold start, with enough history for the features to mean anything, and no stop
   * opened yet this session.
   */
  async predictForColdStart(): Promise<void> {
    if (this.hasPredicted || !this.prefs.collectHistory()
      || !this.session.isColdStart() || this.session.hasViewedStop()) {
      return;
    }
    // Set before the first await, so two mounts in the same tick cannot both get through and
    // orphan the earlier impression by overwriting pendingRecordId.
    this.hasPredicted = true;

    const events = await this.store.allEvents();
    if (events.length < MIN_EVENTS_FOR_SUGGESTION) {
      return;
    }

    const favoriteKeys = await this.favoriteKeys();
    const candidates = buildCandidates(events, favoriteKeys);
    if (candidates.length < 2) {
      return;
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

    const ranked = this.rank(events, favoriteKeys, candidates, context);
    const byStop = new Map<StopKey, Candidate>(candidates.map(c => [c.stopKey, c]));

    const record: PredictionRecord = {
      v: SCHEMA_VERSION,
      ts: context.ts,
      sessionId: this.session.currentSessionId(),
      ranked: ranked.slice(0, 5).map(({ stopKey, score }) => ({ stopKey, score })),
      candidateCount: candidates.length,
      mruStopKey: mostRecentlyUsed(events),
      scorerVersion: SCORER_VERSION,
      featureVersion: FEATURE_VERSION,
      msSinceLastAppOpen: this.session.gapMs(),
      actualStopKey: null,
      rankOfActual: null,
      dismissed: false,
      resolvedAt: null
    };
    this.pendingRecordId = await this.store.appendPrediction(record);

    // The impression is recorded whatever the score; only *showing* it is gated on confidence, so
    // the accuracy readout measures the ranker rather than the display rule.
    const confident = ranked.filter(entry => entry.score >= MIN_CONFIDENT_SCORE).slice(0, 2);
    this.suggestions.set(
      confident
        .map(entry => {
          const candidate = byStop.get(entry.stopKey);
          return candidate ? { stopKey: entry.stopKey, score: entry.score, event: candidate.latest } : null;
        })
        .filter((entry): entry is Suggestion => entry !== null)
    );
  }

  private isStandalone(): boolean {
    // Unreachable on the server today only because the event log is empty there, which is too
    // incidental to rely on.
    return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  }

  private rank(
    events: StopViewEvent[],
    favoriteKeys: StopKey[],
    candidates: Candidate[],
    context: PredictionContext
  ): ScoredCandidate[] {
    const history = buildHistoryIndex(events, favoriteKeys);
    const stopKeys = candidates.map(candidate => candidate.stopKey);
    const ranks = distanceRanks(stopKeys, context, history);
    return rankCandidates(stopKeys.map(stopKey => ({
      features: candidateFeatures(stopKey, context, history, ranks.get(stopKey) ?? 0.5),
      distanceRankNorm: ranks.get(stopKey) ?? 0.5
    })));
  }

  /** Closes out the open impression with where the user actually went. */
  async resolveWith(stopKey: StopKey): Promise<void> {
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

  /** Top-1 / top-3 hit rates against the MRU floor, straight from the impression store. */
  async accuracy(): Promise<AccuracyStats> {
    const records = await this.store.allPredictions();
    const stats: AccuracyStats = { resolved: 0, top1: 0, top3: 0, mruTop1: 0 };
    for (const record of records) {
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
