import {
  ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, effect, inject, input, signal, untracked
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Long enough for both halves to turn: the top flap falls for half of it, the bottom rises for the rest. */
const FLIP_MS = 360;

/**
 * One split-flap card. When its character changes it flips the way the real thing does: the old
 * top half falls forward to reveal the new one, then the new bottom half swings down over the old.
 *
 * The card is sized by its host's `--flip-h` and `--flip-w` custom properties, so one component
 * serves the big next-train cards and the small ones in the rows below.
 */
@Component({
  selector: 'app-flip-card',
  template: `
    <span class="half top"><span class="glyph">{{ char() }}</span></span>
    <span class="half bottom"><span class="glyph">{{ flipping() ? previous() : char() }}</span></span>
    @if (flipping()) {
      <span class="half top flap-out"><span class="glyph">{{ previous() }}</span></span>
      <span class="half bottom flap-in"><span class="glyph">{{ char() }}</span></span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      flex-shrink: 0;
      width: var(--flip-w, 46px);
      height: var(--flip-h, 64px);
      border-radius: calc(var(--flip-h, 64px) * 0.1);
      background: #1c1c1f;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 2px 4px rgba(0, 0, 0, 0.35);
      perspective: 300px;
      font-family: var(--numeral-font);
      font-weight: 800;
      font-size: calc(var(--flip-h, 64px) * 0.74);
      font-variant-numeric: tabular-nums;
      color: var(--flip-ink, #f2efe6);
    }
    .half {
      position: absolute;
      left: 0;
      right: 0;
      height: 50%;
      overflow: hidden;
      background: inherit;
      backface-visibility: hidden;
    }
    .top { top: 0; border-radius: inherit; border-bottom-left-radius: 0; border-bottom-right-radius: 0; transform-origin: bottom; }
    .bottom { bottom: 0; border-radius: inherit; border-top-left-radius: 0; border-top-right-radius: 0; transform-origin: top; }
    /* The glyph is laid out at the full card height in both halves, so each half shows its half. */
    .glyph {
      position: absolute;
      left: 0;
      right: 0;
      height: var(--flip-h, 64px);
      line-height: var(--flip-h, 64px);
      text-align: center;
    }
    .bottom .glyph { bottom: 0; }
    /* The split across the middle of the card. */
    :host::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: rgba(0, 0, 0, 0.55);
      z-index: 2;
    }
    .flap-out { z-index: 1; animation: flapOut ${FLIP_MS / 2}ms ease-in forwards; }
    .flap-in { z-index: 1; transform: rotateX(90deg); animation: flapIn ${FLIP_MS / 2}ms ease-out ${FLIP_MS / 2}ms forwards; }
    @keyframes flapOut { to { transform: rotateX(-90deg); } }
    @keyframes flapIn { to { transform: rotateX(0deg); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' }
})
export class FlipCardComponent {
  readonly char = input.required<string>();

  protected readonly previous = signal('');
  protected readonly flipping = signal(false);

  constructor() {
    const animate = isPlatformBrowser(inject(PLATFORM_ID))
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let last: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));

    effect(() => {
      const next = this.char();
      untracked(() => {
        // The first value just appears; only a change flips.
        if (animate && last !== null && last !== next) {
          this.previous.set(last);
          this.flipping.set(true);
          clearTimeout(timer);
          timer = setTimeout(() => this.flipping.set(false), FLIP_MS);
        }
        last = next;
      });
    });
  }
}
