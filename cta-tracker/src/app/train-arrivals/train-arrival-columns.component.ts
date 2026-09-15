import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../timeuntil.pipe';
import { TRAIN_LINE_TEXT_COLOR_MAP } from '../trainResponse';
import { DisplayPreferencesService } from '../services/display-preferences.service';
import { ArrivalGroup } from './train-arrival-groups';

/**
 * The "Split Board" layout: one column per direction, side by side.
 *
 * The two columns are told apart the way CTA's own platform signage does it — one direction filled
 * with the line colour, the other outlined in it — so the countdown's treatment alone says which
 * way the train is going, without a second label to read. Groups arrive pre-ordered by trDr, so
 * a direction sits on the same side at every station on the line.
 */
@Component({
  selector: 'app-train-arrival-columns',
  templateUrl: './train-arrival-columns.component.html',
  styleUrls: ['./train-arrival-columns.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class TrainArrivalColumnsComponent {
  protected readonly prefs = inject(DisplayPreferencesService);

  readonly groups = input<ArrivalGroup[] | null>(null);
  readonly loading = input(false);
  readonly stationId = input.required<string>();
  readonly refreshing = input(false);

  /** Two columns of two cards, matching the shape the real data usually lands in. */
  readonly skeletonColumns = [[0, 1], [0, 1]];

  /**
   * A single group spans the full width and keeps the filled treatment. Terminals, Loop stations
   * and late-night gaps all produce one group, and a permanently empty half-screen would be worse
   * than no column at all.
   */
  variantFor(index: number): 'fill' | 'outline' {
    return index === 0 ? 'fill' : 'outline';
  }

  /**
   * Null for every line but Yellow, so Angular leaves the custom property unset and the CSS
   * fallback to white applies. An empty string would set it to an empty value, which is not the
   * same thing — var(--col-text, #fff) would then resolve to nothing.
   */
  textColorFor(rt: string): string | null {
    return TRAIN_LINE_TEXT_COLOR_MAP[rt] ?? null;
  }
}
