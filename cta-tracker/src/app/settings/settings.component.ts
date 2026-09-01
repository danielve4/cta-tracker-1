import { Component, inject, injectAsync, onIdle, afterNextRender, ChangeDetectionStrategy, signal } from '@angular/core';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';
import { ThemeService } from '../services/theme.service';
import { DisplayPreferencesService, SHOW_API_TIMESTAMP_KEY, SHOW_DISTANCE_KEY } from '../services/display-preferences.service';
import { COLLECT_STOP_HISTORY_KEY, PredictionPreferencesService, USE_LOCATION_KEY } from '../services/prediction/prediction-preferences.service';
import { EventLogStore } from '../services/prediction/event-log.store';
import { LocationService } from '../services/prediction/location.service';
import { LAST_ACTIVITY_KEY, SESSION_KEY } from '../services/prediction/session.service';
import { PredictorService, SuppressionReason } from '../services/prediction/predictor.service';
import type { FavoritesService } from '../services/favorites.service';
import type { Favorite } from '../services/Favorite';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';

/**
 * Plain-language version of each gate in PredictorService.
 *
 * Worth the screen space because the suggestion not appearing has half a dozen legitimate causes
 * and no visible difference between them — the first real user report of "I've never seen it" cost
 * an event-log export and an offline replay to answer.
 */
const SUPPRESSION_TEXT: Record<SuppressionReason, string> = {
  'ok': 'Ready — a suggestion will appear the next time you open the app after a few hours away.',
  'not-evaluated': '',
  'collection-off': 'Suggestions are off because stop history is not being recorded.',
  'not-cold-start': 'No suggestion right now: you used the app less than 2 hours ago.',
  'already-viewed-stop': 'No suggestion right now: you have already opened a stop this visit.',
  'too-few-events': 'Still learning — a few more stop views are needed before suggesting anything.',
  'too-few-candidates': 'Still learning — stops from more than one place are needed to choose between.',
  'below-confidence': 'Nothing confident enough to suggest from this visit.'
};

/** Keys that survive "Clear Cache" — user preferences and data, not cached API payloads. */
const PRESERVED_KEYS = [
  'favorites', 'theme-preference', SHOW_API_TIMESTAMP_KEY, SHOW_DISTANCE_KEY,
  COLLECT_STOP_HISTORY_KEY, USE_LOCATION_KEY, LAST_ACTIVITY_KEY, SESSION_KEY
];

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemeToggleComponent, ToggleSwitchComponent]
})
export class SettingsComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly prefs = inject(DisplayPreferencesService);
  protected readonly predictionPrefs = inject(PredictionPreferencesService);
  private readonly eventLog = inject(EventLogStore);
  private readonly location = inject(LocationService);
  private readonly predictor = inject(PredictorService);
  private readonly loadFavoritesService = injectAsync(
    () => import('../services/favorites.service').then(m => m.FavoritesService),
    { prefetch: onIdle }
  );

  syncStatus = signal('');
  cacheCleared = signal(false);
  historyStatus = signal('');
  historyCleared = signal(false);
  accuracy = signal('');
  suggestionState = signal('');

  readonly appVersion = '1.0.0';

  constructor() {
    // Deferred to after the first render for the same reason as everywhere else in the app: this
    // route is client-rendered, but the store is browser-only and must not be touched during
    // hydration.
    afterNextRender(() => void this.refreshAccuracy());
  }

  /**
   * Shows how the shipped heuristic is doing against the most-recently-used floor. It is the number
   * that decides whether an actual model is worth building — if MRU is already winning, it isn't.
   */
  private async refreshAccuracy(): Promise<void> {
    const [stats, count, reason] = await Promise.all([
      this.predictor.accuracy(),
      this.eventLog.countEvents(),
      this.predictor.explain()
    ]);
    if (!stats.resolved) {
      this.accuracy.set(`${count} stop views recorded — no suggestions scored yet`);
      this.suggestionState.set(SUPPRESSION_TEXT[reason]);
      return;
    }
    this.accuracy.set(
      `${count} stop views · ${stats.top1}/${stats.resolved} correct ` +
      `(top-3: ${stats.top3}, most-recent-stop baseline: ${stats.mruTop1})`
    );
    this.suggestionState.set(SUPPRESSION_TEXT[reason]);
  }

  toggleHistory(): void {
    this.predictionPrefs.setCollectHistory(!this.predictionPrefs.collectHistory());
  }

  /**
   * Enabling is what triggers the browser permission prompt — nothing else in the app asks for
   * location. If the user declines, the toggle stays off rather than showing an "on" switch that
   * silently does nothing.
   */
  async toggleLocation(): Promise<void> {
    if (this.predictionPrefs.useLocation()) {
      this.location.disable();
      return;
    }
    const granted = await this.location.enable();
    if (!granted) {
      this.historyStatus.set('Location permission denied');
      setTimeout(() => this.historyStatus.set(''), 3000);
    }
  }

  /**
   * The escape hatch out of the device. Iterating on features is far faster in a notebook than in
   * a browser, and this log is only useful if it can be taken somewhere that has one.
   */
  async exportHistory(): Promise<void> {
    const json = await this.eventLog.exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cta-stop-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async clearHistory(): Promise<void> {
    await this.eventLog.clear();
    this.historyCleared.set(true);
    await this.refreshAccuracy();
    setTimeout(() => this.historyCleared.set(false), 3000);
  }

  async saveFavorites(phone: string): Promise<void> {
    if (!/^[0-9]{10}$/.test(phone.trim())) {
      this.syncStatus.set('Enter a valid 10-digit phone number');
      return;
    }
    this.syncStatus.set('Saving...');
    let favoritesService: FavoritesService;
    try {
      favoritesService = await this.loadFavoritesService();
    } catch {
      this.syncStatus.set('Error: could not load favorites');
      return;
    }
    favoritesService.getFavorites().subscribe((favorites: Array<Favorite>) => {
      favoritesService.saveFavorites(phone.trim(), favorites).subscribe({
        next: (response: HttpResponse<string>) => {
          this.syncStatus.set(response.status === 202 ? 'Favorites saved' : 'Error saving favorites');
        },
        error: (error: HttpErrorResponse) => {
          this.syncStatus.set('Error: ' + (error.error || 'Could not save'));
        }
      });
    });
  }

  async syncFavorites(phone: string): Promise<void> {
    if (!/^[0-9]{10}$/.test(phone.trim())) {
      this.syncStatus.set('Enter a valid 10-digit phone number');
      return;
    }
    this.syncStatus.set('Syncing...');
    let favoritesService: FavoritesService;
    try {
      favoritesService = await this.loadFavoritesService();
    } catch {
      this.syncStatus.set('Error: could not load favorites');
      return;
    }
    favoritesService.syncFavorites(phone.trim()).subscribe({
      next: (response: HttpResponse<string>) => {
        this.syncStatus.set(response.status === 200 ? 'Favorites synced' : 'Error syncing favorites');
      },
      error: (error: HttpErrorResponse) => {
        this.syncStatus.set('Error: ' + (error.error || 'Could not sync'));
      }
    });
  }

  clearCache(): void {
    const preserved = PRESERVED_KEYS.map(key => [key, localStorage.getItem(key)] as const);
    localStorage.clear();
    for (const [key, value] of preserved) {
      if (value !== null) {
        localStorage.setItem(key, value);
      }
    }
    this.cacheCleared.set(true);
    setTimeout(() => this.cacheCleared.set(false), 3000);
  }
}
