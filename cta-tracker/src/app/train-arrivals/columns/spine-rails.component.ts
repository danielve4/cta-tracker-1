import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ColumnVariantBase } from './column-variant.base';

/**
 * The direction label as a vertical rail on the outer edge of each column instead of a header row,
 * which buys back the ~40px the headers cost and reads like the spine of a book on each side.
 *
 * The trade is real: rotated text is harder to read than horizontal text, and the narrower cards
 * force the countdown and destination down a size. It is here to be compared against the others.
 */
@Component({
  selector: 'app-spine-rails',
  templateUrl: './spine-rails.component.html',
  styleUrls: ['./columns-shared.css', './spine-rails.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class SpineRailsComponent extends ColumnVariantBase {}
