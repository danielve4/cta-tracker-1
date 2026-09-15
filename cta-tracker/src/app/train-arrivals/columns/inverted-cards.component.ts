import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ArrivalGroup } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

/**
 * The colour inversion carried by the whole card rather than just the pills: one direction's cards
 * are solid line colour, the other's are the surface colour with a line-colour border. The
 * strongest separation of the six, and the one that costs the most — every status colour needs a
 * treatment that survives on a coloured background.
 */
@Component({
  selector: 'app-inverted-cards',
  templateUrl: './inverted-cards.component.html',
  styleUrls: ['./columns-shared.css', './inverted-cards.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class InvertedCardsComponent extends ColumnVariantBase {
  /**
   * The Yellow Line's cards carry black text, so the translucent wells inside them have to darken
   * rather than lighten. A class is bound instead of matching on the inline custom property.
   */
  hasDarkText(group: ArrivalGroup): boolean {
    return this.textColorFor(group) === '#000000';
  }
}
