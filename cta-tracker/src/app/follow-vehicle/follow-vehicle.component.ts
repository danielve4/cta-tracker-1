import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { timer, Subscription } from 'rxjs';
import { TimeuntilPipe } from '../timeuntil.pipe';

@Component({
  selector: 'app-follow-vehicle',
  templateUrl: './follow-vehicle.component.html',
  styleUrls: ['./follow-vehicle.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeuntilPipe]
})
export class FollowVehicleComponent implements OnInit, OnDestroy {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);
  private readonly destroyRef = inject(DestroyRef);

  vehicleId = signal(0);
  fromStopId = signal('');
  routeNumber = signal('');
  direction = signal('');
  destination = signal('');
  predictions = signal<Prd[] | null>(null);
  error = signal<Error[] | null>(null);
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  canRefresh = signal(false);
  refreshing = signal(false);

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(qp => {
      this.fromStopId.set(qp['from'] || '');
    });
    this.activatedRoute.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.canRefresh.set(true);
      this.vehicleId.set(+params['vehicleId']);
      this.timerRef = timer(0, this.refreshInterval).subscribe(() => {
        this.getFollowData();
      });
    });
  }

  ngOnDestroy(): void {
    this.timerRef?.unsubscribe();
  }

  getFollowData(): void {
    if (!this.refreshing()) {
      this.busService.follow(this.vehicleId()).subscribe((response: BustimeResponse) => {
        this.handleResponse(response);
      });
    }
  }

  handleResponse(response: BustimeResponse): void {
    this.refreshing.set(true);
    if (response.error) {
      this.error.set(response.error);
    } else if (response.prd) {
      if (response.prd.length > 0) {
        this.routeNumber.set(response.prd[0].rt);
        this.direction.set(response.prd[0].rtdir);
        this.destination.set(response.prd[0].des);
      }
      for (let i = 0; i < response.prd.length; i++) {
        if (response.prd[i].dly) {
          response.prd[i].prdctdn = this.getMinutesDifference(
            response.prd[i].tmstmp,
            response.prd[i].prdtm);
        }
      }
      this.predictions.set(response.prd);
    }
    setTimeout(() => this.refreshing.set(false), 500);
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
