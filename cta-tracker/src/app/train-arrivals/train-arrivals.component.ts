import { Component, OnInit, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TrainService } from '../services/train.service';
import { TrainApiResponse, TrainEta, TRAIN_LINE_CSS_MAP, TRAIN_DIRECTION_MAP } from '../trainResponse';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { TimeuntilPipe } from '../timeuntil.pipe';

interface TrainArrivalDisplay extends TrainEta {
  countdown: string;
  lineColor: string;
}

interface ArrivalGroup {
  directionLabel: string;
  arrivals: TrainArrivalDisplay[];
}

@Component({
  selector: 'app-train-arrivals',
  templateUrl: './train-arrivals.component.html',
  styleUrls: ['./train-arrivals.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TimeuntilPipe, RouterLink]
})
export class TrainArrivalsComponent implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly trainService = inject(TrainService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly skeletonCards = [0, 1, 2];
  routeId = signal('');
  stationId = signal('');
  stationName = signal('');
  arrivalGroups = signal<ArrivalGroup[] | null>(null);
  errorMsg = signal<string | undefined>(undefined);
  refreshInterval = 30 * 1000;
  canRefresh = signal(false);
  refreshing = signal(false);
  isInitialLoading = signal(true);
  private lineColor = '';
  isFavorite = signal(true);
  favoriteStop: Favorite | undefined;
  favorited = signal(false);
  lastRefreshed = signal<Date | null>(null);

  ngOnInit(): void {
    this.activatedRoute.params.pipe(
      tap(params => {
        this.canRefresh.set(true);
        this.isInitialLoading.set(true);
        this.errorMsg.set(undefined);
        this.arrivalGroups.set(null);
        this.routeId.set(params['routeId']);
        this.stationId.set(params['stationId']);
        this.stationName.set(params['stationName']);

        const cssVar = TRAIN_LINE_CSS_MAP[this.routeId()];
        if (cssVar) {
          this.lineColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
        }

        const tempFavoriteStop: Favorite = {
          route: this.routeId(),
          stopId: +this.stationId(),
          stopName: this.stationName(),
          direction: '',
          type: 'train'
        };
        this.favoritesService.search(tempFavoriteStop)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((index: number) => {
            this.isFavorite.set(index >= 0);
          });
        this.favoriteStop = tempFavoriteStop;
      }),
      switchMap(() => timer(0, this.refreshInterval)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.getArrivals());
  }

  getArrivals(): void {
    if (!this.refreshing()) {
      this.trainService.arrivals(this.stationId()).subscribe((response: TrainApiResponse) => {
        this.handleResponse(response);
      });
    }
  }

  handleResponse(response: TrainApiResponse): void {
    this.isInitialLoading.set(false);
    this.refreshing.set(true);
    this.lastRefreshed.set(new Date());

    if (response.ctatt.errCd !== '0' && response.ctatt.errNm) {
      this.errorMsg.set(response.ctatt.errNm);
      this.arrivalGroups.set(null);
    } else if (response.ctatt.eta && response.ctatt.eta.length > 0) {
      const filtered = response.ctatt.eta.filter(eta => eta.rt === this.routeId());
      if (filtered.length === 0) {
        this.errorMsg.set('No arrivals found');
        this.arrivalGroups.set(null);
        setTimeout(() => this.refreshing.set(false), 800);
        return;
      }
      const displays: TrainArrivalDisplay[] = filtered.map(eta => {
        const countdown = eta.isApp === '1'
          ? 'DUE'
          : this.computeCountdown(eta.prdt, eta.arrT);

        const cssVar = TRAIN_LINE_CSS_MAP[eta.rt];
        const lineColor = cssVar
          ? getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
          : this.lineColor;

        return { ...eta, countdown, lineColor };
      });

      // Group by direction using rt + trDr
      const groupMap = new Map<string, ArrivalGroup>();
      for (const arrival of displays) {
        const directionLabel = TRAIN_DIRECTION_MAP[arrival.rt]?.[arrival.trDr] ?? arrival.stpDe;
        const key = `${arrival.rt}_${arrival.trDr}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { directionLabel, arrivals: [] });
        }
        groupMap.get(key)!.arrivals.push(arrival);
      }

      const groups = Array.from(groupMap.values()).sort((a, b) =>
        a.directionLabel.localeCompare(b.directionLabel)
      );
      this.arrivalGroups.set(groups);
      this.errorMsg.set(undefined);
    } else {
      this.errorMsg.set('No arrivals found');
      this.arrivalGroups.set(null);
    }

    setTimeout(() => this.refreshing.set(false), 800);
    if (typeof window.navigator.vibrate !== 'undefined') {
      window.navigator.vibrate(5);
    }
  }

  computeCountdown(prdt: string, arrT: string): string {
    try {
      const predTime = new Date(prdt).getTime();
      const arrTime = new Date(arrT).getTime();
      const minutes = Math.round((arrTime - predTime) / 60000);
      return minutes > 1 ? String(minutes) : 'DUE';
    } catch {
      return '--';
    }
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
