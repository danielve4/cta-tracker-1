import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { of, Observable, timer, Subscription } from 'rxjs';
import { TimeuntilPipe } from '../timeuntil.pipe';

@Component({
  selector: 'app-follow-vehicle',
  templateUrl: './follow-vehicle.component.html',
  styleUrls: ['./follow-vehicle.component.css'],
  imports: [AsyncPipe, TimeuntilPipe]
})
export class FollowVehicleComponent implements OnInit, OnDestroy {
  vehicleId = 0;
  fromStopId = '';
  routeNumber = '';
  direction = '';
  destination = '';
  predictions$: Observable<Prd[]> | undefined;
  error$: Observable<Error[]> | undefined;
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  canRefresh = false;
  refreshing = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private busService: BusService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(qp => {
      this.fromStopId = qp['from'] || '';
    });
    this.activatedRoute.params.subscribe(params => {
      this.canRefresh = true;
      this.vehicleId = +params['vehicleId'];
      this.timerRef = timer(0, this.refreshInterval).subscribe(() => {
        this.getFollowData();
      });
    });
  }

  ngOnDestroy(): void {
    this.timerRef?.unsubscribe();
  }

  getFollowData(): void {
    if (!this.refreshing) {
      this.busService.follow(this.vehicleId).subscribe((response: BustimeResponse) => {
        this.handleResponse(response);
      });
    }
  }

  handleResponse(response: BustimeResponse): void {
    this.refreshing = true;
    if (response.error) {
      this.error$ = of(response.error);
    } else if (response.prd) {
      if (response.prd.length > 0) {
        this.routeNumber = response.prd[0].rt;
        this.direction = response.prd[0].rtdir;
        this.destination = response.prd[0].des;
      }
      for (let i = 0; i < response.prd.length; i++) {
        if (response.prd[i].dly) {
          response.prd[i].prdctdn = this.getMinutesDifference(
            response.prd[i].tmstmp,
            response.prd[i].prdtm);
        }
      }
      this.predictions$ = of(response.prd);
    }
    setTimeout(() => this.refreshing = false, 500);
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
}
