import { TrainEta, TRAIN_DIRECTION_MAP } from '../trainResponse';

/** A CTA arrival prediction with the presentation values the arrivals screens derive from it. */
export interface TrainArrivalDisplay extends TrainEta {
  /** `'DUE'`, a minute count, or `'--'` when the prediction cannot be read. */
  countdown: string;
  /**
   * The instant on this device's clock the countdown is derived from, or NaN when unknown. The
   * board styles print it as a 24-hour time, which the countdown string cannot give them.
   */
  arrivalEpochMs: number;
  apiArrivalTime: string;
  distance: string;
  lineColor: string;
}

export interface ArrivalGroup {
  /** `${rt}_${trDr}` — stable across refreshes, unlike the label, which two routes can share. */
  key: string;
  trDr: string;
  directionLabel: string;
  arrivals: TrainArrivalDisplay[];
}

/**
 * `'label'` is the list layout's alphabetical order. `'columns'` needs `'direction'`: the column a
 * direction lands in has to be the same at every station on a line, and alphabetical order flips
 * left and right between lines (Red's "95th/Dan Ryan-bound" sorts first, Blue's does not).
 * A rider can swap the two sides per line; see `groupTrainArrivals`.
 */
export type GroupOrder = 'label' | 'direction';

/**
 * CTA's own numbering: trDr '1' is one end of the line, '5' the other, and those are the only two
 * values the API emits. Anything else sorts last rather than guessing at a position for it.
 */
export function directionSortKey(trDr: string): number {
  return trDr === '1' ? 1 : trDr === '5' ? 5 : Number.MAX_SAFE_INTEGER;
}

/**
 * Groups arrivals by route and direction, preserving the API's order within each group (which is
 * soonest-first). The label comes from TRAIN_DIRECTION_MAP, falling back to the API's own stop
 * description for a route the map does not know.
 *
 * `swapped` puts trDr '5' before '1' under `'direction'`, for a rider who has flipped this line's
 * columns. It is applied in the sort rather than by reversing the result, so an unknown direction
 * still sorts last. The list layout's `'label'` order ignores it.
 */
export function groupTrainArrivals(
  arrivals: TrainArrivalDisplay[],
  order: GroupOrder,
  swapped = false
): ArrivalGroup[] {
  const groupMap = new Map<string, ArrivalGroup>();
  for (const arrival of arrivals) {
    const key = `${arrival.rt}_${arrival.trDr}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        trDr: arrival.trDr,
        directionLabel: TRAIN_DIRECTION_MAP[arrival.rt]?.[arrival.trDr] ?? arrival.stpDe,
        arrivals: []
      };
      groupMap.set(key, group);
    }
    group.arrivals.push(arrival);
  }

  const groups = Array.from(groupMap.values());
  const rank = (trDr: string) => {
    const key = directionSortKey(trDr);
    return swapped && key !== Number.MAX_SAFE_INTEGER ? -key : key;
  };
  return order === 'direction'
    ? groups.sort((a, b) => rank(a.trDr) - rank(b.trDr))
    : groups.sort((a, b) => a.directionLabel.localeCompare(b.directionLabel));
}

/**
 * The next train and everything behind it. `later` is empty for a group of one, which is the
 * common case late at night.
 */
export function splitNextUp(group: ArrivalGroup): {
  hero: TrainArrivalDisplay | null;
  later: TrainArrivalDisplay[];
} {
  return { hero: group.arrivals[0] ?? null, later: group.arrivals.slice(1) };
}
