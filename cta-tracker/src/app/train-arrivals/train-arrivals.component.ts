import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { TrainService } from '../services/train.service';
import { TrainApiResponse, TrainEta, TRAIN_LINE_CSS_MAP, TRAIN_DIRECTION_MAP } from '../trainResponse';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { of, Observable, timer, Subscription } from 'rxjs';
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
  imports: [AsyncPipe, DatePipe, TimeuntilPipe, RouterLink]
})
export class TrainArrivalsComponent implements OnInit, OnDestroy {
  readonly skeletonCards = [0, 1, 2];
  routeId = '';
  stationId = '';
  stationName = '';
  arrivalGroups$: Observable<ArrivalGroup[]> | undefined;
  errorMsg: string | undefined;
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  canRefresh = false;
  refreshing = false;
  isInitialLoading = true;
  lineColor = '';
  isFavorite = true;
  favoriteStop: Favorite | undefined;
  favorited = false;
  lastRefreshed: Date | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private trainService: TrainService,
    private favoritesService: FavoritesService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      this.canRefresh = true;
      this.isInitialLoading = true;
      this.errorMsg = undefined;
      this.arrivalGroups$ = undefined;
      this.routeId = params['routeId'];
      this.stationId = params['stationId'];
      this.stationName = params['stationName'];

      const cssVar = TRAIN_LINE_CSS_MAP[this.routeId];
      if (cssVar) {
        this.lineColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
      }

      const tempFavoriteStop: Favorite = {
        route: this.routeId,
        stopId: +this.stationId,
        stopName: this.stationName,
        direction: '',
        type: 'train'
      };
      this.favoritesService.search(tempFavoriteStop).subscribe((index: number) => {
        this.isFavorite = index >= 0;
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
    if (!this.refreshing) {
      this.trainService.arrivals(this.stationId).subscribe((response: TrainApiResponse) => {
        this.handleResponse(response);
      });
    }
  }

  handleResponse(response: TrainApiResponse): void {
    this.isInitialLoading = false;
    this.refreshing = true;
    this.lastRefreshed = new Date();

    if (response.ctatt.errCd !== '0' && response.ctatt.errNm) {
      this.errorMsg = response.ctatt.errNm;
      this.arrivalGroups$ = undefined;
    } else if (response.ctatt.eta && response.ctatt.eta.length > 0) {
      const filtered = response.ctatt.eta.filter(eta => eta.rt === this.routeId);
      if (filtered.length === 0) {
        this.errorMsg = 'No arrivals found';
        this.arrivalGroups$ = undefined;
        setTimeout(() => this.refreshing = false, 800);
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
      this.arrivalGroups$ = of(groups);
      this.errorMsg = undefined;
    } else {
      this.errorMsg = 'No arrivals found';
      this.arrivalGroups$ = undefined;
    }

    setTimeout(() => this.refreshing = false, 800);
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
      this.favoritesService.addToFavorites(this.favoriteStop).subscribe((wasAdded: boolean) => {
        this.favorited = wasAdded;
        setTimeout(() => {
          this.isFavorite = wasAdded;
        }, 300);
      });
    }
  }
}
