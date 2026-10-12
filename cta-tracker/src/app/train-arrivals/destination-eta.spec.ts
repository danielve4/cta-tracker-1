import { describe, expect, it } from 'vitest';
import { CTAComprehensiveData, TrainEta } from '../trainResponse';
import { destinationTimeLabel, destinationStations, matchDestinationArrival, shortStationName } from './destination-eta';

const CLARK_LAKE = '40380';
const BELMONT = '41320';

/** A prediction with sane defaults, so each test states only the fields it is actually about. */
function eta(overrides: Partial<TrainEta> = {}): TrainEta {
  return {
    staId: CLARK_LAKE,
    stpId: '30074',
    staNm: 'Clark/Lake',
    stpDe: 'Service toward Kimball',
    rn: '426',
    rt: 'Brn',
    destSt: '30249',
    destNm: 'Kimball',
    trDr: '1',
    prdt: '2026-10-12T18:20:00',
    arrT: '2026-10-12T18:25:35',
    isApp: '0',
    isSch: '0',
    isDly: '0',
    isFlt: '0',
    flags: null,
    ...overrides
  };
}

describe('matchDestinationArrival', () => {
  it('matches the same run at the destination', () => {
    const dest = eta({ staId: BELMONT, arrT: '2026-10-12T18:44:35' });
    expect(matchDestinationArrival(eta(), [dest])).toBe(dest);
  });

  it('takes the first arrival after the origin when a Loop run reaches the destination twice', () => {
    // Run 427 passes Belmont southbound into the Loop, then again northbound on the way out.
    const origin = eta({ rn: '427', arrT: '2026-10-12T18:58:55' });
    const before = eta({ rn: '427', staId: BELMONT, trDr: '5', arrT: '2026-10-12T18:30:55' });
    const after = eta({ rn: '427', staId: BELMONT, trDr: '1', arrT: '2026-10-12T19:18:55' });
    expect(matchDestinationArrival(origin, [after, before])).toBe(after);
  });

  it('picks the earliest of several later arrivals', () => {
    const late = eta({ staId: BELMONT, arrT: '2026-10-12T20:00:00' });
    const soon = eta({ staId: BELMONT, arrT: '2026-10-12T18:44:35' });
    expect(matchDestinationArrival(eta(), [late, soon])).toBe(soon);
  });

  it('ignores the same run number on another line', () => {
    const otherLine = eta({ rt: 'P', staId: BELMONT, arrT: '2026-10-12T18:44:35' });
    expect(matchDestinationArrival(eta(), [otherLine])).toBeUndefined();
  });

  it('is undefined for a train that only reached the destination before the origin', () => {
    const earlier = eta({ staId: BELMONT, arrT: '2026-10-12T18:10:00' });
    expect(matchDestinationArrival(eta(), [earlier])).toBeUndefined();
  });

  it('is undefined when no prediction for the run exists at the destination', () => {
    expect(matchDestinationArrival(eta(), [eta({ rn: '999', staId: BELMONT })])).toBeUndefined();
  });

  it('is undefined when the origin time cannot be read', () => {
    const dest = eta({ staId: BELMONT, arrT: '2026-10-12T18:44:35' });
    expect(matchDestinationArrival(eta({ arrT: '' }), [dest])).toBeUndefined();
  });
});

describe('destinationStations', () => {
  const data = {
    lines: [],
    stations: {
      '40890': { name: 'Kimball', latitude: 0, longitude: 0 },
      [BELMONT]: { name: 'Belmont', latitude: 0, longitude: 0 },
      [CLARK_LAKE]: { name: 'Clark/Lake', latitude: 0, longitude: 0 }
    },
    stopSequences: {
      'Brown Line': { line: 'Brown Line', stops: ['40890', BELMONT, CLARK_LAKE, '99999', BELMONT] }
    },
    lastUpdated: ''
  } satisfies CTAComprehensiveData;

  it('lists the line in order without the origin, unknown stations or repeats', () => {
    expect(destinationStations(data, 'Brn', CLARK_LAKE)).toEqual([
      { id: '40890', name: 'Kimball' },
      { id: BELMONT, name: 'Belmont' }
    ]);
  });

  it('is empty for an unknown line or before the data loads', () => {
    expect(destinationStations(data, 'Red', CLARK_LAKE)).toEqual([]);
    expect(destinationStations(null, 'Brn', CLARK_LAKE)).toEqual([]);
  });
});

describe('destinationTimeLabel', () => {
  it('reads clock time and ride length', () => {
    const epochMs = new Date(2026, 9, 12, 18, 44).getTime();
    expect(destinationTimeLabel({ name: 'Belmont', epochMs, rideMinutes: 19 })).toBe('6:44 PM · 19 min');
  });
});

describe('shortStationName', () => {
  it('drops a trailing transfer list', () => {
    expect(shortStationName('Belmont (Red/Brown/Purple)')).toBe('Belmont');
    expect(shortStationName('Clark/Lake')).toBe('Clark/Lake');
  });
});
