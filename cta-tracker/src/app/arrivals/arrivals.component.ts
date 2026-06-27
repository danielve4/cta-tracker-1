import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { timer, Subscription } from 'rxjs';
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
export class ArrivalsComponent implements OnInit, OnDestroy {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly skeletonCards = [0, 1, 2];
  forRoute = signal('');
  forDirection = signal('');
  forStopId = signal(0);
  forStopName = signal('');
  vehicles = signal<Prd[] | null>(null);
  error = signal<Error[] | null>(null);
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  isFavorite = signal(true);
  favoriteStop: Favorite | undefined;
  favorited = signal(false);
  canRefresh = signal(false);
  refreshing = signal(false);
  isInitialLoading = signal(true);
  lastRefreshed = signal<Date | null>(null);

  ngOnInit(): void {
    this.activatedRoute.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.canRefresh.set(true);
      this.isInitialLoading.set(true);
      this.error.set(null);
      this.vehicles.set(null);
      this.forRoute.set(params['route']);
      this.forDirection.set(params['direction']);
      this.forStopId.set(+params['stopId']);
      this.forStopName.set(params['stopName']);
      const tempFavoriteStop: Favorite = {
        route: this.forRoute(),
        stopId: this.forStopId(),
        stopName: this.forStopName(),
        direction: this.forDirection()
      };
      this.favoritesService.search(tempFavoriteStop)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((index: number) => {
          this.isFavorite.set(index >= 0);
        });
      this.favoriteStop = tempFavoriteStop;
      this.timerRef = timer(0, this.refreshInterval).subscribe(() => {
        this.getArrivals();
      });
    });
  }

  ngOnDestroy(): void {
    this.timerRef?.unsubscribe();
  }

  getArrivals(): void {
    if (!this.refreshing()) {
      this.busService.arrivals(this.forStopId()).subscribe((response: BustimeResponse) => {
        this.handleArrivalsResponse(response);
      });
    }
  }

  handleArrivalsResponse(response: BustimeResponse): void {
    this.isInitialLoading.set(false);
    this.refreshing.set(true);
    this.lastRefreshed.set(new Date());
    if (response.error) {
      this.error.set(response.error);
      this.vehicles.set(null);
    } else if (response.prd) {
      const valid = response.prd.filter(p => p.vid);
      for (let i = 0; i < valid.length; i++) {
        if (valid[i].dly) {
          valid[i].prdctdn = this.getMinutesDifference(
            valid[i].tmstmp,
            valid[i].prdtm);
        }
      }
      this.vehicles.set(valid);
      this.error.set(null);
    }
    setTimeout(() => this.refreshing.set(false), 800);
    if (typeof window.navigator.vibrate !== 'undefined') {
      window.navigator.vibrate(5);
    }
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
    if (this.favoriteStop) {
      this.favoritesService.addToFavorites(this.favoriteStop)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((wasAdded: boolean) => {
          this.favorited.set(wasAdded);
          setTimeout(() => {
            this.isFavorite.set(wasAdded);
          }, 300);
        });
    }
  }
}
