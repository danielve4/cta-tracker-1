import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { TimeuntilPipe } from '../timeuntil.pipe';

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TimeuntilPipe, RouterLink]
})
export class ArrivalsComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly skeletonCards = [0, 1, 2];
  private readonly refreshInterval = 30 * 1000;

  private readonly routeParams = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  forRoute = computed(() => this.routeParams().get('route') ?? '');
  forDirection = computed(() => this.routeParams().get('direction') ?? '');
  forStopId = computed(() => +(this.routeParams().get('stopId') ?? 0));
  forStopName = computed(() => this.routeParams().get('stopName') ?? '');

  private readonly arrivalsResource = httpResource<BustimeResponse>(() => {
    const stopId = this.forStopId();
    return stopId ? this.busService.arrivalsUrl(stopId) : undefined;
  });

  vehicles = computed<Prd[] | null>(() => {
    const response = this.arrivalsResource.hasValue() ? this.arrivalsResource.value() : undefined;
    if (!response || response.error || !response.prd) {
      return null;
    }
    return response.prd
      .filter(p => p.vid)
      .map(p => p.dly ? { ...p, prdctdn: this.getMinutesDifference(p.tmstmp, p.prdtm) } : p);
  });

  error = computed<Error[] | null>(() => {
    if (this.arrivalsResource.error()) {
      return [{ stpid: '', msg: 'Network error' }];
    }
    const response = this.arrivalsResource.hasValue() ? this.arrivalsResource.value() : undefined;
    return response?.error ?? null;
  });

  isInitialLoading = computed(() => this.arrivalsResource.status() === 'loading');
  refreshing = computed(() => this.arrivalsResource.isLoading());
  canRefresh = computed(() => this.forStopId() > 0);
  lastRefreshed = signal<Date | null>(null);

  isFavorite = signal(true);
  favorited = signal(false);
  favoriteStop = computed<Favorite>(() => ({
    route: this.forRoute(),
    stopId: this.forStopId(),
    stopName: this.forStopName(),
    direction: this.forDirection()
  }));

  constructor() {
    // Refresh timestamp + haptic feedback on each successful load/reload.
    effect(() => {
      if (this.arrivalsResource.status() === 'resolved') {
        this.lastRefreshed.set(new Date());
        if (typeof navigator.vibrate !== 'undefined') {
          navigator.vibrate(5);
        }
      }
    });

    // Keep the favorite flag in sync with the current stop.
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
    this.arrivalsResource.reload();
  }

  getMinutesDifference(now: string, future: string): string {
    try {
      const minutes: string = (((this.getDate(future).getTime() - this.getDate(now).getTime()) / 1000) / 60).toFixed(0);
      return +minutes > 1 ? minutes : 'DUE';
    } catch {
      return 'DLY';
    }
  }

  getDate(date: string): Date {
    const dateTime: string[] = date.split(' ');
    return new Date(
      +dateTime[0].slice(0, 4),
      +dateTime[0].slice(4, 6) - 1,
      +dateTime[0].slice(6, 8),
      +dateTime[1].slice(0, 2),
      +dateTime[1].slice(3, 5)
    );
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
