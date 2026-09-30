import { describe, expect, it } from 'vitest';
import { TrainArrivalDisplay } from '../train-arrival-groups';
import {
  DEPTH_WINDOW_MIN, ORBIT, REST_ORBIT, STACK_MAX_CARDS, STACK_MIN_STEP, clampOrbit, depthFraction, depthMarkers,
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

