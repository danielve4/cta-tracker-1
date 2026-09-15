import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ColumnVariantBase } from './column-variant.base';

/**
 * Two dense panels in the shape of the LED signs on a platform: a header bar, then one row per
 * train. Fits six or seven trains per direction above the fold where the card styles fit two.
 *
 * With no pill per row, the fill/outline distinction moves to the header bar — solid versus
 * underlined — and to the colour of the ETA figures.
 */
@Component({
  selector: 'app-departure-board',
  templateUrl: './departure-board.component.html',
  styleUrls: ['./columns-shared.css', './departure-board.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class DepartureBoardComponent extends ColumnVariantBase {
  readonly skeletonRows = [0, 1, 2, 3];
}
