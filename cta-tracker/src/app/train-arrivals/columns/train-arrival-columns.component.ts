import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DisplayPreferencesService } from '../../services/display-preferences.service';
import { ArrivalGroup } from '../train-arrival-groups';
import { SplitBoardComponent } from './split-board.component';

/**
 * Picks the column style the user chose in Settings and forwards the same four inputs to it.
 *
 * A switcher rather than one component with six branches: each style's template is long enough on
 * its own, and Angular scopes CSS per component, so a single component would need every style's
 * rules loaded whichever one is showing.
 */
@Component({
  selector: 'app-train-arrival-columns',
  templateUrl: './train-arrival-columns.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SplitBoardComponent]
})
export class TrainArrivalColumnsComponent {
  protected readonly prefs = inject(DisplayPreferencesService);

  readonly groups = input<ArrivalGroup[] | null>(null);
  readonly loading = input(false);
  readonly stationId = input.required<string>();
  readonly refreshing = input(false);
}
