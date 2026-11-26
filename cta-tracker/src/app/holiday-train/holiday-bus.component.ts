import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { ClockService } from '../services/clock.service';
import { formatClockTime } from '../services/arrival-time';
import { busStopCommands } from '../services/follow-stop-link';
import { BustimeResponse } from '../busResponse';
import { HOLIDAY_BUS_VEHICLE, HolidayBusStatus, holidayCountdown, readHolidayBus } from './holiday-train';

/**
 * The Holiday Bus on the Holiday Train screen: bus 4374, followed through the existing
 * `/busfollow` proxy on the same 30 s tick, with one tap into the regular bus follow screen.
 */
@Component({
  selector: 'app-holiday-bus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <article class="bus-card" [attr.data-state]="status()?.state ?? 'loading'">
      <header class="bus-head">
        <span class="bus-glyph" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <rect x="6" y="5" width="28" height="28" rx="7" class="body"/>
            <rect x="9" y="9" width="22" height="11" rx="3" class="glass"/>
            <rect x="12" y="6.2" width="16" height="2.2" rx="1" class="sign"/>
            <circle cx="20" cy="26" r="3.4" class="wreath"/>
            <circle cx="20" cy="26" r="1.2" class="berry"/>
            <circle cx="10.5" cy="28.5" r="1.6" class="lamp"/>
            <circle cx="29.5" cy="28.5" r="1.6" class="lamp"/>
            <rect x="9" y="33" width="5" height="3" rx="1" class="tyre"/>
            <rect x="26" y="33" width="5" height="3" rx="1" class="tyre"/>
          </svg>
        </span>
        <span class="bus-title">
          <span class="name">Holiday Bus</span>
          <span class="tag">Bus {{ vehicle }}</span>
        </span>
        <span class="pill" aria-live="polite">
          <span class="dot" aria-hidden="true"></span>
          @switch (status()?.state) {
            @case ('running') { Live }
            @case ('not-running') { Not running }
            @case ('unknown') { Can't check }
            @default { Checking… }
          }
        </span>
      </header>

      @if (running(); as bus) {
        <div class="route-row">
          <span class="route-badge">{{ bus.route }}</span>
          <span class="toward">{{ bus.direction }} to {{ bus.destination }}</span>
        </div>
        @if (next(); as stop) {
          <a class="next" [routerLink]="stop.link">
            <span class="next-text">
              <span class="kicker">Next stop</span>
              <span class="stop-name">{{ stop.name }}</span>
              <span class="clock">{{ stop.clock }}@if (stop.delayed) {<span class="late"> · Delayed</span>}</span>
            </span>
            <span class="count">{{ stop.countdown }}@if (stop.countdown !== 'Due' && stop.countdown !== '--') {<small> min</small>}</span>
          </a>
        }
        <a class="follow" [routerLink]="['/follow', vehicle]">Follow the Holiday Bus</a>
      } @else if (status()?.state === 'unknown') {
        <p class="copy">Bus Tracker isn't answering right now. Trying again in a moment.</p>
      } @else if (status()?.state === 'not-running') {
        <p class="copy">Not on the road right now. It visits about 20 bus routes through the season, and shows up here the moment it's in service.</p>
      }
    </article>
  `,
  styles: `
    :host { display: block; grid-column: 1 / 5; margin-bottom: 20px; }
    .bus-card {
      padding: 16px;
      border-radius: 22px;
      background: var(--surface-card);
      border: 1px solid var(--card-border);
      box-shadow: var(--card-shadow);
    }
    .bus-head { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; }
    .bus-glyph { width: 40px; height: 40px; }
    .bus-glyph svg { display: block; width: 100%; height: 100%; }
    .body { fill: #e9ecf1; stroke: rgba(0, 0, 0, 0.25); stroke-width: 0.6; }
    .glass { fill: #1b2230; }
    .sign { fill: #f5c86a; }
    .wreath { fill: none; stroke: #1f8a4c; stroke-width: 2.2; }
    .berry { fill: #e0283f; }
    .lamp { fill: #fff6c4; }
    .tyre { fill: #4b515c; }
    .bus-title { display: grid; min-width: 0; }
    .name { font-size: 20px; font-weight: 700; letter-spacing: -0.015em; }
    .tag {
      justify-self: start;
      margin-top: 2px;
      font-family: var(--mono-font);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 8px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      background: var(--surface-elevated);
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-tertiary); }
    [data-state="running"] .dot { background: #34c759; box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.25); }
    [data-state="unknown"] .dot { background: #ff9f0a; }
    .route-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 16px 0 8px; }
    .route-badge {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--bus-badge-text);
      background: var(--bus-badge);
    }
    .toward { font-size: 16px; font-weight: 600; color: var(--text-secondary); }
    .next {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 0;
      color: inherit;
      text-decoration: none;
    }
    .next-text { display: grid; gap: 1px; min-width: 0; }
    .kicker {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-tertiary);
    }
    .stop-name { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; overflow-wrap: anywhere; }
    .clock { font-size: 14px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .late { color: var(--status-scheduled); font-weight: 600; }
    .count {
      flex-shrink: 0;
      font-family: var(--numeral-font);
      font-size: 40px;
      line-height: 1;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .count small { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
    .follow {
      display: block;
      margin-top: 4px;
      padding: 14px 16px;
      border-radius: 14px;
      text-align: center;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      text-decoration: none;
      background: linear-gradient(180deg, #e0283f, #b8132c);
      box-shadow: 0 6px 16px -8px rgba(198, 12, 48, 0.7), 0 0 0 0.5px rgba(255, 255, 255, 0.2) inset;
      transition: transform 80ms ease, filter var(--duration-short) var(--ease-standard);
    }
    .follow:hover { filter: brightness(1.06); }
    .follow:active { transform: scale(0.98); }
    .copy { margin-top: 12px; font-size: 15px; line-height: 1.45; color: var(--text-secondary); }
  `
})
export class HolidayBusComponent {
  private readonly busService = inject(BusService);
  private readonly clock = inject(ClockService);
  readonly vehicle = HOLIDAY_BUS_VEHICLE;

  private readonly followResource = httpResource<BustimeResponse>(() =>
    this.busService.followUrl(+HOLIDAY_BUS_VEHICLE));
  private readonly lastRefreshed = signal<number | null>(null);

  readonly status = computed<HolidayBusStatus | null>(() => {
    if (this.followResource.error()) {
      return { state: 'unknown', message: "Couldn't reach Bus Tracker." };
    }
    return this.followResource.hasValue()
      ? readHolidayBus(this.followResource.value(), this.lastRefreshed() ?? Date.now())
      : null;
  });

  readonly running = computed(() => {
    const status = this.status();
    return status?.state === 'running' ? status : null;
  });

  readonly next = computed(() => {
    const stop = this.running()?.stops[0];
    if (!stop) {
      return null;
    }
    return {
      ...stop,
      countdown: holidayCountdown(stop.arrivalEpochMs, this.clock.now(), stop.prd.prdctdn === 'DUE'),
      clock: formatClockTime(stop.arrivalEpochMs),
      link: busStopCommands(stop.prd)
    };
  });

  constructor() {
    effect(() => {
      if (this.followResource.status() === 'resolved') {
        this.lastRefreshed.set(Date.now());
      }
    });
    const intervalId = setInterval(() => this.followResource.reload(), 30 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  refresh(): void {
    this.followResource.reload();
  }
}
