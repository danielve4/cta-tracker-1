import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HolidayStop, StationRef } from './holiday-train';

/** One upcoming stop as the journey strip draws it. */
export interface HolidayStopRow extends HolidayStop {
  countdown: string;
  clock: string;
  link: string[] | null;
}

/**
 * The Holiday Train's run as a transit strip: the station it just left (dashed), the train, then
 * every upcoming stop with its countdown. Each upcoming stop links to its arrivals screen.
 * The parent sets `--line` to the line's colour.
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
}
