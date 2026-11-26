import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TrainService } from '../services/train.service';
import { ClockService } from '../services/clock.service';
import { formatClockTime } from '../services/arrival-time';
import { trainStationCommands } from '../services/follow-stop-link';
import { TrainApiResponse, TRAIN_LINE_CSS_MAP, TRAIN_LINE_TEXT_COLOR_MAP } from '../trainResponse';
import { HolidayLightsComponent } from './holiday-lights.component';
import { HolidayJourneyComponent, HolidayStopRow } from './holiday-journey.component';
import { HolidayBusComponent } from './holiday-bus.component';
import {
  HOLIDAY_TRAIN_RUN,
  HolidayTrainStatus,
  christmasCountdownLabel,
  holidayCountdown,
  readHolidayTrain
} from './holiday-train';

/**
 * The Holiday Train, live. Follows run #1225 through the existing `/trainfollow` proxy on the
 * same 30 s tick as the other follow screen, and says plainly when it is not out today.
 */
@Component({
  selector: 'app-holiday-train',
  templateUrl: './holiday-train.component.html',
  styleUrls: ['./holiday-train.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HolidayLightsComponent, HolidayJourneyComponent, HolidayBusComponent]
})
export class HolidayTrainComponent {
  private readonly trainService = inject(TrainService);
  private readonly clock = inject(ClockService);

  private readonly refreshInterval = 30 * 1000;
  readonly run = HOLIDAY_TRAIN_RUN;

  private readonly followResource = httpResource<TrainApiResponse>(() =>
    this.trainService.followUrl(HOLIDAY_TRAIN_RUN));

  /** Station names and stop order, for "just left" on the journey. */
  private readonly comprehensiveData = toSignal(this.trainService.getComprehensiveData(),
    { initialValue: null });

  readonly lastRefreshed = signal<Date | null>(null);

  readonly status = computed<HolidayTrainStatus | null>(() => {
    if (this.followResource.error()) {
      return { state: 'unknown', message: "Couldn't reach Train Tracker." };
    }
    if (!this.followResource.hasValue()) {
      return null;
    }
    const receivedAt = this.lastRefreshed()?.getTime() ?? Date.now();
    return readHolidayTrain(this.followResource.value(), receivedAt, this.comprehensiveData());
  });

  readonly running = computed(() => {
    const status = this.status();
    return status?.state === 'running' ? status : null;
  });

  readonly stops = computed<HolidayStopRow[]>(() => {
    const running = this.running();
    if (!running) {
      return [];
    }
    const now = this.clock.now();
    return running.stops.map(stop => ({
      ...stop,
      countdown: holidayCountdown(stop.arrivalEpochMs, now, stop.approaching),
      clock: formatClockTime(stop.arrivalEpochMs),
      link: trainStationCommands(stop.eta, running.routeCode)
    }));
  });

  readonly nextStop = computed(() => this.stops()[0] ?? null);

  /** The line the train is on today, as a CSS colour; the festive red when it is not out. */
  readonly lineColor = computed(() => {
    const status = this.status();
    const code = status && (status.state === 'running' || status.state === 'resting') ? status.routeCode : '';
    const cssVar = TRAIN_LINE_CSS_MAP[code];
    return cssVar ? `var(${cssVar})` : '';
  });

  readonly lineInk = computed(() => {
    const status = this.status();
    const code = status && (status.state === 'running' || status.state === 'resting') ? status.routeCode : '';
    return TRAIN_LINE_TEXT_COLOR_MAP[code] ?? '#FFFFFF';
  });

  readonly christmasLabel = computed(() => christmasCountdownLabel(new Date(this.clock.now())));
  readonly updatedLabel = computed(() => {
    const at = this.lastRefreshed();
    return at ? `Updated ${formatClockTime(at.getTime())}` : '';
  });
  readonly refreshing = computed(() => this.followResource.isLoading());

  constructor() {
    effect(() => {
      if (this.followResource.status() === 'resolved') {
        this.lastRefreshed.set(new Date());
      }
    });

    const intervalId = setInterval(() => this.followResource.reload(), this.refreshInterval);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  refresh(): void {
    this.followResource.reload();
  }
}
