import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ColumnVariantBase } from './column-variant.base';

/**
 * The default column style, and the closest to CTA's platform signage: one direction filled with
 * the line colour, the other outlined in it, so the countdown's treatment alone says which way the
 * train is going without a second label to read.
 */
@Component({
  selector: 'app-split-board',
  templateUrl: './split-board.component.html',
  styleUrls: ['./columns-shared.css', './split-board.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class SplitBoardComponent extends ColumnVariantBase {}
