import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import {
  STRIP_WINDOW_MIN, TRACK_STATION_PERCENT, assignLanes, hasMixedDestinations, minutesAway, placeName,
  trackPercent
} from '../arrival-visuals';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup, TrainArrivalDisplay } from '../train-arrival-groups';

interface TrackMarker {
  arrival: TrainArrivalDisplay;
  group: ArrivalGroup;
  percent: number;
  /** 0 and 2 above the line, 1 and 3 below; see `assignLanes`. */
  lane: number;
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

/** The track's width before it has been measured: the most common phone width. */
const DEFAULT_TRACK_WIDTH = 375;

/**
 * A pill's rendered width, estimated from its text rather than measured, so lanes can be assigned
 * in the same pass that places them. Errs wide: an estimate that is too small lets pills touch.
 */
function pillWidthPx(label: string): number {
  return label.length * 8.5 + 18;
}

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
  /** The track runs edge to edge, so its width is the host's plus the page padding it breaks out of. */
  private readonly trackWidth = signal(DEFAULT_TRACK_WIDTH);

  constructor() {
    super();
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    // Browser-only: ResizeObserver does not exist during prerendering.
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => this.trackWidth.set(entry.contentRect.width + 32));
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

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

    const placed: Omit<TrackMarker, 'lane'>[] = [];
    groups.slice(0, 2).forEach((group, index) => {
      const mixed = hasMixedDestinations(group.arrivals);
      for (const arrival of group.arrivals) {
        const minutes = minutesAway(arrival.countdown);
        // A due train sits on the station ring; an unreadable one has nowhere to go.
        if (minutes === null || minutes === 0) {
          continue;
        }
        placed.push({
          arrival,
          group,
          percent: trackPercent(minutes, sideFor(index)),
          tag: mixed ? arrival.destNm.charAt(0).toUpperCase() : ''
        });
      }
    });

    const width = this.trackWidth();
    const widthPercent = (label: string) => pillWidthPx(label) / width * 100;
    const station = single ? TRACK_STATION_PERCENT.single : TRACK_STATION_PERCENT.double;
    const lanes = assignLanes(
      placed.map(marker => ({
        percent: marker.percent,
        widthPercent: widthPercent(this.pillText(marker.arrival, marker.tag))
      })),
      // The Due pill sits over the station in the nearest lane above; the others keep clear of it.
      due ? [{ percent: station, widthPercent: widthPercent('Due'), lane: 0 }] : []
    );
    markers.push(...placed.map((marker, i) => ({ ...marker, lane: lanes[i] })));

    const sides = single ? ['single' as const] : ['left' as const, 'right' as const];
    return {
      station,
      single,
      markers,
      due,
      scale: sides.flatMap(side => SCALE_MINUTES.map(minutes => ({ minutes, percent: trackPercent(minutes, side) }))),
      ends: single
        ? [{ label: groups[0].directionLabel, side: 'left' }]
        : [
            { label: placeName(groups[0].directionLabel), side: 'left' },
            { label: placeName(groups[1].directionLabel), side: 'right' }
          ]
    };
  });

  /** What a pill says, which is also what its width is estimated from. */
  pillText(arrival: TrainArrivalDisplay, tag: string): string {
    return `${arrival.countdown}m${tag ? ' ' + tag : ''}`;
  }

  readonly mixedByGroup = computed(() =>
    new Map((this.groups() ?? []).map(group => [group.key, hasMixedDestinations(group.arrivals)])));
}
