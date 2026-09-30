import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeuntilPipe } from '../../timeuntil.pipe';
import { ColumnVariantBase } from '../columns/column-variant.base';
import { ArrivalGroup, TrainArrivalDisplay } from '../train-arrival-groups';
import { StackCard, timeStack } from './depth-geometry';

interface Stack {
  group: ArrivalGroup;
  cards: StackCard[];
  hidden: number;
  /** The deepest card's offset, which the stack's height is sized from. */
  depth: number;
}

/**
 * Time Machine for trains: each direction a stack of glass slabs, the next train in front
 * and every later one further back, spaced by how long after the one in front of it it comes. Two
 * trains bunched two minutes apart sit almost on top of each other; a twenty-minute gap opens a
 * visible hole in the stack. The spacing is `timeStack`'s, measured from the front train.
 *
 * The stack fans out from flat when it first renders: `--spread` is a registered `<number>`, so
 * `@starting-style` can transition it, and every card's transform multiplies its offset by it.
 */
@Component({
  selector: 'app-time-stack',
  templateUrl: './time-stack.component.html',
  styleUrls: ['../columns/columns-shared.css', './time-stack.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TimeuntilPipe]
})
export class TimeStackComponent extends ColumnVariantBase {
  readonly stacks = computed<Stack[]>(() =>
    (this.groups() ?? []).map(group => {
      const { cards, hidden } = timeStack(group.arrivals);
      return { group, cards, hidden, depth: cards.at(-1)?.offset ?? 0 };
    }));

  isDue(arrival: TrainArrivalDisplay): boolean {
    return arrival.countdown === 'DUE';
  }
}
