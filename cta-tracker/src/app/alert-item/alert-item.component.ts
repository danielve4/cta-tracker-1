import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ServiceAlert, MINOR_SEVERITY } from '../services/alerts/alert-model';

/** One CTA alert: the headline, expanding in place to CTA's full description. */
@Component({
  selector: 'app-alert-item',
  templateUrl: './alert-item.component.html',
  styleUrls: ['./alert-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe]
})
export class AlertItemComponent {
  readonly alert = input.required<ServiceAlert>();
  /** The route pills; redundant on an arrivals screen, which is already about one route. */
  readonly showServices = input(false);

  protected readonly minorSeverity = MINOR_SEVERITY;
}
