import { Directive, HostListener, computed, inject, input, signal } from '@angular/core';
import { ClockService } from '../../services/clock.service';
import { ServiceAlert } from '../../services/alerts/alert-model';
import { AlertTone, alertWindow, summarizeAlerts, toneOf } from '../../services/alerts/alert-styles';

let nextId = 0;

/**
 * What every alert style shares: the alerts, their summary (lead, tone, prominent and minor), one
 * open/closed state, Esc to close, and the wording of an alert's time window.
 */
@Directive()
export abstract class AlertStyleBase {
  /** Already filtered to the route or station on screen. */
  readonly alerts = input.required<ServiceAlert[]>();

  private readonly clock = inject(ClockService);

  readonly summary = computed(() => summarizeAlerts(this.alerts()));
  readonly expanded = signal(false);
  /** Which alert's full description is unfolded, where a style lists several. */
  readonly openAlertId = signal<string | null>(null);
  readonly uid = `alert-style-${nextId++}`;

  toggle(): void {
    this.expanded.update(open => !open);
  }

  toggleAlert(id: string): void {
    this.openAlertId.update(current => current === id ? null : id);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.expanded.set(false);
  }

  toneOf(alert: ServiceAlert): AlertTone {
    return toneOf(alert);
  }

  windowOf(alert: ServiceAlert): string {
    return alertWindow(alert, new Date(this.clock.now()));
  }

  /** "Service Change · Until Oct 9", the second line most styles put under a headline. */
  kickerOf(alert: ServiceAlert): string {
    return [alert.impact, this.windowOf(alert)].filter(Boolean).join(' · ');
  }

  countLabel(count: number): string {
    return `${count} ${count === 1 ? 'alert' : 'alerts'}`;
  }
}
