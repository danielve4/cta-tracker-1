import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { clock24 } from '../arrival-visuals';
import { ColumnVariantBase } from './column-variant.base';

/**
 * A departure board set in SF Mono: uppercase destinations, 24-hour times, and three-letter status
 * codes the way station signs abbreviate. Monospace puts every destination and every figure on
 * the same invisible grid, like the split-flap boards this is named for.
 */
@Component({
  selector: 'app-solari',
  templateUrl: './solari.component.html',
  styleUrls: ['./columns-shared.css', './solari.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class SolariComponent extends ColumnVariantBase {
  readonly clock24 = clock24;
}
