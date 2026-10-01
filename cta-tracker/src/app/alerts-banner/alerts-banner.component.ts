import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { DisplayPreferencesService } from '../services/display-preferences.service';
import { ServiceAlert } from '../services/alerts/alert-model';
import { TickerComponent } from './styles/ticker.component';
import { CardComponent } from './styles/card.component';
import { CapsuleComponent } from './styles/capsule.component';
import { MarginNoteComponent } from './styles/margin-note.component';
import { CounterComponent } from './styles/counter.component';
import { ToastComponent } from './styles/toast.component';

/**
 * The alerts for the route on an arrivals screen, in whichever style Settings picked. Each style
 * lives in `styles/` and extends `AlertStyleBase`. A style offered in `ALERT_STYLES` but missing
 * from the switch below renders the default.
 *
 * Sits as the last child of `.stop-header`. The host carries `data-style` and `data-active` so the
 * parent can keep the station name clear of the styles that float over the header (Counter, Toast).
 */
@Component({
  selector: 'app-alerts-banner',
  templateUrl: './alerts-banner.component.html',
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-style]': 'prefs.alertStyle()',
    '[attr.data-active]': 'alerts().length > 0 || null'
  },
  imports: [TickerComponent, CardComponent, CapsuleComponent, MarginNoteComponent, CounterComponent, ToastComponent]
})
export class AlertsBannerComponent {
  protected readonly prefs = inject(DisplayPreferencesService);
  /** Already filtered to the route or station on screen. */
  readonly alerts = input.required<ServiceAlert[]>();
}
