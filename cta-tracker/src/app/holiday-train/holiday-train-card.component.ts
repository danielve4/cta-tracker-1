import { Component, ChangeDetectionStrategy, computed, inject, signal, afterNextRender, DestroyRef } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TrainService } from '../services/train.service';
import { TrainApiResponse, TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { HolidayLightsComponent } from './holiday-lights.component';
import { HOLIDAY_TRAIN_RUN, isHolidaySeason, readHolidayTrain } from './holiday-train';

/**
 * The seasonal way into the Holiday Train screen, on Routes and Favorites (the two screens a
 * launch lands on). It renders nothing outside the season, and nothing at all until after the
 * first render: Routes and Favorites are prerendered, and the season and the train both depend on
 * when the page is opened, not when it was built.
 */
@Component({
  selector: 'app-holiday-train-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HolidayLightsComponent],
  template: `
    @if (visible()) {
      <a class="card" routerLink="/holiday-train" [attr.data-live]="lineName() ? '' : null"
         [style.--line]="lineColor() || null">
        <app-holiday-lights class="lights" [count]="10" />
        <span class="glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path class="tree" d="M12 4.5l4.5 6h-2.6l3.6 5h-2.8l3.3 4.5H6l3.3-4.5H6.5l3.6-5H7.5z"/><rect class="trunk" x="10.8" y="20" width="2.4" height="2.5" rx="0.6"/><path class="star" d="M12 .8l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 2.9l2-.3z"/></svg>
        </span>
        <span class="text">
          <span class="title">Holiday Train</span>
          <span class="sub">
            @if (lineName(); as line) {
              <span class="live-dot" aria-hidden="true"></span> Running now on the {{ line }}
            } @else {
              Track it live this season
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

  /** Set after the first render, so the prerendered page and its hydration match. */
  private readonly inSeason = signal(false);

  /** One look when the card appears, then once a minute while it stays on screen. */
  private readonly followResource = httpResource<TrainApiResponse>(() =>
    this.inSeason() ? this.trainService.followUrl(HOLIDAY_TRAIN_RUN) : undefined);

  private readonly status = computed(() => this.followResource.hasValue()
    ? readHolidayTrain(this.followResource.value(), Date.now(), null)
    : null);

  readonly visible = this.inSeason.asReadonly();

  readonly lineName = computed(() => {
    const status = this.status();
    return status?.state === 'running' || status?.state === 'resting' ? status.lineName : '';
  });

  readonly lineColor = computed(() => {
    const status = this.status();
    const code = status?.state === 'running' || status?.state === 'resting' ? status.routeCode : '';
    const cssVar = TRAIN_LINE_CSS_MAP[code];
    return cssVar ? `var(${cssVar})` : '';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!isHolidaySeason(new Date())) {
        return;
      }
      this.inSeason.set(true);
      const intervalId = setInterval(() => this.followResource.reload(), 60 * 1000);
      destroyRef.onDestroy(() => clearInterval(intervalId));
    });
  }
}
