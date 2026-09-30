import { STRIP_WINDOW_MIN, minutesAway } from '../arrival-visuals';
import { TrainArrivalDisplay } from '../train-arrival-groups';

/**
 * The geometry the 3D styles place trains with. Angular-free, like arrival-visuals.ts, so it is
 * unit-tested without a TestBed; the components turn these unitless numbers into pixels in CSS.
 */

/** The same half hour the Headway strip and the Approach track span, so the styles agree. */
export const DEPTH_WINDOW_MIN = STRIP_WINDOW_MIN;

/**
 * How far into the scene a train sits: 0 at the platform, 1 at the far end of the window. A square
 * root for the same reason as `trackPercent` — on a linear scale the trains 2 and 4 minutes out
 * are one on top of the other, and perspective shrinks the far end further still.
 */
export function depthFraction(minutes: number): number {
  return Math.sqrt(Math.min(Math.max(minutes, 0), DEPTH_WINDOW_MIN) / DEPTH_WINDOW_MIN);
}

export interface DepthMarker {
  arrival: TrainArrivalDisplay;
  minutes: number;
  /** 0–1 into the scene; see `depthFraction`. */
  fraction: number;
  /** Past the window: parked at the far end, drawn as a light rather than a train. */
  overflow: boolean;
}

/**
 * A marker for every train whose countdown can be read. An unreadable one (`'--'`) has no depth, so
 * it is left off rather than drawn at the platform, where it would read as due.
 */
export function depthMarkers(arrivals: TrainArrivalDisplay[]): DepthMarker[] {
  const markers: DepthMarker[] = [];
  for (const arrival of arrivals) {
    const minutes = minutesAway(arrival.countdown);
    if (minutes !== null) {
      markers.push({ arrival, minutes, fraction: depthFraction(minutes), overflow: minutes > DEPTH_WINDOW_MIN });
    }
  }
  return markers;
}

// ── Time Stack ──

/** Cards shown per direction; the rest are counted on the last one. */
export const STACK_MAX_CARDS = 4;
/**
 * The least a card sits behind the one in front of it. Two trains a minute apart — or two with the
 * same countdown, which the API does emit — would otherwise be one card hidden behind another.
 */
export const STACK_MIN_STEP = 0.16;

export interface StackCard {
  arrival: TrainArrivalDisplay;
  /** 0 for the card in front; the component turns it into depth and lift. */
  offset: number;
  /** Minutes after the train in front, for the gap label; null for the front card or an unreadable one. */
  gapBefore: number | null;
}

/**
 * The cards of one direction, each sitting behind the one before it by how long after it arrives.
 * Depth is measured from the front train rather than from now, so a stack whose next train is 20
 * minutes away still starts at the front: what the stack shows is the spacing, and the front card
 * says how long.
 */
export function timeStack(arrivals: TrainArrivalDisplay[], max = STACK_MAX_CARDS): { cards: StackCard[]; hidden: number } {
  const shown = arrivals.slice(0, max);
  const first = minutesAway(shown[0]?.countdown ?? '');
  const cards: StackCard[] = [];
  let previousMinutes: number | null = first;
  shown.forEach((arrival, index) => {
    const minutes = minutesAway(arrival.countdown);
    if (index === 0) {
      cards.push({ arrival, offset: 0, gapBefore: null });
      return;
    }
    const byTime = minutes !== null && first !== null ? depthFraction(minutes - first) : 0;
    const offset = Math.max(byTime, cards[index - 1].offset + STACK_MIN_STEP);
    const gapBefore = minutes !== null && previousMinutes !== null ? minutes - previousMinutes : null;
    cards.push({ arrival, offset, gapBefore });
    previousMinutes = minutes;
  });
  return { cards, hidden: Math.max(0, arrivals.length - shown.length) };
}

// ── Diorama camera ──

/** Degrees. Yaw turns the model on the table; pitch is how far above it you look from. */
export const ORBIT = {
  yaw: { min: -55, max: 55, rest: -22 },
  pitch: { min: 28, max: 68, rest: 56 }
} as const;

export interface Orbit {
  yaw: number;
  pitch: number;
}

export const REST_ORBIT: Orbit = { yaw: ORBIT.yaw.rest, pitch: ORBIT.pitch.rest };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Keeps the camera where the model still reads: past these the track is seen end-on, or from
 * underneath, and the labels stand edge-on to you.
 */
export function clampOrbit(orbit: Orbit): Orbit {
  return {
    yaw: clamp(orbit.yaw, ORBIT.yaw.min, ORBIT.yaw.max),
    pitch: clamp(orbit.pitch, ORBIT.pitch.min, ORBIT.pitch.max)
  };
}

/** Degrees of yaw per pixel dragged: a full swipe across a phone is about one side to the other. */
export const DRAG_YAW_PER_PX = 0.35;

/**
 * The camera for a device orientation reading, relative to how the phone was held when tilt was
 * switched on (`baseline`), so the rest pose is wherever the rider's hand already is rather than
 * flat on a table. `gamma` is the left-right tilt and turns the model; `beta` is front-back and
 * raises or lowers the eye.
 */
export function tiltToOrbit(reading: { beta: number; gamma: number }, baseline: { beta: number; gamma: number }): Orbit {
  return clampOrbit({
    yaw: ORBIT.yaw.rest + (reading.gamma - baseline.gamma) * 1.4,
    pitch: ORBIT.pitch.rest - (reading.beta - baseline.beta) * 0.9
  });
}

// ── Neon Skyline billboards ──

export interface Billboard {
  /** Screen x of the train the sign stands over, in px. */
  x: number;
  /** Screen y of that train on the floor, in px. */
  y: number;
  /** Everything about the sign (width, height, stem) is multiplied by this on screen. */
  scale: number;
  /** The sign's width before scaling, in px. */
  width: number;
}

/** A sign's height, the shortest stem, and how much taller each lane's stem is, all before scaling. */
export const BILLBOARD_METRICS = { height: 30, stem: 22, step: 40 } as const;

/**
 * A stem height (lane) per sign, so no two signs overlap on screen. Signs are placed nearest the
 * viewer first, since the nearest trains matter most and get the shortest stems; each takes the
 * lowest lane whose box on screen is clear, or the one it overlaps least.
 *
 * Done in two dimensions on screen rather than along the track, because the stem is scaled with
 * the sign: a far sign in a high lane can land exactly where a nearer one stands, which spacing
 * the trains by depth alone cannot see.
 */
export function stackBillboards(signs: Billboard[], lanes = 4, gap = 3): number[] {
  const { height, stem, step } = BILLBOARD_METRICS;
  const boxFor = (sign: Billboard, lane: number) => {
    const bottom = sign.y - (stem + lane * step) * sign.scale;
    const half = sign.width * sign.scale / 2;
    return { left: sign.x - half, right: sign.x + half, top: bottom - height * sign.scale, bottom };
  };
  type Box = ReturnType<typeof boxFor>;
  const overlap = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + gap) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + gap);

  const placed: Box[] = [];
  const result = new Array<number>(signs.length);
  const nearestFirst = signs.map((_, i) => i).sort((a, b) => signs[b].y - signs[a].y);
  for (const index of nearestFirst) {
    const options = Array.from({ length: lanes }, (_, lane) => boxFor(signs[index], lane));
    const cost = options.map(box => placed.reduce((sum, other) => sum + overlap(box, other), 0));
    const free = cost.findIndex(value => value === 0);
    const lane = free >= 0 ? free : cost.indexOf(Math.min(...cost));
    placed.push(options[lane]);
    result[index] = lane;
  }
  return result;
}

// ── Holo Card ──

/** Degrees a card tips at the edge of the finger's reach, or at the gyroscope's clamp. */
export const CARD_TILT_MAX = 14;

export interface CardTilt {
  /** Degrees about the horizontal axis; positive tips the top edge away. */
  rx: number;
  /** Degrees about the vertical axis; positive tips the right edge away. */
  ry: number;
  /** Where the light catches the foil, 0–100 across and down the card. */
  glareX: number;
  glareY: number;
}

/** Flat, lit from the upper left. */
export const REST_TILT: CardTilt = { rx: 0, ry: 0, glareX: 35, glareY: 25 };

/**
 * The tilt for a finger at (x, y) within a card `width` × `height`: the card tips away under the
 * finger, like pressing a real card on its corner, and the glare sits where the finger is. A
 * position outside the card is clamped to its edge.
 */
export function cardTilt(x: number, y: number, width: number, height: number): CardTilt {
  const nx = width > 0 ? clamp(x / width, 0, 1) : 0.5;
  const ny = height > 0 ? clamp(y / height, 0, 1) : 0.5;
  return {
    rx: (0.5 - ny) * 2 * CARD_TILT_MAX,
    ry: (nx - 0.5) * 2 * CARD_TILT_MAX,
    glareX: nx * 100,
    glareY: ny * 100
  };
}

/**
 * The same tilt from the gyroscope, relative to how the phone was held when tilt was switched on.
 * Mapped through `cardTilt`, so tipping the phone moves the light exactly as a finger would.
 */
export function tiltToCard(reading: { beta: number; gamma: number }, baseline: { beta: number; gamma: number }): CardTilt {
  // A 30° turn of the phone reaches the edge of the card.
  const nx = 0.5 + (reading.gamma - baseline.gamma) / 60;
  const ny = 0.5 + (reading.beta - baseline.beta) / 60;
  return cardTilt(nx, ny, 1, 1);
}

/** Later cards shown in the hand; the rest are counted beside it. */
export const HAND_MAX_CARDS = 4;

/**
 * A hand of cards: each fanned about the middle of the hand, and lowered along an arc toward the
 * ends, the way cards sit when held. One card is held straight.
 */
export function fanLayout(count: number): Array<{ angle: number; lift: number }> {
  const middle = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => ({
    angle: (i - middle) * 7,
    lift: (i - middle) ** 2 * 5
  }));
}
