import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/** URL builders for `httpResource`; parse responses with `normalizeAlerts` in `alerts/alert-model.ts`. */
@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private readonly alertsURL = `${environment.alertsBaseURL}/alerts`;

  /** A train line id (`Red`, `Brn`), a bus route (`22`) or a comma list of them. */
  routeAlertsUrl(routeId: string): string {
    return `${this.alertsURL}?routeid=${encodeURIComponent(routeId)}`;
  }

  allAlertsUrl(): string {
    return this.alertsURL;
  }
}
