import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { hasMixedDestinations } from '../arrival-visuals';
import { ColumnVariantBase } from '../columns/column-variant.base';

/**
 * The exact times under a 3D scene, in the same two columns as Approach's list. The scenes are
 * `aria-hidden` and their trains are not in the tab order — perspective makes a far train's hit
 * area a few pixels wide, and a screen reader cannot tell depth from a transform — so this list is
 * what assistive technology, the keyboard and anyone who wants the number to the minute reach.
 */
@Component({
  selector: 'app-depth-list',
  templateUrl: './depth-list.component.html',
  styleUrls: ['../columns/columns-shared.css', './depth-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class DepthListComponent extends ColumnVariantBase {
  readonly mixedByGroup = computed(() =>
    new Map((this.groups() ?? []).map(group => [group.key, hasMixedDestinations(group.arrivals)])));
}
