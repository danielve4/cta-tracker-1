import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ColumnVariantBase } from '../columns/column-variant.base';

/**
 * Cover Flow, one shelf per direction: a glass card per train on a horizontal scroll-snap row, the
 * next train centred and facing you, the later ones turned away on its right, each with its
 * reflection on the glossy floor.
 *
 * The turn is a scroll-driven animation — every card's slot is a `view-timeline` on the row's
 * inline axis, and the card's rotation, depth and stacking run on it — so the 3D follows the finger
 * at scroll speed with no script at all, and momentum and snapping are the platform's own. Where
 * `animation-timeline` is unsupported the row is a plain snapping carousel of the same cards.
 */
@Component({
  selector: 'app-cover-flow',
  templateUrl: './cover-flow.component.html',
  styleUrls: ['../columns/columns-shared.css', './cover-flow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class CoverFlowComponent extends ColumnVariantBase {}
