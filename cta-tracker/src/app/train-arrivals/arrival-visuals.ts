import { TrainArrivalDisplay } from './train-arrival-groups';

/**
 * The geometry and labels the column styles and the Approach layout draw from. Angular-free, like
 * train-arrival-groups.ts, so it is unit-tested without a TestBed.
 */

/** Minutes until arrival: 0 for `'DUE'`, null when the countdown could not be read (`'--'`). */
export function minutesAway(countdown: string): number | null {
  if (countdown === 'DUE') {
    return 0;
  }
  const minutes = parseInt(countdown, 10);
  return Number.isNaN(minutes) ? null : minutes;
}

// ── Headway strip ──

/** The strip always spans the same half hour, so the spacing reads the same at every station. */
export const STRIP_WINDOW_MIN = 30;
/** A gap this long gets hatched: long enough that a rider would change plans over it. */
export const WIDE_GAP_MIN = 12;

export interface StripTick {
  arrival: TrainArrivalDisplay;
  minutes: number;
  /** Position along the strip, 0–100. */
  percent: number;
  /** Past the window: drawn pinned to the right end with an overflow mark instead of its number. */
  overflow: boolean;
}

export interface StripGap {
  /** Minutes between this train and the one before it. */
  minutes: number;
  left: number;
  width: number;
  wide: boolean;
}

export function stripPercent(minutes: number): number {
  return Math.min(100, Math.max(0, minutes / STRIP_WINDOW_MIN * 100));
}

/**
 * One strip per direction: a tick for every train and the gap between each consecutive pair.
 * Arrivals whose countdown cannot be read have no position, so they are left off rather than
 * drawn at zero, where they would read as due.
 */
export function headwayStrip(arrivals: TrainArrivalDisplay[]): { ticks: StripTick[]; gaps: StripGap[] } {
  const ticks: StripTick[] = [];
  for (const arrival of arrivals) {
    const minutes = minutesAway(arrival.countdown);
    if (minutes !== null) {
      ticks.push({ arrival, minutes, percent: stripPercent(minutes), overflow: minutes > STRIP_WINDOW_MIN });
    }
  }
  const gaps = ticks.slice(1).map((tick, i) => {
    const previous = ticks[i];
    const minutes = tick.minutes - previous.minutes;
    return {
      minutes,
      left: previous.percent,
      width: tick.percent - previous.percent,
      wide: minutes >= WIDE_GAP_MIN
    };
  });
  return { ticks, gaps };
}

/** Minutes after the train before, for the table's Δ column; null for the first or an unreadable one. */
export function headwayBefore(arrivals: TrainArrivalDisplay[], index: number): number | null {
  if (index <= 0) {
    return null;
  }
  const current = minutesAway(arrivals[index].countdown);
  const previous = minutesAway(arrivals[index - 1].countdown);
  return current === null || previous === null ? null : current - previous;
}

// ── Approach track ──

/**
 * Where the station sits across the track, as a percentage of its width, and how much of the
 * track each side's half hour spans. A one-direction stop is usually a terminal, so its station
 * sits at the right end and every train comes from the left.
 */
export const TRACK_STATION_PERCENT = { double: 50, single: 90 } as const;
/* Short of the edges: a pill is centred on its train, so one at the very end would be half off. */
const TRACK_SPAN_PERCENT = { double: 40, single: 80 } as const;

/**
 * A train's position along the track. The scale is a square root: trains 2 and 4 minutes out
 * would otherwise land on top of each other and the station, while a linear scale wide enough to
 * separate them would push anything past 15 minutes off the screen.
 */
export function trackPercent(minutes: number, side: 'left' | 'right' | 'single'): number {
  const layout = side === 'single' ? 'single' : 'double';
  const offset = Math.sqrt(Math.min(Math.max(minutes, 0), STRIP_WINDOW_MIN) / STRIP_WINDOW_MIN)
    * TRACK_SPAN_PERCENT[layout];
  return side === 'right'
    ? TRACK_STATION_PERCENT.double + offset
    : TRACK_STATION_PERCENT[layout] - offset;
}

/**
 * The rows a pill can sit in around the Approach track, nearest the line first: above, below,
 * then a second row above and below. Alternating above and below was not enough — trains at 20
 * and 22 minutes land a few pixels apart on the square-root scale, and a third close one lands
 * back on top of the first.
 */
export const TRACK_LANES = 4;

export interface LaneItem {
  /** Centre of the pill along the track, 0–100. */
  percent: number;
  /** The pill's width as a percentage of the track. */
  widthPercent: number;
}

/**
 * Gives each pill the nearest lane where it does not overlap a pill already placed there,
 * working left to right. `seeded` pills are placed first and never move — the Approach layout
 * seeds the Due pill over the station. When every lane is taken, a pill goes where it overlaps
 * least: four trains within one pill's width is rare enough to accept.
 *
 * Returns a lane per item, in the order the items were given.
 */
export function assignLanes(items: LaneItem[], seeded: Array<LaneItem & { lane: number }> = [],
                            lanes = TRACK_LANES, gapPercent = 1): number[] {
  const occupied: Array<Array<[number, number]>> = Array.from({ length: lanes }, () => []);
  const span = (item: LaneItem): [number, number] =>
    [item.percent - item.widthPercent / 2, item.percent + item.widthPercent / 2];
  const overlap = ([a0, a1]: [number, number], [b0, b1]: [number, number]) =>
    Math.max(0, Math.min(a1, b1) - Math.max(a0, b0) + gapPercent);

  for (const seed of seeded) {
    occupied[Math.min(Math.max(seed.lane, 0), lanes - 1)].push(span(seed));
  }

  const result = new Array<number>(items.length);
  const order = items.map((_, index) => index).sort((a, b) => items[a].percent - items[b].percent);
  for (const index of order) {
    const box = span(items[index]);
    const cost = occupied.map(taken => taken.reduce((sum, other) => sum + overlap(box, other), 0));
    const free = cost.findIndex(value => value === 0);
    const lane = free >= 0 ? free : cost.indexOf(Math.min(...cost));
    occupied[lane].push(box);
    result[index] = lane;
  }
  return result;
}

// ── Seven-segment readout ──

export type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

/** The segments are drawn in a 12.5 × 20 box: [x, y, width, height]. */
export const SEGMENT_RECTS: ReadonlyArray<readonly [Segment, number, number, number, number]> = [
  ['a', 2.2, 0.6, 7.6, 1.8],
  ['b', 9.6, 2.2, 1.8, 6.8],
  ['c', 9.6, 11, 1.8, 6.8],
  ['d', 2.2, 17.6, 7.6, 1.8],
  ['e', 0.6, 11, 1.8, 6.8],
  ['f', 0.6, 2.2, 1.8, 6.8],
  ['g', 2.2, 9.1, 7.6, 1.8]
];

const SEGMENT_MAP: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  'd': 'bcdeg', 'U': 'bcdef', 'E': 'adefg', '-': 'g', ' ': ''
};

/** The lit segments for one character; anything the map cannot draw stays dark. */
export function litSegments(char: string): ReadonlySet<Segment> {
  return new Set((SEGMENT_MAP[char] ?? '') as Iterable<Segment>);
}

/**
 * The characters a readout shows: a two-digit field for minutes, so a one-digit countdown keeps a
 * ghost 8 in front of it the way a watch does, and `dUE` for a train that is due. Anything past 99
 * is shown as 99 rather than widening the field.
 */
export function readoutChars(countdown: string): string[] {
  if (countdown === 'DUE') {
    return ['d', 'U', 'E'];
  }
  const minutes = minutesAway(countdown);
  return minutes === null ? ['-', '-'] : [...String(Math.min(minutes, 99)).padStart(2, ' ')];
}

// ── Flip clock ──

/**
 * The cards a split-flap readout shows: two for minutes, with a blank card in front of a single
 * digit so the number does not jump sideways when it drops from 10 to 9; three for `DUE`.
 */
export function flipChars(countdown: string): string[] {
  if (countdown === 'DUE') {
    return ['D', 'U', 'E'];
  }
  const minutes = minutesAway(countdown);
  return minutes === null ? ['-', '-'] : [...String(Math.min(minutes, 99)).padStart(2, ' ')];
}

// ── Labels ──

/** `HH:MM` on the device clock, for the styles that read like a departure board. */
export function clock24(epochMs: number): string {
  if (!Number.isFinite(epochMs)) {
    return '--:--';
  }
  const time = new Date(epochMs);
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
}

/** `Ashland/63rd & Cottage Grove-bound` → `ASHLAND_63RD_COTTAGE_GROVE_BOUND`. */
export function snakeLabel(label: string): string {
  return label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** `Howard-bound` → `Howard`: the terminal, for places where "bound" is said another way. */
export function placeName(label: string): string {
  return label.replace(/-bound$/i, '');
}

/**
 * True when one direction's trains are not all going to the same place: the Green Line's trDr 5
 * splits between Ashland/63rd and Cottage Grove, and the Blue Line short-turns. The styles that
 * name a destination only once use this to label the rest.
 */
export function hasMixedDestinations(arrivals: TrainArrivalDisplay[]): boolean {
  return new Set(arrivals.map(arrival => arrival.destNm)).size > 1;
}
