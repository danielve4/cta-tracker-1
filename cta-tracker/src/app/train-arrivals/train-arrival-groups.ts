import { TrainEta, TRAIN_DIRECTION_MAP } from '../trainResponse';

/** A CTA arrival prediction with the presentation values the arrivals screens derive from it. */
export interface TrainArrivalDisplay extends TrainEta {
  countdown: string;
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
 */
export function groupTrainArrivals(
  arrivals: TrainArrivalDisplay[],
  order: GroupOrder
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
  return order === 'direction'
    ? groups.sort((a, b) => directionSortKey(a.trDr) - directionSortKey(b.trDr))
    : groups.sort((a, b) => a.directionLabel.localeCompare(b.directionLabel));
}
