import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { AlertsService } from '../services/alerts.service';
import { AlertItemComponent } from '../alert-item/alert-item.component';
import {
  AlertsError, CtaAlertsResponse, ServiceAlert, TransitMode, alertsForMode, matchesSearch,
  normalizeAlerts, sortBySeverity
} from '../services/alerts/alert-model';

/** Every active CTA alert, split into trains and buses, with a search over routes and text. */
@Component({
  selector: 'app-alerts',
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AlertItemComponent]
})
export class AlertsComponent {
  private readonly alertsService = inject(AlertsService);

  readonly skeletonRows = [0, 1, 2, 3];
  readonly modes: { id: TransitMode; label: string }[] = [
    { id: 'train', label: 'Trains' },
    { id: 'bus', label: 'Buses' }
  ];

  readonly mode = signal<TransitMode>('train');
  readonly query = signal('');
  readonly lastRefreshed = signal<Date | null>(null);

  private readonly alertsResource = httpResource<CtaAlertsResponse>(() => this.alertsService.allAlertsUrl());

  private readonly parsed = computed<{ alerts: ServiceAlert[]; error: string | null }>(() => {
    if (this.alertsResource.error()) {
      return { alerts: [], error: 'Could not load alerts.' };
    }
    if (!this.alertsResource.hasValue()) {
      return { alerts: [], error: null };
    }
    try {
      return { alerts: sortBySeverity(normalizeAlerts(this.alertsResource.value())), error: null };
    } catch (e) {
      return { alerts: [], error: e instanceof AlertsError ? e.message : 'Could not load alerts.' };
    }
  });

  readonly error = computed(() => this.parsed().error);
  readonly counts = computed<Record<TransitMode, number>>(() => ({
    train: alertsForMode(this.parsed().alerts, 'train').length,
    bus: alertsForMode(this.parsed().alerts, 'bus').length
  }));
  readonly visible = computed(() => {
    const query = this.query();
    return alertsForMode(this.parsed().alerts, this.mode()).filter(alert => matchesSearch(alert, query));
  });

  readonly isInitialLoading = computed(() => this.alertsResource.status() === 'loading');
  readonly refreshing = computed(() => this.alertsResource.isLoading());

  constructor() {
    effect(() => {
      if (this.alertsResource.status() === 'resolved') {
        this.lastRefreshed.set(new Date());
      }
    });
  }

  refresh(): void {
    this.alertsResource.reload();
  }
}
