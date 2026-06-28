import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { BusService } from '../services/bus.service';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { TimeuntilPipe } from '../timeuntil.pipe';

@Component({
  selector: 'app-follow-vehicle',
  templateUrl: './follow-vehicle.component.html',
  styleUrls: ['./follow-vehicle.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeuntilPipe]
})
export class FollowVehicleComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly busService = inject(BusService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly refreshInterval = 30 * 1000;

  private readonly routeParams = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  private readonly queryParams = toSignal(this.activatedRoute.queryParamMap,
    { initialValue: this.activatedRoute.snapshot.queryParamMap });
  vehicleId = computed(() => +(this.routeParams().get('vehicleId') ?? 0));
  fromStopId = computed(() => this.queryParams().get('from') ?? '');

  private readonly followResource = httpResource<BustimeResponse>(() => {
    const id = this.vehicleId();
    return id ? this.busService.followUrl(id) : undefined;
  });

  private readonly response = computed(() =>
    this.followResource.hasValue() ? this.followResource.value() : undefined);

  predictions = computed<Prd[] | null>(() => {
    const response = this.response();
    if (!response || response.error || !response.prd) {
      return null;
    }
    return response.prd.map(p => p.dly ? { ...p, prdctdn: this.getMinutesDifference(p.tmstmp, p.prdtm) } : p);
  });

  routeNumber = computed(() => this.predictions()?.[0]?.rt ?? '');
  direction = computed(() => this.predictions()?.[0]?.rtdir ?? '');
  destination = computed(() => this.predictions()?.[0]?.des ?? '');

  error = computed<Error[] | null>(() => {
    if (this.followResource.error()) {
      return [{ stpid: '', msg: 'Network error' }];
    }
    return this.response()?.error ?? null;
  });

  refreshing = computed(() => this.followResource.isLoading());
  canRefresh = computed(() => this.vehicleId() > 0);

  constructor() {
    effect(() => {
      if (this.followResource.status() === 'resolved' && typeof navigator.vibrate !== 'undefined') {
        navigator.vibrate(5);
      }
    });

    const intervalId = setInterval(() => this.followResource.reload(), this.refreshInterval);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  getFollowData(): void {
    this.followResource.reload();
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
