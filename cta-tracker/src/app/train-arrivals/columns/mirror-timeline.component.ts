import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { TimelineRow, mergeTimeline } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

/**
 * Both directions on one shared spine, ordered by arrival time rather than grouped by direction:
 * reading top to bottom is reading "what comes next at this station", and the side of the spine a
 * card sits on says which way it is going.
 *
 * Rows are spaced by rank, not by minutes. Positioning them by ETA would make the whole layout
 * jump every time the clock ticks a train from 8 to 7.
 */
@Component({
  selector: 'app-mirror-timeline',
  templateUrl: './mirror-timeline.component.html',
  styleUrls: ['./columns-shared.css', './mirror-timeline.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class MirrorTimelineComponent extends ColumnVariantBase {
  readonly rows = computed<TimelineRow[]>(() => mergeTimeline(this.groups() ?? []));

  readonly skeletonRows = [0, 1, 2, 3];

  /**
   * The direction is carried by which side of the spine a card is on, which a screen reader cannot
   * see, so each link states it.
   */
  labelFor(row: TimelineRow): string {
    const groups = this.groups() ?? [];
    const direction = (row.side === 'left' ? groups[0] : groups[1])?.directionLabel ?? '';
    const when = row.arrival.countdown === 'DUE' ? 'due now' : `${row.arrival.countdown} min`;
    return `${direction}: ${when} to ${row.arrival.destNm}`;
  }
}
