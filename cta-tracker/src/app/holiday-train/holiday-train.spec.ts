import { describe, expect, it } from 'vitest';
import { CTAComprehensiveData, TrainApiResponse, TrainEta } from '../trainResponse';
import { Prd } from '../busResponse';
import { Favorite } from '../services/Favorite';
import {
  christmasCountdownLabel,
  daysUntilChristmas,
  favoriteHitLabel,
  holidayCountdown,
  holidayHitsForFavorites,
  HolidayTrainStatus,
  readHolidayBus,
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

function prd(overrides: Partial<Prd> = {}): Prd {
  return {
    tmstmp: '20261202 14:00:00', typ: 'V', stpnm: 'Michigan & Ohio', stpid: '1100', vid: '4374',
    dstp: 1200, rt: '151', rtdd: '151', rtdir: 'Southbound', des: 'Union Station',
    prdtm: '20261202 14:05:00', tablockid: '', tatripid: '', dly: false, prdctdn: '5', zone: '',
    ...overrides
  };
}

describe('readHolidayBus', () => {
  const landed = new Date(2026, 11, 2, 14, 0, 20).getTime();

  it('reads a bus with predictions as running', () => {
    const status = readHolidayBus({ prd: [prd(), prd({ stpid: '1101', stpnm: 'Michigan & Grand', prdtm: '20261202 14:07:30' })] }, landed);
    expect(status.state).toBe('running');
    if (status.state !== 'running') return;
    expect(status.route).toBe('151');
    expect(status.direction).toBe('Southbound');
    expect(status.destination).toBe('Union Station');
    expect(status.stops.map(stop => stop.arrivalEpochMs - landed)).toEqual([5 * 60_000, 7.5 * 60_000]);
  });

  it('times a delayed bus from prdtm, not its unusable countdown', () => {
    const status = readHolidayBus({ prd: [prd({ dly: true, prdctdn: 'DLY', prdtm: '20261202 14:12:00' })] }, landed);
    expect(status.state === 'running' && status.stops[0].arrivalEpochMs - landed).toBe(12 * 60_000);
  });

  it('reads "no data" and "no service" as not running, anything else as unknown', () => {
    expect(readHolidayBus({ error: [{ stpid: '', msg: 'No data found for parameter' }] }, landed).state).toBe('not-running');
    expect(readHolidayBus({ error: [{ stpid: '', msg: 'No service scheduled' }] }, landed).state).toBe('not-running');
    expect(readHolidayBus({}, landed).state).toBe('not-running');
    expect(readHolidayBus({ error: [{ stpid: '', msg: 'Invalid API access key supplied' }] }, landed))
      .toEqual({ state: 'unknown', message: 'Invalid API access key supplied' });
  });
});

describe('holidayHitsForFavorites', () => {
  const now = new Date(2026, 11, 2, 14, 0).getTime();
  const train: HolidayTrainStatus = readHolidayTrain(response({
    eta: [eta(), eta({ staId: WESTERN, staNm: 'Western (Brown Line)', arrT: '2026-12-02T14:40:00' })]
  }), now, data);
  const bus = readHolidayBus({ prd: [prd({ prdtm: '20261202 14:03:00' })] }, now);
  const favorite = (stopId: number, type?: 'bus' | 'train'): Favorite =>
    ({ route: '', stopId, stopName: '', direction: '', type });

  it('finds favorites either vehicle is headed to, soonest first', () => {
    const hits = holidayHitsForFavorites([favorite(+ROCKWELL, 'train'), favorite(1100)], train, bus, now);
    expect(hits.map(hit => [hit.kind, hit.stopName])).toEqual([['bus', 'Michigan & Ohio'], ['train', 'Rockwell']]);
    expect(favoriteHitLabel(hits[1], now)).toBe('Holiday Train at Rockwell in 4 min');
  });

  it('ignores stops past the horizon, the wrong kind, and vehicles that are not out', () => {
    expect(holidayHitsForFavorites([favorite(+WESTERN, 'train')], train, bus, now)).toEqual([]);
    expect(holidayHitsForFavorites([favorite(+ROCKWELL, 'bus')], train, bus, now)).toEqual([]);
    expect(holidayHitsForFavorites([favorite(1100, 'bus')], null, { state: 'not-running' }, now)).toEqual([]);
  });

  it('reads now at a minute or less', () => {
    expect(favoriteHitLabel({ kind: 'bus', stopName: 'Michigan & Ohio', arrivalEpochMs: now + 40_000 }, now))
      .toBe('Holiday Bus at Michigan & Ohio now');
  });
});
