import {
  Component, ChangeDetectionStrategy, ElementRef, Injector, afterNextRender, inject, viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertStyleBase } from './alert-style.base';
import { AlertGlyphComponent } from './alert-glyph.component';
import { AlertDetailComponent } from './alert-detail.component';

/**
 * A black pill in both themes, like the hardware it borrows from. Tapping it morphs the pill into
 * a panel. The morph is a FLIP: measure, switch state, measure again, then animate width, height and
 * radius between the two with the Web Animations API, because CSS cannot transition to an
 * auto-sized box in Safari.
 */
@Component({
  selector: 'app-alert-capsule',
  templateUrl: './capsule.component.html',
  styleUrls: ['./alert-styles-shared.css', './capsule.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertGlyphComponent, AlertDetailComponent]
})
export class CapsuleComponent extends AlertStyleBase {
  private readonly island = viewChild<ElementRef<HTMLElement>>('island');
  private readonly injector = inject(Injector);

  morph(): void {
    this.flip(() => this.toggle());
  }

  protected override onEscape(): void {
    if (this.expanded()) {
      this.flip(() => this.expanded.set(false));
    }
  }

  private flip(change: () => void): void {
    const el = this.island()?.nativeElement;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || typeof el.animate !== 'function') {
      change();
      return;
    }
    const first = el.getBoundingClientRect();
    const firstRadius = getComputedStyle(el).borderTopLeftRadius;
    el.getAnimations().forEach(a => a.cancel());
    change();
    afterNextRender({
      read: () => {
        const last = el.getBoundingClientRect();
        const lastRadius = getComputedStyle(el).borderTopLeftRadius;
        el.animate([
          { width: `${first.width}px`, height: `${first.height}px`, borderRadius: firstRadius },
          { width: `${last.width}px`, height: `${last.height}px`, borderRadius: lastRadius }
        ], { duration: 460, easing: 'cubic-bezier(0.32, 1.2, 0.5, 1)' });
      }
    }, { injector: this.injector });
  }
}
