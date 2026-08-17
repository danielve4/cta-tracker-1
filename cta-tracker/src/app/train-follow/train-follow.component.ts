import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { TrainService } from '../services/train.service';
import { ClockService } from '../services/clock.service';
import { DisplayPreferencesService } from '../services/display-preferences.service';
import { parseTrainTime, formatClockTime, countdownLabel } from '../services/arrival-time';
import { TrainApiResponse, TrainEta, TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { TimeuntilPipe } from '../timeuntil.pipe';

interface TrainStopDisplay extends TrainEta {
  countdown: string;
  apiArrivalTime: string;
}

@Component({
  selector: 'app-train-follow',
  templateUrl: './train-follow.component.html',
  styleUrls: ['./train-follow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeuntilPipe]
})
export class TrainFollowComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly trainService = inject(TrainService);
  private readonly clock = inject(ClockService);
  protected readonly prefs = inject(DisplayPreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly refreshInterval = 30 * 1000;
  readonly placeholderRows = [0, 1, 2, 3];

  private readonly routeParams = toSignal(this.activatedRoute.paramMap,
    { initialValue: this.activatedRoute.snapshot.paramMap });
  private readonly queryParams = toSignal(this.activatedRoute.queryParamMap,
    { initialValue: this.activatedRoute.snapshot.queryParamMap });
  runNumber = computed(() => this.routeParams().get('runNumber') ?? '');
  fromStationId = computed(() => this.queryParams().get('from') ?? '');
  private readonly routeCode = computed(() => this.queryParams().get('rt') ?? '');

  private readonly followResource = httpResource<TrainApiResponse>(() => {
    const run = this.runNumber();
    return run ? this.trainService.followUrl(run) : undefined;
  });

  private readonly response = computed(() =>
    this.followResource.hasValue() ? this.followResource.value() : undefined);

  predictions = computed<TrainStopDisplay[] | null>(() => {
    const response = this.response();
    if (!response || (response.ctatt.errCd !== '0' && response.ctatt.errNm)) {
      return null;
    }
    const etas = response.ctatt.eta;
    if (!etas || etas.length === 0) {
      return null;
    }
    const receivedAt = this.lastRefreshed()?.getTime() ?? Date.now();
    const now = this.clock.now();
    const responseTime = parseTrainTime(response.ctatt.tmst);

    return etas.map(eta => {
      const arrivalTime = parseTrainTime(eta.arrT);
      // tmst is the response-level "as of"; prdt is the per-prediction fallback.
      const apiNow = isNaN(responseTime) ? parseTrainTime(eta.prdt) : responseTime;
      const arrivalEpochMs = receivedAt + (arrivalTime - apiNow);
      return {
        ...eta,
        countdown: eta.isApp === '1' ? 'DUE' : countdownLabel(arrivalEpochMs - now),
        apiArrivalTime: formatClockTime(arrivalTime)
      };
    });
  });

  routeName = computed(() => this.response()?.ctatt.eta?.[0]?.rt ?? '');
  destination = computed(() => this.response()?.ctatt.eta?.[0]?.destNm ?? '');

  lineColor = computed(() => {
    const fromQuery = this.lineColorFor(this.routeCode());
    if (fromQuery) {
      return fromQuery;
    }
    const rt = this.response()?.ctatt.eta?.[0]?.rt;
    return rt ? this.lineColorFor(rt) : '';
  });

  errorMsg = computed<string | undefined>(() => {
    if (this.followResource.error()) {
      return 'Network error';
    }
    const response = this.response();
    if (!response) {
      return undefined;
    }
    if (response.ctatt.errCd !== '0' && response.ctatt.errNm) {
      return response.ctatt.errNm;
    }
    const etas = response.ctatt.eta;
    if (!etas || etas.length === 0) {
      return 'No predictions found';
    }
    return undefined;
  });

  refreshing = computed(() => this.followResource.isLoading());
  canRefresh = computed(() => this.runNumber() !== '');
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

  private lineColorFor(rt: string): string {
    const cssVar = TRAIN_LINE_CSS_MAP[rt];
    return cssVar ? `var(${cssVar})` : '';
  }
}
