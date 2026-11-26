import { Component, ChangeDetectionStrategy, computed, inject, signal, afterNextRender, DestroyRef } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TrainService } from '../services/train.service';
import { BusService } from '../services/bus.service';
import { ClockService } from '../services/clock.service';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { BustimeResponse } from '../busResponse';
import { TrainApiResponse, TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { HolidayLightsComponent } from './holiday-lights.component';
import {
  HOLIDAY_BUS_VEHICLE,
  HOLIDAY_TRAIN_RUN,
  favoriteHitLabel,
  holidayHitsForFavorites,
  readHolidayBus,
  readHolidayTrain
} from './holiday-train';
import {
  BUS_WATCH_PADDING,
  HOLIDAY_BUS_SCHEDULE,
  HOLIDAY_TRAIN_SCHEDULE,
  TRAIN_WATCH_PADDING,
  busRoutesLabel,
  scheduleView,
  scheduledToday,
  timeSpanLabel,
  trainLinesLabel
} from './holiday-schedule';

/**
 * The seasonal way into the Holiday Train & Bus screen, on Routes and Favorites (the two screens a
 * launch lands on). It shows only on days CTA's Holiday Fleet schedule has the train or the bus
 * out, until that day's run is over, and asks the live trackers only inside their scheduled
 * windows. It renders nothing until after the first render: Routes and Favorites are prerendered,
 * and the schedule and both vehicles depend on when the page is opened, not when it was built.
 */
@Component({
  selector: 'app-holiday-train-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HolidayLightsComponent],
  template: `
    @if (visible()) {
      <a class="card" [routerLink]="link()" [attr.data-live]="lineName() || busRoute() ? '' : null"
         [style.--line]="lineColor() || null">
        <app-holiday-lights class="lights" [count]="10" />
        <span class="glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path class="tree" d="M12 4.5l4.5 6h-2.6l3.6 5h-2.8l3.3 4.5H6l3.3-4.5H6.5l3.6-5H7.5z"/><rect class="trunk" x="10.8" y="20" width="2.4" height="2.5" rx="0.6"/><path class="star" d="M12 .8l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 2.9l2-.3z"/></svg>
        </span>
        <span class="text">
          <span class="title">{{ hitLabel() ? 'Coming to your stop' : 'Holiday Train & Bus' }}</span>
          <span class="sub">
            @if (hitLabel(); as hit) {
              <span class="live-dot" aria-hidden="true"></span> {{ hit }}
            } @else if (lineName(); as line) {
              <span class="live-dot" aria-hidden="true"></span> Holiday Train running on the {{ line }}
            } @else if (busRoute(); as route) {
              <span class="live-dot" aria-hidden="true"></span> Holiday Bus running on route {{ route }}
            } @else {
              {{ todayLabel() }}
            }
          </span>
        </span>
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </a>
    }
  `,
  styles: `
    :host {
      display: block;
      grid-column: 1 / 5;
    }
    .card {
      --accent: var(--line, #1f6f43);
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 20px 16px 14px;
      border-radius: 20px;
      color: #fff;
      text-decoration: none;
      background:
        radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--accent) 60%, transparent), transparent 65%),
        linear-gradient(150deg, color-mix(in srgb, var(--accent) 30%, #0b0d12), #07080b);
      box-shadow: 0 12px 28px -18px color-mix(in srgb, var(--accent) 80%, transparent),
        0 0 0 0.5px rgba(255, 255, 255, 0.1) inset;
      transition: transform 80ms ease;
    }
    .card:active { transform: scale(0.985); }
    .lights {
      position: absolute;
      inset: 0 10px auto;
    }
    .glyph {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.12);
    }
    .glyph svg { width: 24px; height: 24px; }
    .glyph .tree { fill: #34c759; }
    .glyph .trunk { fill: #a0714a; }
    .glyph .star { fill: #f5c86a; }
    .text { display: grid; gap: 1px; min-width: 0; }
    .title { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    .sub {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.75);
    }
    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34c759;
      box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.25);
    }
    .chevron {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.6;
    }
  `
})
export class HolidayTrainCardComponent {
  private readonly trainService = inject(TrainService);
  private readonly busService = inject(BusService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly clock = inject(ClockService);

  /** Set after the first render, so the prerendered page and its hydration match. */
  private readonly ready = signal(false);

  private readonly trainSchedule = computed(() =>
    scheduleView(HOLIDAY_TRAIN_SCHEDULE, this.clock.now(), TRAIN_WATCH_PADDING));
  private readonly busSchedule = computed(() =>
    scheduleView(HOLIDAY_BUS_SCHEDULE, this.clock.now(), BUS_WATCH_PADDING));
  private readonly watchingTrain = computed(() => this.ready() && this.trainSchedule().watching);
  private readonly watchingBus = computed(() => this.ready() && this.busSchedule().watching);

  /** One look when a scheduled window opens, then once a minute while the card stays on screen. */
  private readonly followResource = httpResource<TrainApiResponse>(() =>
    this.watchingTrain() ? this.trainService.followUrl(HOLIDAY_TRAIN_RUN) : undefined);

  private readonly busResource = httpResource<BustimeResponse>(() =>
    this.watchingBus() ? this.busService.followUrl(+HOLIDAY_BUS_VEHICLE) : undefined);

  /** Read from localStorage after the first render, like the season. */
  private readonly favorites = signal<Favorite[]>([]);

  private readonly status = computed(() => this.watchingTrain() && this.followResource.hasValue()
    ? readHolidayTrain(this.followResource.value(), Date.now(), null)
    : null);

  private readonly busStatus = computed(() => this.watchingBus() && this.busResource.hasValue()
    ? readHolidayBus(this.busResource.value(), Date.now())
    : null);

  /** The soonest of the two headed to one of the user's favorite stops in the next half hour. */
  private readonly hit = computed(() =>
    holidayHitsForFavorites(this.favorites(), this.status(), this.busStatus(), this.clock.now())[0] ?? null);

  readonly hitLabel = computed(() => {
    const hit = this.hit();
    return hit ? favoriteHitLabel(hit, this.clock.now()) : '';
  });

  /** The bus near a favorite opens its follow screen; everything else opens the holiday screen. */
  readonly link = computed(() => this.hit()?.kind === 'bus'
    ? ['/follow', HOLIDAY_BUS_VEHICLE]
    : ['/holiday-train']);

  readonly busRoute = computed(() => {
    const bus = this.busStatus();
    return bus?.state === 'running' ? bus.route : '';
  });

  readonly visible = computed(() => {
    const now = this.clock.now();
    return this.ready() && (scheduledToday(this.trainSchedule(), now) || scheduledToday(this.busSchedule(), now));
  });

  /** Today's scheduled run that ends soonest and is not over: `Holiday Train today, 3:00 to 5:17 PM, Orange & Green Lines`. */
  readonly todayLabel = computed(() => {
    const now = this.clock.now();
    const train = this.trainSchedule();
    const bus = this.busSchedule();
    const runs = [
      scheduledToday(train, now) && train.today
        ? { at: train.today.watchUntilMs, label: `Holiday Train today, ${timeSpanLabel(train.today.startMs, train.today.endMs)}, ${trainLinesLabel(train.today.day.lines)}` }
        : null,
      scheduledToday(bus, now) && bus.today
        ? { at: bus.today.watchUntilMs, label: `Holiday Bus today, ${timeSpanLabel(bus.today.startMs, bus.today.endMs)}, ${busRoutesLabel(bus.today.day.routes)}` }
        : null
    ].filter(run => run !== null).sort((a, b) => a.at - b.at);
    return runs[0]?.label ?? '';
  });

  readonly lineName = computed(() => {
    const status = this.status();
    return status?.state === 'running' || status?.state === 'resting' ? status.lineName : '';
  });

  readonly lineColor = computed(() => {
    const status = this.status();
    const code = status?.state === 'running' || status?.state === 'resting' ? status.routeCode : '';
    const cssVar = TRAIN_LINE_CSS_MAP[code];
    if (cssVar) {
      return `var(${cssVar})`;
    }
    return this.busRoute() ? 'var(--cta-red)' : '';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.favoritesService.getFavorites().subscribe(favorites => this.favorites.set(favorites));
      this.ready.set(true);
      const intervalId = setInterval(() => {
        if (this.watchingTrain()) {
          this.followResource.reload();
        }
        if (this.watchingBus()) {
          this.busResource.reload();
        }
      }, 60 * 1000);
      destroyRef.onDestroy(() => clearInterval(intervalId));
    });
  }
}
