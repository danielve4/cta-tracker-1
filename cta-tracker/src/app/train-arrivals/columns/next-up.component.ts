import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ArrivalGroup, TrainArrivalDisplay, shortDestination, splitNextUp } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

/**
 * One hero card per direction for the train you are actually deciding about, with the ones behind
 * it as chips. The most glanceable of the six — readable from further down the platform than any
 * of the others — at the cost of pushing the later trains' detail into a tooltip.
 */
@Component({
  selector: 'app-next-up',
  templateUrl: './next-up.component.html',
  styleUrls: ['./columns-shared.css', './next-up.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class NextUpComponent extends ColumnVariantBase {
  readonly splitNextUp = splitNextUp;

  /**
   * A chip names its destination only when it differs from the hero's: on the Green Line's trDr 5
   * a column mixes Ashland/63rd and Cottage Grove trains, and on the Blue Line it short-turns, so
   * a bare number would be the wrong train for the rider waiting on a specific branch.
   */
  chipDestination(arrival: TrainArrivalDisplay, hero: TrainArrivalDisplay | null): string {
    return hero && arrival.destNm === hero.destNm ? '' : shortDestination(arrival.destNm);
  }

  groupLabel(group: ArrivalGroup): string {
    return group.directionLabel;
  }
}
