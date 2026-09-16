import { Directive, inject, input } from '@angular/core';
import { TRAIN_LINE_TEXT_COLOR_MAP } from '../../trainResponse';
import { DisplayPreferencesService } from '../../services/display-preferences.service';
import { ArrivalGroup } from '../train-arrival-groups';

/**
 * What every column style shares: the four inputs the switcher forwards, the display preferences
 * the meta line reads, and the handful of per-group lookups their templates need.
 *
 * Groups arrive already ordered `'1'` first, `'5'` second, so index 0 is always the left column and
 * a direction keeps the same side at every station on a line.
 */
@Directive()
export abstract class ColumnVariantBase {
  readonly groups = input<ArrivalGroup[] | null>(null);
  /** Render the style's own skeleton rather than data. */
  readonly loading = input(false);
  readonly stationId = input.required<string>();
  /** Adds the `.loading` shimmer to cards during a background refresh. */
  readonly refreshing = input(false);

  protected readonly prefs = inject(DisplayPreferencesService);

  readonly skeletonColumns = [[0, 1], [0, 1]];

  /** The left column is filled with the line colour, the right one outlined in it. */
  variantFor(index: number): 'fill' | 'outline' {
    return index === 0 ? 'fill' : 'outline';
  }

  colorFor(group: ArrivalGroup): string {
    return group.arrivals[0]?.lineColor || 'var(--cta-grey)';
  }

  /**
   * White on every line but Yellow, whose rgb(249,227,0) is unreadable under it. CTA's own signage
   * puts white on the Pink Line at ~2.6:1, which this keeps — at 700 weight, as they do.
   */
  textColorFor(group: ArrivalGroup): string {
    return TRAIN_LINE_TEXT_COLOR_MAP[group.arrivals[0]?.rt ?? ''] ?? '#FFFFFF';
  }

  /**
   * One direction — a terminal, a Loop stop, a late-night gap — spans the full width. An empty
   * placeholder column would be permanent at every such station, not occasional.
   */
  isSingle(groups: ArrivalGroup[]): boolean {
    return groups.length === 1;
  }
}
