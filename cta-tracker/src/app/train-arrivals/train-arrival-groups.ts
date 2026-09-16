import { TrainEta, TRAIN_DIRECTION_MAP } from '../trainResponse';

/** A CTA arrival prediction with the presentation values the arrivals screens derive from it. */
export interface TrainArrivalDisplay extends TrainEta {
  /** `'DUE'`, a minute count, or `'--'` when the prediction cannot be read. */
  countdown: string;
  /**
   * The instant on this device's clock the countdown is derived from, or NaN when unknown. The
   * timeline needs to order arrivals across both directions, which the countdown string cannot do.
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

export interface TimelineRow {
  side: 'left' | 'right';
  arrival: TrainArrivalDisplay;
}

/**
 * Merges the groups into one arrival-time-ordered list, tagging each row with the side of the
 * spine it belongs on. Reading top to bottom is then reading "what comes next at this station",
 * and the side says which direction it is going.
 *
 * Arrivals with no readable time sort last rather than to the top, which is where NaN would put
 * them in a naive comparison. The sort is stable, so equal instants keep API order and a tie
 * between the two directions puts the left one first.
 */
export function mergeTimeline(groups: ArrivalGroup[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  groups.forEach((group, index) => {
    const side = index === 0 ? 'left' : 'right';
    for (const arrival of group.arrivals) {
      rows.push({ side, arrival });
    }
  });
  return rows.sort((a, b) => {
    const [at, bt] = [a.arrival.arrivalEpochMs, b.arrival.arrivalEpochMs];
    const aUnknown = !Number.isFinite(at);
    const bUnknown = !Number.isFinite(bt);
    if (aUnknown || bUnknown) {
      return aUnknown === bUnknown ? 0 : aUnknown ? 1 : -1;
    }
    return at - bt;
  });
}

/**
 * A destination short enough for a chip: the part before the first branch separator, truncated.
 * "Ashland/63rd" reads as "Ashland", "Cottage Grove" is already short enough to keep whole.
 */
export function shortDestination(destNm: string): string {
  const head = destNm.split(' & ')[0].split('/')[0].trim();
  return head.length > 14 ? head.slice(0, 14).trimEnd() + '…' : head;
}
