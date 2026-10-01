import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AlertTone } from '../../services/alerts/alert-styles';

/**
 * The tone as a shape as well as a colour, so it survives colour blindness and a greyscale screen:
 * a filled octagon for major, an outlined triangle for a service problem, a circled i for a note.
 * Drawn on a 20-unit grid with a 1.6 stroke so it stays crisp at 14–20px.
 */
@Component({
  selector: 'app-alert-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: [`
    :host { display: inline-flex; width: 1em; height: 1em; flex-shrink: 0; }
    svg { width: 100%; height: 100%; display: block; overflow: visible; }
  `],
  template: `
    @switch (tone()) {
      @case ('major') {
        <svg viewBox="0 0 20 20">
          <path d="M6.9 1.5h6.2l4.4 4.4v6.2l-4.4 4.4H6.9l-4.4-4.4V5.9z" fill="currentColor"/>
          <path d="M10 5.6v5.2" stroke="var(--glyph-ink, #fff)" stroke-width="1.9" stroke-linecap="round" fill="none"/>
          <circle cx="10" cy="13.7" r="1.15" fill="var(--glyph-ink, #fff)"/>
        </svg>
      }
      @case ('service') {
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
          <path d="M8.55 3.15a1.68 1.68 0 0 1 2.9 0l6.3 10.9a1.68 1.68 0 0 1-1.45 2.52H3.7a1.68 1.68 0 0 1-1.45-2.52z"/>
          <path d="M10 7.6v3.6"/>
          <circle cx="10" cy="13.7" r=".55" fill="currentColor"/>
        </svg>
      }
      @default {
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="10" cy="10" r="7.6"/>
          <path d="M10 9.2v4.6"/>
          <circle cx="10" cy="6.4" r=".55" fill="currentColor"/>
        </svg>
      }
    }
  `
})
export class AlertGlyphComponent {
  readonly tone = input.required<AlertTone>();
}
