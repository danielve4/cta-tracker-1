import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertItemComponent } from '../alert-item/alert-item.component';
import { ServiceAlert, partitionBySeverity } from '../services/alerts/alert-model';

/**
 * The alerts for the route on an arrivals screen. Service problems are listed; notes below
 * MINOR_SEVERITY (elevators, stop relocations) fold behind a toggle. Renders nothing when empty.
 */
@Component({
  selector: 'app-alerts-banner',
  templateUrl: './alerts-banner.component.html',
  styleUrls: ['./alerts-banner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertItemComponent]
})
export class AlertsBannerComponent {
  /** Already sorted by severity. */
  readonly alerts = input.required<ServiceAlert[]>();

  private readonly partitioned = computed(() => partitionBySeverity(this.alerts()));
  protected readonly prominent = computed(() => this.partitioned().prominent);
  protected readonly minor = computed(() => this.partitioned().minor);
  protected readonly hasMajor = computed(() => this.alerts().some(a => a.major));
  protected readonly showMinor = signal(false);

  protected toggleMinor(): void {
    this.showMinor.update(show => !show);
  }
}
