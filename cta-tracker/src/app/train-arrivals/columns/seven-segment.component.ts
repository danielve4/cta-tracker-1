import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SEGMENT_RECTS, Segment, litSegments } from '../arrival-visuals';

/**
 * A row of seven-segment characters drawn in SVG, so Pocket LCD needs no font download. Unlit
 * segments are drawn too, faintly: the ghost 8 behind every digit is what makes an LCD read as one.
 *
 * Decorative: the readout's link carries the accessible label.
 */
@Component({
  selector: 'app-seven-segment',
  template: `
    @for (lit of characters(); track $index) {
      <svg class="digit" viewBox="0 0 12.5 20" [style.height.px]="height()" [style.width.px]="height() * 0.62"
           aria-hidden="true" focusable="false">
        <g transform="translate(1.4 0) skewX(-6)">
          @for (rect of rects; track rect[0]) {
            <rect [attr.x]="rect[1]" [attr.y]="rect[2]" [attr.width]="rect[3]" [attr.height]="rect[4]" rx="0.9"
                  [class.off]="!lit.has(rect[0])" />
          }
        </g>
      </svg>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: flex-end; }
    .digit { display: block; flex-shrink: 0; }
    rect { fill: currentColor; }
    rect.off { opacity: 0.09; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SevenSegmentComponent {
  /** One entry per character position; see `readoutChars`. */
  readonly chars = input.required<string[]>();
  readonly height = input(44);

  readonly rects = SEGMENT_RECTS;
  readonly characters = computed<ReadonlySet<Segment>[]>(() => this.chars().map(litSegments));
}
