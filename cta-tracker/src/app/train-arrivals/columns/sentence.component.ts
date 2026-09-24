import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { listSeparator } from '../arrival-visuals';
import { ArrivalGroup, TrainArrivalDisplay, splitNextUp } from '../train-arrival-groups';
import { ColumnVariantBase } from './column-variant.base';

interface SentencePanel {
  group: ArrivalGroup;
  hero: TrainArrivalDisplay | null;
  later: TrainArrivalDisplay[];
}

/**
 * Each direction written as a sentence in New York, Apple's serif: "In 2 min, to 95th/Dan Ryan at
 * 5:44 PM. Then 9, 15 and 23." Read rather than scanned.
 *
 * A later train only names its destination when it differs from the first one's — the Green
 * Line's "7 to Cottage Grove" — since an unnamed one is going where the sentence already said.
 */
@Component({
  selector: 'app-sentence',
  templateUrl: './sentence.component.html',
  styleUrls: ['./columns-shared.css', './sentence.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class SentenceComponent extends ColumnVariantBase {
  readonly listSeparator = listSeparator;

  readonly panels = computed<SentencePanel[]>(() =>
    (this.groups() ?? []).map(group => ({ group, ...splitNextUp(group) })));
}
