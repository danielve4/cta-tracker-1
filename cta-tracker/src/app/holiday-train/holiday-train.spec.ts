import { describe, expect, it } from 'vitest';
import { CTAComprehensiveData, TrainApiResponse, TrainEta } from '../trainResponse';
import {
  christmasCountdownLabel,
  daysUntilChristmas,
  holidayCountdown,
  isHolidaySeason,
  previousStation,
  readHolidayTrain
} from './holiday-train';

const KIMBALL = '41290';
const FRANCISCO = '40870';
const ROCKWELL = '41010';
const WESTERN = '41480';
const BELMONT = '41320';

const data = {
  lines: [],
  stations: {
    [KIMBALL]: { name: 'Kimball', latitude: 0, longitude: 0 },
    [FRANCISCO]: { name: 'Francisco', latitude: 0, longitude: 0 },
    [ROCKWELL]: { name: 'Rockwell', latitude: 0, longitude: 0 },
    [WESTERN]: { name: 'Western (Brown Line)', latitude: 0, longitude: 0 },
    [BELMONT]: { name: 'Belmont (Red/Brown/Purple)', latitude: 0, longitude: 0 }
  },
  stopSequences: {
    'Brown Line': { line: 'Brown Line', stops: [KIMBALL, FRANCISCO, ROCKWELL, WESTERN, BELMONT] }
  },
  lastUpdated: ''
} satisfies CTAComprehensiveData;

function eta(overrides: Partial<TrainEta> = {}): TrainEta {
  return {
    staId: ROCKWELL, stpId: '30227', staNm: 'Rockwell', stpDe: 'Service toward Loop', rn: '1225',
    rt: 'Brown Line', destSt: '30249', destNm: 'Loop', trDr: '5', prdt: '2026-12-02T14:00:00',
    arrT: '2026-12-02T14:04:00', isApp: '0', isSch: '0', isDly: '0', isFlt: '0', flags: null,
    ...overrides
  };
}

function response(ctatt: Partial<TrainApiResponse['ctatt']>): TrainApiResponse {
  return { ctatt: { tmst: '2026-12-02T14:00:00', errCd: '0', errNm: null, ...ctatt } };
}

describe('readHolidayTrain', () => {
  const landed = new Date(2026, 11, 2, 14, 0, 30).getTime();

  it('reads run-not-found as not running', () => {
    expect(readHolidayTrain(response({ errCd: '501', errNm: 'No trains with runnumber 1225 were found.' }), landed, data))
      .toEqual({ state: 'not-running' });
  });

  it('reads a train with upcoming stops as running, on its short line code', () => {
    const status = readHolidayTrain(response({
      eta: [eta(), eta({ staId: WESTERN, staNm: 'Western (Brown Line)', arrT: '2026-12-02T14:06:00' })]
    }), landed, data);
    expect(status.state).toBe('running');
    if (status.state !== 'running') return;
    expect(status.routeCode).toBe('Brn');
    expect(status.lineName).toBe('Brown Line');
    expect(status.destination).toBe('Loop');
    expect(status.stops.map(stop => stop.name)).toEqual(['Rockwell', 'Western']);
    // Anchored to when the response landed, not to the device parsing CTA's wall clock.
    expect(status.stops[0].arrivalEpochMs).toBe(landed + 4 * 60_000);
    expect(status.lastStation).toEqual({ staId: FRANCISCO, name: 'Francisco' });
  });

  it('accepts the short code the arrivals endpoint uses', () => {
    const status = readHolidayTrain(response({ eta: [eta({ rt: 'Brn' })] }), landed, data);
    expect(status.state === 'running' && status.routeCode).toBe('Brn');
  });

  it('reads a train with no upcoming stops as resting between trips', () => {
    expect(readHolidayTrain(response({ errCd: '503', errNm: 'Unable to find predictions' }), landed, data).state)
      .toBe('resting');
    expect(readHolidayTrain(response({ eta: [] }), landed, data).state).toBe('resting');
  });

  it('passes other errors on rather than claiming the train is off', () => {
    expect(readHolidayTrain(response({ errCd: '102', errNm: 'Maximum daily usage exceeded' }), landed, data))
      .toEqual({ state: 'unknown', message: 'Maximum daily usage exceeded' });
  });

  it('survives an empty body', () => {
    expect(readHolidayTrain({} as TrainApiResponse, landed, data).state).toBe('unknown');
  });
});

describe('previousStation', () => {
  it('looks back along the line in the direction of travel', () => {
    expect(previousStation(data, 'Brn', [ROCKWELL, WESTERN])).toEqual({ staId: FRANCISCO, name: 'Francisco' });
    expect(previousStation(data, 'Brn', [WESTERN, ROCKWELL])).toEqual({ staId: BELMONT, name: 'Belmont' });
  });

  it('is null at the start of the line, with one stop, or without the data', () => {
    expect(previousStation(data, 'Brn', [KIMBALL, FRANCISCO])).toBeNull();
    expect(previousStation(data, 'Brn', [ROCKWELL])).toBeNull();
    expect(previousStation(null, 'Brn', [ROCKWELL, WESTERN])).toBeNull();
    expect(previousStation(data, 'Red', [ROCKWELL, WESTERN])).toBeNull();
  });

  it('finds the pair on a Loop line that lists a station twice', () => {
    const loop = {
      ...data,
      stopSequences: { 'Brown Line': { line: 'Brown Line', stops: [KIMBALL, BELMONT, ROCKWELL, BELMONT, WESTERN] } }
    };
    expect(previousStation(loop, 'Brn', [BELMONT, WESTERN])).toEqual({ staId: ROCKWELL, name: 'Rockwell' });
  });
});

describe('season helpers', () => {
  it('opens mid-November and runs through December', () => {
    expect(isHolidaySeason(new Date(2026, 10, 14))).toBe(false);
    expect(isHolidaySeason(new Date(2026, 10, 15))).toBe(true);
    expect(isHolidaySeason(new Date(2026, 11, 31))).toBe(true);
    expect(isHolidaySeason(new Date(2027, 0, 1))).toBe(false);
  });

  it('counts whole days to Christmas', () => {
    expect(daysUntilChristmas(new Date(2026, 10, 26, 23, 59))).toBe(29);
    expect(daysUntilChristmas(new Date(2026, 11, 25, 8))).toBe(0);
    expect(daysUntilChristmas(new Date(2026, 11, 26))).toBeNull();
    expect(christmasCountdownLabel(new Date(2026, 11, 24))).toBe('1 day until Christmas');
    expect(christmasCountdownLabel(new Date(2026, 11, 25))).toBe('Merry Christmas');
    expect(christmasCountdownLabel(new Date(2026, 11, 27))).toBe('');
  });
});

describe('holidayCountdown', () => {
  const now = 1_000_000;
  it('reads minutes, and Due at a minute or less', () => {
    expect(holidayCountdown(now + 4 * 60_000, now, false)).toBe('4');
    expect(holidayCountdown(now + 50_000, now, false)).toBe('Due');
    expect(holidayCountdown(now + 9 * 60_000, now, true)).toBe('Due');
    expect(holidayCountdown(NaN, now, false)).toBe('--');
  });
});
