import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DisplayPreferencesService } from '../../services/display-preferences.service';
import { ArrivalGroup } from '../train-arrival-groups';
import { CoverFlowComponent } from './cover-flow.component';
import { DioramaComponent } from './diorama.component';
import { HoloCardComponent } from './holo-card.component';
import { NeonSkylineComponent } from './neon-skyline.component';
import { TimeStackComponent } from './time-stack.component';
import { TunnelComponent } from './tunnel.component';

/**
 * Picks the 3D style chosen in Settings, the way `TrainArrivalColumnsComponent` picks a column
 * style, and draws one shared skeleton while the first response is in flight: a 3D scene has
 * nothing meaningful to show without trains, so the styles do not each carry their own.
 */
@Component({
  selector: 'app-train-arrival-depth',
  templateUrl: './train-arrival-depth.component.html',
  styleUrls: ['../columns/columns-shared.css', './train-arrival-depth.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverFlowComponent, DioramaComponent, HoloCardComponent, NeonSkylineComponent, TimeStackComponent, TunnelComponent]
})
export class TrainArrivalDepthComponent {
  protected readonly prefs = inject(DisplayPreferencesService);

  readonly groups = input<ArrivalGroup[] | null>(null);
  readonly loading = input(false);
  readonly stationId = input.required<string>();
  readonly refreshing = input(false);
}
