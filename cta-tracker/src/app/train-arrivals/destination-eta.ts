import { CTAComprehensiveData, TRAIN_ROUTE_ID_TO_LINE_NAME, TrainEta } from '../trainResponse';
import { formatClockTime, parseTrainTime } from '../services/arrival-time';

/** When a train from this station gets to the rider's chosen destination. */
export interface DestinationEta {
  name: string;
  /** The instant on this device's clock, anchored the same way as the origin's arrival. */
  epochMs: number;
  rideMinutes: number;
}

export interface DestinationStation {
  id: string;
  name: string;
}

/**
 * The same run's arrival at the destination, or undefined when it never gets there (the other
 * direction, a short-turn, or a destination past where predictions reach).
 *
 * Takes the earliest destination arrival strictly after the origin's: a run that circles the Loop
 * shows up at a Brown Line station twice, once on the trip it is finishing (before it reaches the
 * origin) and once on the way back out. `rt` is matched too, since run numbers are per line.
 */
export function matchDestinationArrival(origin: TrainEta, destEtas: readonly TrainEta[]): TrainEta | undefined {
  const leaves = parseTrainTime(origin.arrT);
  if (isNaN(leaves)) {
    return undefined;
  }
  let best: TrainEta | undefined;
  let bestTime = Infinity;
  for (const eta of destEtas) {
    if (eta.rn !== origin.rn || eta.rt !== origin.rt) {
      continue;
    }
    const arrives = parseTrainTime(eta.arrT);
    if (arrives > leaves && arrives < bestTime) {
      best = eta;
      bestTime = arrives;
    }
  }
  return best;
}

/** The line's stations in order, minus the one the rider is standing at: the destination picker. */
export function destinationStations(
  data: CTAComprehensiveData | null,
  routeId: string,
  originId: string
): DestinationStation[] {
  const sequence = data?.stopSequences?.[TRAIN_ROUTE_ID_TO_LINE_NAME[routeId]];
  if (!data || !sequence) {
    return [];
  }
  // A Loop line can list a station on both legs; the picker needs it once.
  return [...new Set(sequence.stops)]
    .filter(id => id !== originId && data.stations[id])
    .map(id => ({ id, name: data.stations[id].name }));
}

/**
 * `6:44 PM · 19 min`, printed after the station name under a train that gets there. Kept apart
 * from the name so a narrow row breaks after the name rather than leaving "min" on its own line.
 */
export function destinationTimeLabel(destination: DestinationEta): string {
  return `${formatClockTime(destination.epochMs)} · ${destination.rideMinutes} min`;
}

/**
 * `Belmont (Red/Brown/Purple)` → `Belmont`. The transfer list is noise on a row that is already on
 * one line; the picker keeps the full name, where two same-named stations need telling apart.
 */
export function shortStationName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '') || name;
}
