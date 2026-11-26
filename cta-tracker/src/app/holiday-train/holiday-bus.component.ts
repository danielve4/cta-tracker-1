import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { BusService } from '../services/bus.service';
import { ClockService } from '../services/clock.service';
import { formatClockTime } from '../services/arrival-time';
import { busStopCommands } from '../services/follow-stop-link';
import { BustimeResponse } from '../busResponse';
import { HolidayLightsComponent } from './holiday-lights.component';
import { HolidayJourneyComponent, HolidayStopRow } from './holiday-journey.component';
import { HOLIDAY_BUS_VEHICLE, HolidayBusStatus, holidayCountdown, readHolidayBus } from './holiday-train';

/**
 * The Holiday Bus on the Holiday Train & Bus screen: bus 4374, followed through the existing
 * `/busfollow` proxy on the same 30 s tick, drawn with the train's hero (`holiday-hero.css`) and
 * journey strip, tinted CTA red, with one tap into the regular bus follow screen.
 */
@Component({
  selector: 'app-holiday-bus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HolidayLightsComponent, HolidayJourneyComponent],
  styleUrls: ['./holiday-hero.css'],
  styles: `
    :host { display: block; grid-column: 1 / 5; --line: var(--cta-red); }
    .journey { margin-bottom: 20px; }
  `,
  template: `
    <section class="hero" [attr.data-state]="status()?.state ?? 'loading'"
             [style.--line]="running() ? null : 'var(--evergreen)'">
      <app-holiday-lights class="hero-lights" [count]="14" />
      <div class="snow" aria-hidden="true"></div>

      <div class="hero-body">
        <h2 class="hero-name">Holiday Bus</h2>
        <div class="hero-meta">
          <span class="status-pill" aria-live="polite">
            <span class="status-dot" aria-hidden="true"></span>
            @switch (status()?.state) {
              @case ('running') { Live }
              @case ('not-running') { Not running }
              @case ('unknown') { Can't check }
              @default { Checking… }
            }
          </span>
          <span class="run-tag" aria-label="Bus number {{ vehicle }}">Bus {{ vehicle }}</span>
        </div>

        @switch (status()?.state) {
          @case ('running') {
            @if (running(); as bus) {
              <div class="line-row">
                <span class="line-pill">{{ bus.route }}</span>
                <span class="toward">{{ bus.direction }} to {{ bus.destination }}</span>
              </div>
              @if (next(); as stop) {
                <div class="next-row">
                  <div class="next-text">
                    <span class="kicker">Next stop</span>
                    <span class="next-name">{{ stop.name }}</span>
                    <span class="next-clock">
                      {{ stop.clock }}
                      @if (stop.delayed) {
                        <span class="late">· Delayed</span>
                      }
                    </span>
                  </div>
                  <div class="countdown" [class.due]="stop.countdown === 'Due'">
                    <span class="num">{{ stop.countdown }}</span>
                    @if (stop.countdown !== 'Due' && stop.countdown !== '--') {
                      <span class="unit">min</span>
                    }
                  </div>
                </div>
                <div class="hero-actions">
                  @if (stop.link) {
                    <a class="hero-action" [routerLink]="stop.link">
                      <span>Arrivals at {{ stop.name }}</span>
                      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                    </a>
                  }
                  <a class="hero-action" [routerLink]="['/follow', vehicle]">
                    <span>Follow bus {{ vehicle }}</span>
                    <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                  </a>
                </div>
              }
            }
          }
          @case ('not-running') {
            <div class="ornament" aria-hidden="true">
              <svg viewBox="0 0 64 72">
                <defs>
                  <radialGradient id="bauble-bus" cx="38%" cy="34%" r="70%">
                    <stop offset="0" stop-color="#b8f0c8"/>
                    <stop offset="0.45" stop-color="#1f8a4c"/>
                    <stop offset="1" stop-color="#0b3d21"/>
                  </radialGradient>
                </defs>
                <path class="ornament-hook" d="M32 2c-3 0-4 2-4 4s1.5 3 4 3"/>
                <rect x="25" y="8" width="14" height="9" rx="2" class="ornament-cap"/>
                <circle cx="32" cy="44" r="26" fill="url(#bauble-bus)"/>
                <path d="M8 40c8 4 40 4 48 0" class="ornament-band"/>
                <path d="M7.5 48c8 4 41 4 49 0" class="ornament-band thin"/>
                <ellipse cx="23" cy="33" rx="6" ry="3.5" fill="#fff" opacity="0.35" transform="rotate(-30 23 33)"/>
              </svg>
            </div>
            <h3 class="hero-title">Not on the road right now</h3>
            <p class="hero-copy">The Holiday Bus visits different routes through the season. Keep this open and it lights up the moment bus {{ vehicle }} shows up in Bus Tracker.</p>
          }
          @case ('unknown') {
            <h3 class="hero-title">Can't check right now</h3>
            <p class="hero-copy">Couldn't reach Bus Tracker. Trying again in a moment.</p>
          }
          @default {
            <div class="hero-skeleton" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
          }
        }
      </div>
    </section>

    @if (stops().length) {
      <section class="journey" aria-label="Holiday Bus stops">
        <app-holiday-journey vehicle="bus" [stops]="stops()" />
      </section>
    }
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

  readonly stops = computed<HolidayStopRow[]>(() => {
    const now = this.clock.now();
    return (this.running()?.stops ?? []).map(stop => ({
      id: stop.stpid,
      name: stop.name,
      delayed: stop.delayed,
      countdown: holidayCountdown(stop.arrivalEpochMs, now, stop.prd.prdctdn === 'DUE'),
      clock: formatClockTime(stop.arrivalEpochMs),
      link: busStopCommands(stop.prd)
    }));
  });

  readonly next = computed(() => this.stops()[0] ?? null);

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
