import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

/**
 * A string of holiday lights, one bulb per 'L' line colour. Decorative only: `aria-hidden`, and
 * the twinkle stops under `prefers-reduced-motion`.
 */
const LINE_COLORS = [
  '--cta-red', '--cta-green', '--cta-blue', '--cta-yellow',
  '--cta-orange', '--cta-purple', '--cta-pink', '--cta-brown'
];

@Component({
  selector: 'app-holiday-lights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg class="wire" viewBox="0 0 100 10" preserveAspectRatio="none">
      <path d="M0 2 Q 6.25 8 12.5 2 T 25 2 T 37.5 2 T 50 2 T 62.5 2 T 75 2 T 87.5 2 T 100 2" />
    </svg>
    @for (bulb of bulbs(); track $index) {
      <span class="bulb" [style.left.%]="bulb.left" [style.top.px]="bulb.top"
            [style.--bulb]="bulb.color" [style.animationDelay.ms]="bulb.delay"></span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 22px;
      pointer-events: none;
    }
    .wire {
      position: absolute;
      inset: 0 0 auto;
      width: 100%;
      height: 10px;
      overflow: visible;
    }
    .wire path {
      fill: none;
      stroke: rgba(255, 255, 255, 0.22);
      stroke-width: 0.6;
      vector-effect: non-scaling-stroke;
    }
    .bulb {
      position: absolute;
      width: 8px;
      height: 12px;
      margin-left: -4px;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      background: radial-gradient(circle at 50% 35%, #fff 0 12%, var(--bulb) 45%);
      box-shadow: 0 0 6px 1px var(--bulb), 0 0 14px 2px var(--bulb);
      animation: twinkle 2.4s ease-in-out infinite;
    }
    .bulb::before {
      content: '';
      position: absolute;
      top: -3px;
      left: 2px;
      width: 4px;
      height: 3px;
      border-radius: 1px;
      background: rgba(255, 255, 255, 0.35);
    }
    @keyframes twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; box-shadow: 0 0 3px 0 var(--bulb); }
    }
    @media (prefers-reduced-motion: reduce) {
      .bulb { animation: none; }
    }
  `
})
export class HolidayLightsComponent {
  /** How many bulbs to hang; they cycle through the eight line colours. */
  readonly count = input(12);

  protected readonly bulbs = computed(() => {
    const count = this.count();
    return Array.from({ length: count }, (_, i) => {
      // The wire dips between every pair of hooks; bulbs hang from the low points and the hooks.
      const left = ((i + 0.5) / count) * 100;
      const phase = (left / 12.5) % 1;
      return {
        left,
        top: 2 + Math.round(Math.sin(phase * Math.PI) * 3),
        color: `var(${LINE_COLORS[i % LINE_COLORS.length]})`,
        delay: (i * 370) % 2400
      };
    });
  });
}
