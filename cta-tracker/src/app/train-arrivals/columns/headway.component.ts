import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  StripGap, StripTick, WIDE_GAP_MIN, assignLanes, clock24, hasMixedDestinations, headwayBefore, headwayStrip,
  minutesAway, snakeLabel
} from '../arrival-visuals';
import { ArrivalGroup, TrainArrivalDisplay, splitNextUp } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

interface HeadwayPanel {
  group: ArrivalGroup;
  hero: TrainArrivalDisplay | null;
  later: TrainArrivalDisplay[];
  ticks: Array<StripTick & { lane: number }>;
  gaps: Array<StripGap & { labelled: boolean }>;
  mixed: boolean;
}

/**
 * The strip's width, assumed rather than measured: a column at the narrowest common phone. Trains
 * a couple of minutes apart put their labels a few pixels apart, so the estimate only has to be
 * good enough to tell when two labels would touch; erring narrow just lifts a label a row sooner.
 */
const STRIP_WIDTH_PX = 150;
/** Mono 9.5px: about 6px a character, plus a little air. */
const labelPercent = (text: string) => (text.length * 6 + 4) / STRIP_WIDTH_PX * 100;

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
    (this.groups() ?? []).map(group => {
      const { ticks, gaps } = headwayStrip(group.arrivals);
      // Tick labels that would touch take a second row above the line; a gap too narrow for its
      // "+2" drops the label, since the ticks either side already say how close they are.
      const lanes = assignLanes(ticks.map(tick => ({
        percent: tick.percent,
        widthPercent: labelPercent(this.tickLabel(tick))
      })), [], 2);
      return {
        group,
        ...splitNextUp(group),
        ticks: ticks.map((tick, i) => ({ ...tick, lane: lanes[i] })),
        gaps: gaps.map(gap => ({ ...gap, labelled: gap.width >= labelPercent(this.gapLabel(gap)) })),
        mixed: hasMixedDestinations(group.arrivals)
      };
    }));

  tickLabel(tick: StripTick): string {
    return tick.overflow ? '▸' : String(tick.minutes);
  }

  gapLabel(gap: StripGap): string {
    return `${gap.wide ? 'GAP ' : ''}+${gap.minutes}`;
  }

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
