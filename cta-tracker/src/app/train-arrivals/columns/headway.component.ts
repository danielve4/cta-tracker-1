import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  StripGap, StripTick, WIDE_GAP_MIN, clock24, hasMixedDestinations, headwayBefore, headwayStrip, minutesAway,
  snakeLabel
} from '../arrival-visuals';
import { ArrivalGroup, TrainArrivalDisplay, splitNextUp } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

interface HeadwayPanel {
  group: ArrivalGroup;
  hero: TrainArrivalDisplay | null;
  later: TrainArrivalDisplay[];
  ticks: StripTick[];
  gaps: StripGap[];
  mixed: boolean;
}

/**
 * Mission control. The next train is a countdown (T– 04 MIN) under an inverted header band, and a
 * single strip per direction shows how the trains are spaced across the next half hour, with any
 * long gap hatched — the bunching and the long waits show before a number is read.
 *
 * One strip per direction rather than a bar per row: a bar per train only restates its own number,
 * where one shared axis shows the thing a row cannot, the spacing between trains.
 */
@Component({
  selector: 'app-headway',
  templateUrl: './headway.component.html',
  styleUrls: ['./columns-shared.css', './headway.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class HeadwayComponent extends ColumnVariantBase {
  readonly clock24 = clock24;
  /**
   * `95TH_DAN_RYAN_BOUND` split at its underscores, so the header can offer a line break after each
   * one. Left to itself the browser either overflows the column or breaks mid-word.
   */
  snakeParts(label: string): string[] {
    return snakeLabel(label).split('_');
  }
  readonly wideGapMin = WIDE_GAP_MIN;

  readonly panels = computed<HeadwayPanel[]>(() =>
    (this.groups() ?? []).map(group => ({
      group,
      ...splitNextUp(group),
      ...headwayStrip(group.arrivals),
      mixed: hasMixedDestinations(group.arrivals)
    })));

  /** Two digits, the way a countdown clock shows it: `T– 04`. */
  countdownDigits(arrival: TrainArrivalDisplay): string {
    const minutes = minutesAway(arrival.countdown);
    return minutes === null ? '--' : String(minutes).padStart(2, '0');
  }

  /** The Δ column: minutes after the train before. `index` is into `later`, one behind the group. */
  gapBefore(panel: HeadwayPanel, index: number): number | null {
    return headwayBefore(panel.group.arrivals, index + 1);
  }
}
