import { describe, expect, it } from 'vitest';
import { TrainArrivalDisplay } from '../train-arrival-groups';
import {
  BILLBOARD_METRICS, CARD_TILT_MAX, DEPTH_WINDOW_MIN, stackBillboards, ORBIT, cardTilt, fanLayout, tiltToCard, REST_ORBIT, STACK_MAX_CARDS, STACK_MIN_STEP, clampOrbit, depthFraction, depthMarkers,
  tiltToOrbit, timeStack
} from './depth-geometry';

function arrival(countdown: string, rn = countdown): TrainArrivalDisplay {
  return { countdown, rn, destNm: 'Howard' } as TrainArrivalDisplay;
}

describe('depthFraction', () => {
  it('runs from the platform to the far end of the window on a square root', () => {
    expect(depthFraction(0)).toBe(0);
    expect(depthFraction(DEPTH_WINDOW_MIN)).toBe(1);
    expect(depthFraction(DEPTH_WINDOW_MIN / 4)).toBeCloseTo(0.5);
  });

  it('clamps anything outside the window', () => {
    expect(depthFraction(-3)).toBe(0);
    expect(depthFraction(90)).toBe(1);
  });

  it('keeps near trains further apart than a linear scale would', () => {
    expect(depthFraction(4) - depthFraction(2)).toBeGreaterThan((4 - 2) / DEPTH_WINDOW_MIN);
  });
});

describe('depthMarkers', () => {
  it('places due trains at the platform and leaves unreadable ones off', () => {
    const markers = depthMarkers([arrival('DUE'), arrival('--'), arrival('7')]);
    expect(markers.map(marker => marker.minutes)).toEqual([0, 7]);
    expect(markers[0].fraction).toBe(0);
  });

  it('flags trains past the window and parks them at the far end', () => {
    const [marker] = depthMarkers([arrival('41')]);
    expect(marker.overflow).toBe(true);
    expect(marker.fraction).toBe(1);
  });
});

describe('timeStack', () => {
  it('puts the front card at zero whatever its countdown', () => {
    const { cards } = timeStack([arrival('18'), arrival('26')]);
    expect(cards[0].offset).toBe(0);
    expect(cards[1].gapBefore).toBe(8);
  });

  it('spaces cards by the minutes between them', () => {
    const { cards } = timeStack([arrival('2'), arrival('5'), arrival('20')]);
    expect(cards[2].offset - cards[1].offset).toBeGreaterThan(cards[1].offset - cards[0].offset);
    expect(cards.map(card => card.gapBefore)).toEqual([null, 3, 15]);
  });

  it('never lets two cards share a depth', () => {
    const { cards } = timeStack([arrival('4', 'a'), arrival('4', 'b'), arrival('5', 'c')]);
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].offset - cards[i - 1].offset).toBeGreaterThanOrEqual(STACK_MIN_STEP - 1e-9);
    }
  });

  it('steps an unreadable card behind the one in front and gives it no gap', () => {
    const { cards } = timeStack([arrival('3'), arrival('--'), arrival('9')]);
    expect(cards[1].offset).toBeCloseTo(STACK_MIN_STEP);
    expect(cards[1].gapBefore).toBeNull();
    expect(cards[2].gapBefore).toBeNull();
  });

  it('counts the cards it does not show', () => {
    const many = Array.from({ length: STACK_MAX_CARDS + 2 }, (_, i) => arrival(String(i * 5 + 1)));
    const { cards, hidden } = timeStack(many);
    expect(cards).toHaveLength(STACK_MAX_CARDS);
    expect(hidden).toBe(2);
  });

  it('handles an empty direction', () => {
    expect(timeStack([])).toEqual({ cards: [], hidden: 0 });
  });
});

describe('diorama camera', () => {
  it('clamps both axes', () => {
    expect(clampOrbit({ yaw: 400, pitch: -10 })).toEqual({ yaw: ORBIT.yaw.max, pitch: ORBIT.pitch.min });
    expect(clampOrbit(REST_ORBIT)).toEqual(REST_ORBIT);
  });

  it('rests wherever the phone was held when tilt was switched on', () => {
    expect(tiltToOrbit({ beta: 47, gamma: -8 }, { beta: 47, gamma: -8 })).toEqual(REST_ORBIT);
  });

  it('turns with a left-right tilt and rises with a front-back one', () => {
    const baseline = { beta: 40, gamma: 0 };
    expect(tiltToOrbit({ beta: 40, gamma: 10 }, baseline).yaw).toBeGreaterThan(REST_ORBIT.yaw);
    expect(tiltToOrbit({ beta: 30, gamma: 0 }, baseline).pitch).toBeGreaterThan(REST_ORBIT.pitch);
  });

  it('never tilts past the clamp however far the phone is turned', () => {
    const orbit = tiltToOrbit({ beta: -90, gamma: 90 }, { beta: 45, gamma: 0 });
    expect(orbit).toEqual({ yaw: ORBIT.yaw.max, pitch: ORBIT.pitch.max });
  });
});

describe('cardTilt', () => {
  it('lies flat under a finger in the middle', () => {
    expect(cardTilt(100, 50, 200, 100)).toEqual({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
  });

  it('tips the corner under the finger away, and puts the glare there', () => {
    const tilt = cardTilt(200, 0, 200, 100);
    expect(tilt).toEqual({ rx: CARD_TILT_MAX, ry: CARD_TILT_MAX, glareX: 100, glareY: 0 });
  });

  it('clamps a finger that has slid off the card', () => {
    expect(cardTilt(-50, 400, 200, 100)).toEqual(cardTilt(0, 100, 200, 100));
  });

  it('survives a card that has not been laid out yet', () => {
    expect(cardTilt(10, 10, 0, 0)).toEqual({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
  });
});

describe('tiltToCard', () => {
  it('rests flat, lit in the middle, at the baseline', () => {
    const tilt = tiltToCard({ beta: 40, gamma: 5 }, { beta: 40, gamma: 5 });
    expect(tilt.rx).toBeCloseTo(0);
    expect(tilt.ry).toBeCloseTo(0);
  });

  it('never tips past the maximum however far the phone turns', () => {
    const tilt = tiltToCard({ beta: 120, gamma: -90 }, { beta: 40, gamma: 0 });
    expect(tilt.rx).toBe(-CARD_TILT_MAX);
    expect(tilt.ry).toBe(-CARD_TILT_MAX);
  });
});

describe('fanLayout', () => {
  it('holds a single card straight', () => {
    expect(fanLayout(1)).toEqual([{ angle: 0, lift: 0 }]);
  });

  it('fans symmetrically about the middle, lower at the ends', () => {
    const fan = fanLayout(3);
    expect(fan.map(card => card.angle)).toEqual([-7, 0, 7]);
    expect(fan[0].lift).toBe(fan[2].lift);
    expect(fan[0].lift).toBeGreaterThan(fan[1].lift);
  });

  it('handles an empty hand', () => {
    expect(fanLayout(0)).toEqual([]);
  });
});

describe('stackBillboards', () => {
  const sign = (x: number, y: number, scale = 1) => ({ x, y, scale, width: 60 });

  it('keeps signs that are well apart on the shortest stem', () => {
    expect(stackBillboards([sign(50, 300), sign(300, 300)])).toEqual([0, 0]);
  });

  it('lifts a far sign that would stand where a nearer one does', () => {
    // The far sign's train is a sign-height above the near one's, at the same x.
    const near = sign(100, 300);
    const far = sign(100, 300 - BILLBOARD_METRICS.height, 1);
    expect(stackBillboards([far, near])).toEqual([1, 0]);
  });

  it('gives the nearest train priority whatever the input order', () => {
    const lanes = stackBillboards([sign(100, 280), sign(100, 300), sign(100, 290)]);
    expect(lanes[1]).toBe(0);
  });

  it('accounts for the stem being scaled with the sign', () => {
    // A small far sign in lane 1 would rise only 40 × 0.3 px: not enough to clear, so it goes higher.
    const lanes = stackBillboards([sign(100, 200, 1), sign(100, 180, 0.3)]);
    expect(lanes[0]).toBe(0);
    expect(lanes[1]).toBeGreaterThan(0);
  });

  it('settles on the least overlap when every lane is taken', () => {
    const crowd = Array.from({ length: 6 }, (_, i) => sign(100, 300 - i));
    const lanes = stackBillboards(crowd, 2);
    expect(lanes.every(lane => lane === 0 || lane === 1)).toBe(true);
  });
});
