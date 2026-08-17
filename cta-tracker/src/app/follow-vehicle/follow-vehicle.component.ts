import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { BusService } from '../services/bus.service';
import { ClockService } from '../services/clock.service';
import { DisplayPreferencesService } from '../services/display-preferences.service';
import { busArrivalTimes } from '../services/arrival-time';
import { formatDistance } from '../services/distance';
import { BustimeResponse, Prd, Error } from '../busResponse';
import { TimeuntilPipe } from '../timeuntil.pipe';

interface BusPredictionDisplay extends Prd {
  apiArrivalTime: string;
  distance: string;
}

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
  private readonly clock = inject(ClockService);
  protected readonly prefs = inject(DisplayPreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly refreshInterval = 30 * 1000;
  readonly placeholderRows = [0, 1, 2, 3];

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

  predictions = computed<BusPredictionDisplay[] | null>(() => {
    const response = this.response();
    if (!response || response.error || !response.prd) {
      return null;
    }
    const receivedAt = this.lastRefreshed()?.getTime() ?? Date.now();
    const now = this.clock.now();
    return response.prd.map(p => ({
      ...p,
      ...busArrivalTimes(p, receivedAt, now),
      // dstp is linear feet remaining along the route pattern, straight from the API.
      distance: formatDistance(p.dstp)
    }));
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
  lastRefreshed = signal<Date | null>(null);

  constructor() {
    effect(() => {
      if (this.followResource.status() === 'resolved') {
        this.lastRefreshed.set(new Date());
        if (typeof navigator.vibrate !== 'undefined') {
          navigator.vibrate(5);
        }
      }
    });

    const intervalId = setInterval(() => this.followResource.reload(), this.refreshInterval);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  getFollowData(): void {
    this.followResource.reload();
  }
}
