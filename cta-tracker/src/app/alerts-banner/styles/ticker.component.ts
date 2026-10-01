import { Component, ChangeDetectionStrategy, DestroyRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertStyleBase } from './alert-style.base';
import { AlertGlyphComponent } from './alert-glyph.component';
import { AlertDetailComponent } from './alert-detail.component';
import { nextTickerIndex } from '../../services/alerts/alert-styles';

const ROTATE_MS = 5000;

/**
 * One quiet line. With more than one alert the headlines take turns, sliding up every five
 * seconds; they hold still while the strip is open, hovered or focused, while the tab is hidden,
 * and for anyone who asks for reduced motion. Tapping unfolds every alert below the strip.
 */
@Component({
  selector: 'app-alert-ticker',
  templateUrl: './ticker.component.html',
  styleUrls: ['./alert-styles-shared.css', './ticker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertGlyphComponent, AlertDetailComponent]
})
export class TickerComponent extends AlertStyleBase {
  /** Position on the track, which carries a copy of the first headline at the end. */
  readonly index = signal(0);
  /** Off for the one frame that snaps the track from that copy back to the real first line. */
  readonly animate = signal(true);
  private readonly held = signal(false);
  private readonly alertIds = computed(() => this.summary()?.ordered.map(a => a.id).join(',') ?? '');

  readonly shown = computed(() => {
    const count = this.summary()?.count ?? 0;
    return count === 0 ? 0 : this.index() % count;
  });

  constructor() {
    super();
    const destroyRef = inject(DestroyRef);

    // A refresh that changes which alerts are active starts again from the lead. A refresh that
    // returns the same alerts (every 30 seconds) leaves the rotation where it is.
    effect(() => {
      this.alertIds();
      this.index.set(0);
    });

    afterNextRender(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const id = setInterval(() => {
        const count = this.summary()?.count ?? 0;
        if (count < 2 || this.held() || this.expanded() || document.hidden || reduceMotion.matches) {
          return;
        }
        this.animate.set(true);
        this.index.update(i => Math.min(i, count - 1) + 1);
      }, ROTATE_MS);
      destroyRef.onDestroy(() => clearInterval(id));
    });
  }

  hold(held: boolean): void {
    this.held.set(held);
  }

  /** Landed on the copy of the first headline: jump to the real one with no transition. */
  onSlid(): void {
    const count = this.summary()?.count ?? 0;
    if (count > 1 && this.index() >= count) {
      this.animate.set(false);
      this.index.set(nextTickerIndex(count - 1, count));
      requestAnimationFrame(() => requestAnimationFrame(() => this.animate.set(true)));
    }
  }
}
