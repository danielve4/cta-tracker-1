import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import {
  STRIP_WINDOW_MIN, TRACK_STATION_PERCENT, hasMixedDestinations, minutesAway, placeName, trackPercent
} from '../arrival-visuals';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup, TrainArrivalDisplay } from '../train-arrival-groups';

interface TrackMarker {
  arrival: TrainArrivalDisplay;
  group: ArrivalGroup;
  percent: number;
  /** Markers alternate above and below the line so neighbours on the same side do not collide. */
  above: boolean;
  /** The destination's initial, on a direction whose trains split between two destinations. */
  tag: string;
}

interface Track {
  station: number;
  single: boolean;
  markers: TrackMarker[];
  /** The first due train, which sits on the station ring rather than on the line. */
  due: { arrival: TrainArrivalDisplay; group: ArrivalGroup } | null;
  scale: { percent: number; minutes: number }[];
  ends: { label: string; side: 'left' | 'right' }[];
}

const SCALE_MINUTES = [10, 20, STRIP_WINDOW_MIN];

/**
 * A layout rather than a column style: the line itself, drawn edge to edge, with the station as a
 * ring and each direction's trains closing in from its own side, placed by how far away they are.
 * The one view that answers "where are the trains?" as well as "when?".
 *
 * Below it, a compact two-column list gives the exact times the diagram only suggests. It reuses
 * the column foundation (the base's inputs, the shared subgrid) for that list.
 */
@Component({
  selector: 'app-train-arrival-approach',
  templateUrl: './approach.component.html',
  styleUrls: ['../columns/columns-shared.css', './approach.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class ApproachComponent extends ColumnVariantBase {
  readonly track = computed<Track | null>(() => {
    const groups = this.groups();
    if (!groups?.length) {
      return null;
    }
    const single = groups.length === 1;
    const sideFor = (index: number) => single ? 'single' : index === 0 ? 'left' : 'right';
    const markers: TrackMarker[] = [];
    let due: Track['due'] = null;
    for (const group of groups) {
      const arrival = group.arrivals.find(candidate => minutesAway(candidate.countdown) === 0);
      if (arrival) {
        due = { arrival, group };
        break;
      }
    }

    groups.slice(0, 2).forEach((group, index) => {
      const mixed = hasMixedDestinations(group.arrivals);
      let placed = 0;
      for (const arrival of group.arrivals) {
        const minutes = minutesAway(arrival.countdown);
        if (minutes === null) {
          continue;
        }
        if (minutes === 0) {
          continue;
        }
        markers.push({
          arrival,
          group,
          percent: trackPercent(minutes, sideFor(index)),
          // A due train's pill sits above the station, so each side's nearest train starts below.
          above: placed++ % 2 === (due ? 1 : 0),
          tag: mixed ? arrival.destNm.charAt(0).toUpperCase() : ''
        });
      }
    });

    const sides = single ? ['single' as const] : ['left' as const, 'right' as const];
    return {
      station: single ? TRACK_STATION_PERCENT.single : TRACK_STATION_PERCENT.double,
      single,
      markers,
      due,
      scale: sides.flatMap(side => SCALE_MINUTES.map(minutes => ({ minutes, percent: trackPercent(minutes, side) }))),
      ends: single
        ? [{ label: `${groups[0].directionLabel} →`, side: 'left' }]
        : [
            { label: `← ${placeName(groups[0].directionLabel)}`, side: 'left' },
            { label: `${placeName(groups[1].directionLabel)} →`, side: 'right' }
          ]
    };
  });

  readonly mixedByGroup = computed(() =>
    new Map((this.groups() ?? []).map(group => [group.key, hasMixedDestinations(group.arrivals)])));
}
