import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { ServiceAlert, MINOR_SEVERITY } from '../services/alerts/alert-model';
import { alertWindow } from '../services/alerts/alert-styles';
import { ClockService } from '../services/clock.service';

/** One CTA alert: the headline, expanding in place to CTA's full description. */
@Component({
  selector: 'app-alert-item',
  templateUrl: './alert-item.component.html',
  styleUrls: ['./alert-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertItemComponent {
  readonly alert = input.required<ServiceAlert>();
  /** The route pills; redundant on an arrivals screen, which is already about one route. */
  readonly showServices = input(false);

  protected readonly minorSeverity = MINOR_SEVERITY;
  private readonly clock = inject(ClockService);
  protected readonly window = computed(() => alertWindow(this.alert(), new Date(this.clock.now())));
}
