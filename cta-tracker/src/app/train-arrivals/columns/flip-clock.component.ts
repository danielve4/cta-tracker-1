import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { flipChars, hasMixedDestinations } from '../arrival-visuals';
import { ArrivalGroup, TrainArrivalDisplay, splitNextUp } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';
import { FlipCardComponent } from './flip-card.component';

interface FlipPanel {
  group: ArrivalGroup;
  hero: TrainArrivalDisplay | null;
  later: TrainArrivalDisplay[];
  mixed: boolean;
}

/**
 * A split-flap clock per direction: the next train on two big cards that flip over as the
 * minutes tick down, the ones behind it on small cards in rows below. The cards stay dark in both
 * themes, like the physical clock they imitate.
 */
@Component({
  selector: 'app-flip-clock',
  templateUrl: './flip-clock.component.html',
  styleUrls: ['./columns-shared.css', './flip-clock.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe, FlipCardComponent]
})
export class FlipClockComponent extends ColumnVariantBase {
  readonly flipChars = flipChars;

  readonly panels = computed<FlipPanel[]>(() =>
    (this.groups() ?? []).map(group => ({
      group,
      ...splitNextUp(group),
      mixed: hasMixedDestinations(group.arrivals)
    })));
}
