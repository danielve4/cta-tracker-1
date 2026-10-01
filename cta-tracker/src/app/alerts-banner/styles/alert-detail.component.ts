import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { ServiceAlert } from '../../services/alerts/alert-model';

/**
 * An alert's full text, shared by every style. CTA's HTML goes through [innerHTML] so Angular's
 * sanitizer runs over it. Colours come from the --detail-* custom properties, so a style with its
 * own surface (Capsule is black in both themes) restyles it without reaching inside.
 */
@Component({
  selector: 'app-alert-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: flex; flex-direction: column; gap: 10px;
      font-size: 13.5px; line-height: 1.5;
      color: var(--detail-text, var(--text-secondary));
    }
    .description { overflow-wrap: anywhere; }
    .description ::ng-deep p + p { margin-top: 8px; }
    .description ::ng-deep strong { font-weight: 650; color: var(--detail-strong, var(--text-primary)); }
    .description ::ng-deep a,
    .cta-link {
      color: var(--detail-link, var(--text-primary));
      font-weight: 600;
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
      text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
    }
    .description ::ng-deep img { max-width: 100%; height: auto; border-radius: 8px; }
    .cta-link { align-self: flex-start; font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px; }
    .cta-link svg { width: 11px; height: 11px; }
  `],
  template: `
    @let a = alert();
    @if (a.fullHtml) {
      <div class="description" [innerHTML]="a.fullHtml"></div>
    } @else if (a.shortDescription) {
      <p class="description">{{ a.shortDescription }}</p>
    }
    @if (a.url) {
      <a class="cta-link" [href]="a.url" target="_blank" rel="noopener">
        View on transitchicago.com
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.5 2.5h5v5M9.5 2.5l-7 7"/>
        </svg>
      </a>
    }
  `
})
export class AlertDetailComponent {
  readonly alert = input.required<ServiceAlert>();
}
