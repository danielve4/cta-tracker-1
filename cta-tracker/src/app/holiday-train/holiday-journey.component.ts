import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StationRef } from './holiday-train';

/** One upcoming stop as the journey strip draws it, for the train or the bus. */
export interface HolidayStopRow {
  /** Station `mapid` or bus `stpid`. */
  id: string;
  name: string;
  delayed: boolean;
  countdown: string;
  clock: string;
  link: string[] | null;
}

/**
 * A holiday vehicle's trip as a transit strip: the stop it just left (dashed, train only), the
 * vehicle, then every upcoming stop with its countdown. Each upcoming stop links to its arrivals
 * screen. The parent sets `--line` to the line's colour (CTA red for the bus).
 */
@Component({
  selector: 'app-holiday-journey',
  templateUrl: './holiday-journey.component.html',
  styleUrls: ['./holiday-journey.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class HolidayJourneyComponent {
  readonly stops = input.required<HolidayStopRow[]>();
  readonly lastStation = input<StationRef | null>(null);
  readonly vehicle = input<'train' | 'bus'>('train');
}
