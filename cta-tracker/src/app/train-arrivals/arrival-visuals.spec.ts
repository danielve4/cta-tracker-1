import { describe, expect, it } from 'vitest';
import {
  STRIP_WINDOW_MIN, TRACK_LANES, assignLanes, TRACK_STATION_PERCENT, WIDE_GAP_MIN, clock24, hasMixedDestinations, headwayBefore,
  headwayStrip, flipChars, litSegments, minutesAway, placeName, readoutChars, snakeLabel, stripPercent,
  trackPercent
} from './arrival-visuals';
import { TrainArrivalDisplay } from './train-arrival-groups';

/** Only the fields these helpers read; the rest are irrelevant to them. */
function eta(countdown: string, destNm = 'Howard'): TrainArrivalDisplay {
  return { countdown, destNm } as TrainArrivalDisplay;
}

describe('minutesAway', () => {
  it('reads DUE as zero and a count as itself', () => {
    expect(minutesAway('DUE')).toBe(0);
    expect(minutesAway('7')).toBe(7);
  });

  it('gives null for a countdown that could not be read', () => {
    expect(minutesAway('--')).toBeNull();
    expect(minutesAway('')).toBeNull();
  });
});

describe('headwayStrip', () => {
  it('places each train along the half hour and measures the gaps between them', () => {
    const { ticks, gaps } = headwayStrip([eta('DUE'), eta('4'), eta('11'), eta('19')]);

    expect(ticks.map(tick => tick.minutes)).toEqual([0, 4, 11, 19]);
    expect(ticks[0].percent).toBe(0);
    expect(ticks[3].percent).toBeCloseTo(19 / STRIP_WINDOW_MIN * 100);
    expect(gaps.map(gap => gap.minutes)).toEqual([4, 7, 8]);
    expect(gaps[1].left).toBeCloseTo(ticks[1].percent);
    expect(gaps[1].width).toBeCloseTo(ticks[2].percent - ticks[1].percent);
  });

  it('marks a gap of the threshold or more as wide, and nothing shorter', () => {
    const { gaps } = headwayStrip([eta('2'), eta(String(2 + WIDE_GAP_MIN)), eta(String(2 + WIDE_GAP_MIN * 2 - 1))]);
    expect(gaps.map(gap => gap.wide)).toEqual([true, false]);
  });

  it('pins a train past the window to the end and flags it', () => {
    const { ticks } = headwayStrip([eta('20'), eta('42')]);
    expect(ticks[1].percent).toBe(100);
    expect(ticks[1].overflow).toBe(true);
    expect(ticks[0].overflow).toBe(false);
  });

  it('leaves an unreadable countdown off the strip rather than drawing it as due', () => {
    const { ticks, gaps } = headwayStrip([eta('--'), eta('6'), eta('13')]);
    expect(ticks.map(tick => tick.minutes)).toEqual([6, 13]);
    expect(gaps.map(gap => gap.minutes)).toEqual([7]);
  });

  it('has no gaps for a single train or none', () => {
    expect(headwayStrip([eta('5')]).gaps).toEqual([]);
    expect(headwayStrip([])).toEqual({ ticks: [], gaps: [] });
  });
});

describe('stripPercent', () => {
  it('clamps to the strip', () => {
    expect(stripPercent(-3)).toBe(0);
    expect(stripPercent(STRIP_WINDOW_MIN / 2)).toBe(50);
    expect(stripPercent(STRIP_WINDOW_MIN * 3)).toBe(100);
  });
});

describe('headwayBefore', () => {
  const arrivals = [eta('DUE'), eta('4'), eta('--'), eta('19')];

  it('is the gap to the previous train', () => {
    expect(headwayBefore(arrivals, 1)).toBe(4);
  });

  it('is null for the first train and around an unreadable one', () => {
    expect(headwayBefore(arrivals, 0)).toBeNull();
    expect(headwayBefore(arrivals, 2)).toBeNull();
    expect(headwayBefore(arrivals, 3)).toBeNull();
  });
});

describe('trackPercent', () => {
  it('puts a due train on the station', () => {
    expect(trackPercent(0, 'left')).toBe(TRACK_STATION_PERCENT.double);
    expect(trackPercent(0, 'right')).toBe(TRACK_STATION_PERCENT.double);
    expect(trackPercent(0, 'single')).toBe(TRACK_STATION_PERCENT.single);
  });

  it('moves each side away from the station in its own direction', () => {
    expect(trackPercent(10, 'left')).toBeLessThan(TRACK_STATION_PERCENT.double);
    expect(trackPercent(10, 'right')).toBeGreaterThan(TRACK_STATION_PERCENT.double);
    expect(trackPercent(10, 'single')).toBeLessThan(TRACK_STATION_PERCENT.single);
  });

  it('mirrors the two sides', () => {
    expect(trackPercent(9, 'left') + trackPercent(9, 'right')).toBeCloseTo(TRACK_STATION_PERCENT.double * 2);
  });

  it('spreads near trains more than far ones', () => {
    const near = trackPercent(4, 'right') - trackPercent(2, 'right');
    const far = trackPercent(24, 'right') - trackPercent(22, 'right');
    expect(near).toBeGreaterThan(far);
  });

  it('stays on the track past the window', () => {
    expect(trackPercent(90, 'right')).toBe(trackPercent(STRIP_WINDOW_MIN, 'right'));
    expect(trackPercent(90, 'left')).toBeGreaterThan(0);
    expect(trackPercent(90, 'single')).toBeGreaterThan(0);
    expect(trackPercent(90, 'right')).toBeLessThan(100);
  });
});

describe('seven-segment readout', () => {
  it('lights every segment for an 8 and none for a blank', () => {
    expect(litSegments('8').size).toBe(7);
    expect(litSegments(' ').size).toBe(0);
  });

  it('lights the right segments for a 1 and a 7', () => {
    expect([...litSegments('1')].sort()).toEqual(['b', 'c']);
    expect([...litSegments('7')].sort()).toEqual(['a', 'b', 'c']);
  });

  it('draws nothing for a character it has no shape for', () => {
    expect(litSegments('X').size).toBe(0);
  });

  it('keeps a two-digit field, with a ghost digit in front of a single one', () => {
    expect(readoutChars('4')).toEqual([' ', '4']);
    expect(readoutChars('17')).toEqual(['1', '7']);
  });

  it('spells DUE and caps anything past 99', () => {
    expect(readoutChars('DUE')).toEqual(['d', 'U', 'E']);
    expect(readoutChars('140')).toEqual(['9', '9']);
  });

  it('shows dashes for a countdown it cannot read', () => {
    expect(readoutChars('--')).toEqual(['-', '-']);
  });
});

describe('clock24', () => {
  it('pads hours and minutes', () => {
    expect(clock24(new Date(2026, 8, 15, 7, 5).getTime())).toBe('07:05');
    expect(clock24(new Date(2026, 8, 15, 17, 42).getTime())).toBe('17:42');
  });

  it('gives a placeholder for an unknown time', () => {
    expect(clock24(NaN)).toBe('--:--');
  });
});

describe('labels', () => {
  it('snake-cases a direction label', () => {
    expect(snakeLabel('Howard-bound')).toBe('HOWARD_BOUND');
    expect(snakeLabel('95th/Dan Ryan-bound')).toBe('95TH_DAN_RYAN_BOUND');
    expect(snakeLabel('Ashland/63rd & Cottage Grove-bound')).toBe('ASHLAND_63RD_COTTAGE_GROVE_BOUND');
    expect(snakeLabel("O'Hare-bound")).toBe('O_HARE_BOUND');
  });

  it('takes the terminal out of a direction label', () => {
    expect(placeName('Howard-bound')).toBe('Howard');
    expect(placeName('Ashland/63rd & Cottage Grove-bound')).toBe('Ashland/63rd & Cottage Grove');
    expect(placeName('Service toward Loop')).toBe('Service toward Loop');
  });

  it('spots a direction whose trains split between destinations', () => {
    expect(hasMixedDestinations([eta('1', 'Ashland/63rd'), eta('7', 'Cottage Grove')])).toBe(true);
    expect(hasMixedDestinations([eta('1'), eta('7')])).toBe(false);
    expect(hasMixedDestinations([])).toBe(false);
  });
});

describe('assignLanes', () => {
  const pill = (percent: number, widthPercent = 14) => ({ percent, widthPercent });

  it('keeps trains that are far apart in the lane nearest the line', () => {
    expect(assignLanes([pill(10), pill(40), pill(70)])).toEqual([0, 0, 0]);
  });

  it('puts two close trains, like 20 and 22 minutes, in different lanes', () => {
    const [a, b] = assignLanes([pill(trackPercent(20, 'right')), pill(trackPercent(22, 'right'))]);
    expect(a).not.toBe(b);
  });

  it('uses every lane before doubling up', () => {
    const lanes = assignLanes([pill(50), pill(51), pill(52), pill(53)]);
    expect(new Set(lanes).size).toBe(TRACK_LANES);
  });

  it('doubles up where the overlap is smallest once every lane is taken', () => {
    const lanes = assignLanes([pill(40), pill(50), pill(51), pill(52), pill(60)]);
    // 40 and 60 overlap each other less than anything near 50, so they end up sharing a lane.
    expect(lanes[0]).toBe(lanes[4]);
  });

  it('works left to right whatever order the items come in', () => {
    expect(assignLanes([pill(52), pill(50)])).toEqual([1, 0]);
  });

  it('keeps clear of a seeded pill', () => {
    const [lane] = assignLanes([pill(52)], [{ ...pill(50), lane: 0 }]);
    expect(lane).toBe(1);
  });

  it('ignores a seed that does not overlap', () => {
    expect(assignLanes([pill(80)], [{ ...pill(50), lane: 0 }])).toEqual([0]);
  });
});

describe('flipChars', () => {
  it('keeps two cards for minutes, blank in front of a single digit', () => {
    expect(flipChars('4')).toEqual([' ', '4']);
    expect(flipChars('17')).toEqual(['1', '7']);
  });

  it('spells DUE across three cards and caps at 99', () => {
    expect(flipChars('DUE')).toEqual(['D', 'U', 'E']);
    expect(flipChars('120')).toEqual(['9', '9']);
  });

  it('shows dashes for a countdown it cannot read', () => {
    expect(flipChars('--')).toEqual(['-', '-']);
  });
});
