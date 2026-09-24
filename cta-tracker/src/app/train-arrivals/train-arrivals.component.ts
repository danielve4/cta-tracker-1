import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TrainService } from '../services/train.service';
import { TrainApiResponse, TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { FavoritesService } from '../services/favorites.service';
import { ClockService } from '../services/clock.service';
import { DisplayPreferencesService } from '../services/display-preferences.service';
import { parseTrainTime, formatClockTime, countdownLabel } from '../services/arrival-time';
import { trainDistanceLabel } from '../services/distance';
import { Favorite } from '../services/Favorite';
import { TimeuntilPipe } from '../timeuntil.pipe';
import { StopViewTrackerService } from '../services/prediction/stop-view-tracker.service';
import { ArrivalGroup, TrainArrivalDisplay, groupTrainArrivals } from './train-arrival-groups';
import { TrainArrivalColumnsComponent } from './columns/train-arrival-columns.component';
import { ApproachComponent } from './approach/approach.component';
import { isSideBySide } from '../services/arrivals-layout';

@Component({
  selector: 'app-train-arrivals',
  templateUrl: './train-arrivals.component.html',
  styleUrls: ['./train-arrivals.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TimeuntilPipe, RouterLink, TrainArrivalColumnsComponent, ApproachComponent]
})
export class TrainArrivalsComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly trainService = inject(TrainService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly clock = inject(ClockService);
  protected readonly prefs = inject(DisplayPreferencesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tracker = inject(StopViewTrackerService);

  readonly skeletonCards = [0, 1, 2];
  private readonly refreshInterval = 30 * 1000;

  private readonly routeParams = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  routeId = computed(() => this.routeParams().get('routeId') ?? '');
  stationId = computed(() => this.routeParams().get('stationId') ?? '');
  stationName = computed(() => this.routeParams().get('stationName') ?? '');

  private readonly arrivalsResource = httpResource<TrainApiResponse>(() => {
    const stationId = this.stationId();
    return stationId ? this.trainService.arrivalsUrl(stationId) : undefined;
  });

  // The train API reports no distance, so it is computed against the station's coordinates.
  // Resolves synchronously from the 'traindata' localStorage cache in the normal flow; a cold
  // deep-link fetches it and the distances fill in when it lands.
  private readonly comprehensiveData = toSignal(this.trainService.getComprehensiveData(),
    { initialValue: null });
  private readonly station = computed(() =>
    this.comprehensiveData()?.stations?.[this.stationId()] ?? null);

  private readonly processed = computed<{ groups: ArrivalGroup[] | null; error: string | undefined }>(() => {
    const response = this.arrivalsResource.hasValue() ? this.arrivalsResource.value() : undefined;
    if (!response) {
      return { groups: null, error: this.arrivalsResource.error() ? 'Network error' : undefined };
    }
    if (response.ctatt.errCd !== '0' && response.ctatt.errNm) {
      return { groups: null, error: response.ctatt.errNm };
    }
    if (response.ctatt.eta && response.ctatt.eta.length > 0) {
      const filtered = response.ctatt.eta.filter(eta => eta.rt === this.routeId());
      if (filtered.length === 0) {
        return { groups: null, error: 'No arrivals found' };
      }
      // Anchor each prediction to a real instant on this device's clock, then let it decay
      // against the ticking clock rather than freezing at the API's snapshot.
      const receivedAt = this.lastRefreshed()?.getTime() ?? Date.now();
      const now = this.clock.now();
      const responseTime = parseTrainTime(response.ctatt.tmst);
      const station = this.station();

      const displays: TrainArrivalDisplay[] = filtered.map(eta => {
        const arrivalTime = parseTrainTime(eta.arrT);
        // tmst is the response-level "as of"; prdt is the per-prediction fallback.
        const apiNow = isNaN(responseTime) ? parseTrainTime(eta.prdt) : responseTime;
        const arrivalEpochMs = receivedAt + (arrivalTime - apiNow);
        const countdown = eta.isApp === '1' ? 'DUE' : countdownLabel(arrivalEpochMs - now);
        const lineColor = this.lineColorFor(eta.rt) || this.lineColorFor(this.routeId());
        return {
          ...eta,
          countdown,
          arrivalEpochMs,
          apiArrivalTime: formatClockTime(arrivalTime),
          distance: trainDistanceLabel(station, eta.lat, eta.lon),
          lineColor
        };
      });

      // Read inside the callback so flipping the setting re-orders the groups live: the column and
      // approach layouts need a direction on the same side at every station, the list keeps its
      // A-Z order. The swap is per line, so it holds at every station on this line and no other.
      const order = isSideBySide(this.prefs.arrivalsLayout()) ? 'direction' : 'label';
      const swapped = order === 'direction' && this.prefs.isLineSwapped(this.routeId());
      return { groups: groupTrainArrivals(displays, order, swapped), error: undefined };
    }
    return { groups: null, error: 'No arrivals found' };
  });

  arrivalGroups = computed(() => this.processed().groups);
  errorMsg = computed(() => this.processed().error);

  /** Only two sides can trade places; a single direction already spans the full width. */
  canSwap = computed(() =>
    isSideBySide(this.prefs.arrivalsLayout()) && this.arrivalGroups()?.length === 2);
  isSwapped = computed(() => this.prefs.isLineSwapped(this.routeId()));

  isInitialLoading = computed(() => this.arrivalsResource.status() === 'loading');
  refreshing = computed(() => this.arrivalsResource.isLoading());
  canRefresh = computed(() => this.stationId() !== '');
  lastRefreshed = signal<Date | null>(null);

  isFavorite = signal(true);
  favorited = signal(false);
  favoriteStop = computed<Favorite>(() => ({
    route: this.routeId(),
    stopId: +this.stationId(),
    stopName: this.stationName(),
    direction: '',
    type: 'train'
  }));

  constructor() {
    effect(() => {
      if (this.arrivalsResource.status() === 'resolved') {
        this.lastRefreshed.set(new Date());
        if (typeof navigator.vibrate !== 'undefined') {
          navigator.vibrate(5);
        }
      }
    });

    effect(() => {
      const stop = this.favoriteStop();
      this.favoritesService.search(stop)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((index: number) => this.isFavorite.set(index >= 0));
    });

    const intervalId = setInterval(() => this.arrivalsResource.reload(), this.refreshInterval);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  getArrivals(): void {
    // A manual refresh says the rider is actually waiting at this stop, which dwell time alone
    // doesn't distinguish from a screen left open in a pocket.
    this.tracker.noteRefresh();
    this.arrivalsResource.reload();
  }

  swapColumns(): void {
    this.prefs.toggleLineSwapped(this.routeId());
  }

  private lineColorFor(rt: string): string {
    const cssVar = TRAIN_LINE_CSS_MAP[rt];
    return cssVar ? `var(${cssVar})` : '';
  }

  addToFavorite(): void {
    this.favoritesService.addToFavorites(this.favoriteStop())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((wasAdded: boolean) => {
        this.favorited.set(wasAdded);
        setTimeout(() => {
          this.isFavorite.set(wasAdded);
        }, 300);
      });
  }
}
