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
import {
  HOLIDAY_SCHEDULE_YEAR,
  HOLIDAY_TRAIN_SCHEDULE,
  TRAIN_LINE_SHORT_NAMES,
  TRAIN_WATCH_PADDING,
  scheduleDayLabel,
  scheduleView,
  timeSpanLabel,
  trainLinesLabel
} from './holiday-schedule';

/**
 * The Holiday Train & Bus screen. Follows the train, run #1225, through the existing
 * `/trainfollow` proxy on the same 30 s tick as the other follow screen, says plainly when it is
 * not out today, and hosts the Holiday Bus (`holiday-bus.component`) in the same style below it.
 */
@Component({
  selector: 'app-holiday-train',
  templateUrl: './holiday-train.component.html',
  styleUrls: ['./holiday-hero.css', './holiday-train.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HolidayLightsComponent, HolidayJourneyComponent, HolidayBusComponent]
})
export class HolidayTrainComponent {
  private readonly trainService = inject(TrainService);
  private readonly clock = inject(ClockService);

  private readonly refreshInterval = 30 * 1000;
  readonly run = HOLIDAY_TRAIN_RUN;

  readonly scheduleYear = HOLIDAY_SCHEDULE_YEAR;

  /** CTA's published schedule; Train Tracker is only asked inside today's window. */
  readonly schedule = computed(() =>
    scheduleView(HOLIDAY_TRAIN_SCHEDULE, this.clock.now(), TRAIN_WATCH_PADDING));
  readonly watching = computed(() => this.schedule().watching);

  /** The next scheduled run, today's included, as the hero shows it outside the live window. */
  readonly plan = computed(() => {
    const view = this.schedule();
    const next = view.next;
    if (!next) {
      return null;
    }
    return {
      day: scheduleDayLabel(next.startMs, this.clock.now()),
      time: timeSpanLabel(next.startMs, next.endMs),
      linesLabel: trainLinesLabel(next.day.lines),
      lines: next.day.lines.map(code => ({
        code,
        name: TRAIN_LINE_SHORT_NAMES[code] ?? code,
        color: TRAIN_LINE_CSS_MAP[code] ? `var(${TRAIN_LINE_CSS_MAP[code]})` : '',
        ink: TRAIN_LINE_TEXT_COLOR_MAP[code] ?? '#FFFFFF'
      })),
      photos: next.day.photos ?? '',
      note: next.day.note ?? '',
      isToday: view.today?.day.date === next.day.date
    };
  });

  private readonly followResource = httpResource<TrainApiResponse>(() =>
    this.watching() ? this.trainService.followUrl(HOLIDAY_TRAIN_RUN) : undefined);

  /** Station names and stop order, for "just left" on the journey. */
  private readonly comprehensiveData = toSignal(this.trainService.getComprehensiveData(),
    { initialValue: null });

  readonly lastRefreshed = signal<Date | null>(null);

  readonly status = computed<HolidayTrainStatus | null>(() => {
    if (!this.watching()) {
      return null;
    }
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
      id: stop.staId,
      name: stop.name,
      delayed: stop.delayed,
      countdown: holidayCountdown(stop.arrivalEpochMs, now, stop.approaching),
      clock: formatClockTime(stop.arrivalEpochMs),
      link: trainStationCommands(stop.eta, running.routeCode)
    }));
  });

  readonly nextStop = computed(() => this.stops()[0] ?? null);

  /** The line the train is on, or is next scheduled on, as a CSS colour; '' (evergreen) otherwise. */
  private readonly heroLine = computed(() => {
    const status = this.status();
    if (status && (status.state === 'running' || status.state === 'resting')) {
      return status.routeCode;
    }
    return this.watching() ? '' : (this.plan()?.lines[0]?.code ?? '');
  });

  readonly lineColor = computed(() => {
    const cssVar = TRAIN_LINE_CSS_MAP[this.heroLine()];
    return cssVar ? `var(${cssVar})` : '';
  });

  readonly lineInk = computed(() => TRAIN_LINE_TEXT_COLOR_MAP[this.heroLine()] ?? '#FFFFFF');

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

    const intervalId = setInterval(() => {
      if (this.watching()) {
        this.followResource.reload();
      }
    }, this.refreshInterval);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  refresh(): void {
    if (this.watching()) {
      this.followResource.reload();
    }
  }
}
