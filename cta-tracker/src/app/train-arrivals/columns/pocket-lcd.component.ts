import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasMixedDestinations, readoutChars } from '../arrival-visuals';
import { ArrivalGroup, TrainArrivalDisplay, splitNextUp } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';
import { SevenSegmentComponent } from './seven-segment.component';

interface LcdPanel {
  group: ArrivalGroup;
  hero: TrainArrivalDisplay | null;
  later: TrainArrivalDisplay[];
  mixed: boolean;
}

/**
 * A 90s digital watch face: a grey-green LCD glass in a dark bezel, seven-segment digits with their
 * ghost 8s, and DUE / DLY / SCH printed across the top like watch-face icons that light up only
 * when they apply. In the dark theme the glass is backlit teal: the Indiglo.
 *
 * Monochrome on purpose, like the real thing — the annunciators carry the status the other styles
 * give a colour.
 */
@Component({
  selector: 'app-pocket-lcd',
  templateUrl: './pocket-lcd.component.html',
  styleUrls: ['./columns-shared.css', './pocket-lcd.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SevenSegmentComponent]
})
export class PocketLcdComponent extends ColumnVariantBase {
  readonly readoutChars = readoutChars;

  readonly panels = computed<LcdPanel[]>(() =>
    (this.groups() ?? []).map(group => ({
      group,
      ...splitNextUp(group),
      mixed: hasMixedDestinations(group.arrivals)
    })));

  /**
   * The label under a small readout: the status if it has one, else — on a direction that splits
   * between destinations — the first three letters of where it is going (ASH, COT).
   */
  miniLabel(arrival: TrainArrivalDisplay, mixed: boolean): string {
    if (arrival.isDly === '1') {
      return 'DLY';
    }
    if (arrival.isSch === '1') {
      return 'SCH';
    }
    return mixed ? arrival.destNm.slice(0, 3).toUpperCase() : '';
  }
}
