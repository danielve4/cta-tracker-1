import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ColumnVariantBase } from './column-variant.base';

/**
 * No cards, no pills, no boxes: a 3px rule in the line colour and a small-caps label per
 * direction, then large rounded numerals with whitespace doing the separating. The second
 * direction's rule is doubled, standing in for the fill/outline split a single line colour needs.
 */
@Component({
  selector: 'app-typographic',
  templateUrl: './typographic.component.html',
  styleUrls: ['./columns-shared.css', './typographic.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class TypographicComponent extends ColumnVariantBase {}
