import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { placeName } from '../arrival-visuals';
import { ColumnVariantBase } from './column-variant.base';

/**
 * The amber dot-matrix arrival sign on a CTA platform. Runs edge to edge on its own dark panel and
 * stays dark in the light theme, because it is a sign, not a surface.
 *
 * Set in Doto, the one style that ships a font: a 2 KB subset per weight, declared in styles.css.
 */
@Component({
  selector: 'app-platform-led',
  templateUrl: './platform-led.component.html',
  styleUrls: ['./columns-shared.css', './platform-led.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class PlatformLedComponent extends ColumnVariantBase {
  readonly placeName = placeName;
}
