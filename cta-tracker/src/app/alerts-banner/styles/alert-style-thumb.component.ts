import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AlertStyle } from '../../services/alerts/alert-styles';

/** A 72×40 drawing of an alert style, for its chip in Settings. */
@Component({
  selector: 'app-alert-style-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./alert-style-thumb.component.css'],
  host: { 'aria-hidden': 'true' },
  template: `<span class="thumb" [attr.data-style]="style()"><i></i><i></i><i></i><i></i></span>`
})
export class AlertStyleThumbComponent {
  readonly style = input.required<AlertStyle>();
}
