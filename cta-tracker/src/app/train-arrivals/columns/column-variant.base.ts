import { Directive, inject, input } from '@angular/core';
import { TRAIN_LINE_TEXT_COLOR_MAP } from '../../trainResponse';
import { DisplayPreferencesService } from '../../services/display-preferences.service';
import { ArrivalGroup, TrainArrivalDisplay } from '../train-arrival-groups';

/** The one status a row shows. A due train is due whatever else the API says about it. */
export type ArrivalStatus = 'due' | 'delayed' | 'scheduled' | '';

/**
 * What every column style (and the Approach layout) shares: the four inputs the parent forwards,
 * the display preferences the meta lines read, and the handful of per-group lookups their
 * templates need.
 *
 * Groups arrive already ordered `'1'` first, `'5'` second (or the other way round for a line the
 * rider has swapped), so index 0 is always the left column and a direction keeps the same side at
 * every station on a line.
 */
@Directive()
export abstract class ColumnVariantBase {
  readonly groups = input<ArrivalGroup[] | null>(null);
  /** Render the style's own skeleton rather than data. */
  readonly loading = input(false);
  readonly stationId = input.required<string>();
  /** Dims the arrivals while a background refresh is in flight. */
  readonly refreshing = input(false);

  protected readonly prefs = inject(DisplayPreferencesService);

  readonly skeletonColumns = [[0, 1, 2], [0, 1, 2]];

  /**
   * Every style marks the second direction differently from the first — a double rule, a hollow
   * square, a dashed line — standing in for the colour a single line cannot vary.
   */
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

  /** Bound as `data-status`, so each style's CSS picks its own colours for the three states. */
  statusOf(arrival: TrainArrivalDisplay): ArrivalStatus {
    if (arrival.countdown === 'DUE') {
      return 'due';
    }
    return arrival.isDly === '1' ? 'delayed' : arrival.isSch === '1' ? 'scheduled' : '';
  }

  /** What a screen reader hears for a train whose direction is carried by position or colour. */
  arrivalLabel(group: ArrivalGroup, arrival: TrainArrivalDisplay): string {
    const when = arrival.countdown === 'DUE' ? 'due now' : `${arrival.countdown} min`;
    const status = arrival.isDly === '1' ? ', delayed' : arrival.isSch === '1' ? ', scheduled' : '';
    return `${group.directionLabel}: ${when} to ${arrival.destNm}${status}`;
  }
}
