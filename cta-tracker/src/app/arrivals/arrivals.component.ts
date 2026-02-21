import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { of, Observable, timer, Subscription } from 'rxjs';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { TimeuntilPipe } from '../timeuntil.pipe';

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css'],
  imports: [AsyncPipe, TimeuntilPipe, RouterLink]
})
export class ArrivalsComponent implements OnInit, OnDestroy {
  readonly skeletonCards = [0, 1, 2];
  forRoute = '';
  forDirection = '';
  forStopId = 0;
  forStopName = '';
  vehicles$: Observable<Prd[]> | undefined;
  error$: Observable<Error[]> | undefined;
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  isFavorite = true;
  favoriteStop: Favorite | undefined;
  favorited = false;
  canRefresh = false;
  refreshing = false;
  isInitialLoading = true;

  constructor(
    private activatedRoute: ActivatedRoute,
    private busService: BusService,
    private favoritesService: FavoritesService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      this.canRefresh = true;
      this.isInitialLoading = true;
      this.error$ = undefined;
      this.vehicles$ = undefined;
      this.forRoute = params['route'];
      this.forDirection = params['direction'];
      this.forStopId = +params['stopId'];
      this.forStopName = params['stopName'];
      const tempFavoriteStop: Favorite = {
        route: this.forRoute,
        stopId: this.forStopId,
        stopName: this.forStopName,
        direction: this.forDirection
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
      this.busService.arrivals(this.forStopId).subscribe((response: BustimeResponse) => {
        this.handleArrivalsResponse(response);
      });
    }
  }

  handleArrivalsResponse(response: BustimeResponse): void {
    this.isInitialLoading = false;
    this.refreshing = true;
    if (response.error) {
      this.error$ = of(response.error);
      this.vehicles$ = undefined;
    } else if (response.prd) {
      for (let i = 0; i < response.prd.length; i++) {
        if (response.prd[i].dly) {
          response.prd[i].prdctdn = this.getMinutesDifference(
            response.prd[i].tmstmp,
            response.prd[i].prdtm);
        }
      }
      this.vehicles$ = of(response.prd);
      this.error$ = undefined;
    }
    setTimeout(() => this.refreshing = false, 800);
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
      this.favoritesService.addToFavorites(this.favoriteStop).subscribe((wasAdded: boolean) => {
        this.favorited = wasAdded;
        setTimeout(() => {
          this.isFavorite = wasAdded;
        }, 300);
      });
    }
  }
}
