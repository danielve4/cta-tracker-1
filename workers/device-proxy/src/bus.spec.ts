import { describe, expect, it, vi } from 'vitest';
import { compactBusFollow, compactBuses, type CtaPrediction } from './bus';
import { handleRequest, type Upstream } from './index';

const CTA_PREDICTIONS = 'https://www.ctabustracker.com/bustime/api/v3/getpredictions';
const BASE = 'https://cta-device-proxy.example.workers.dev';
const ENV = { CTA_TRAIN_KEY: 'train-key', CTA_BUS_KEY: 'bus-key' };

function prd(
  stpid: string, stpnm: string, rt: string, des: string, prdtm: string, prdctdn: string,
  vid = '1234', tatripid = '100', typ = 'A'
): CtaPrediction {
  return { tmstmp: '20261027 21:44', typ, stpnm, stpid, vid, rt, des, prdtm: `20261027 ${prdtm}`, prdctdn, tatripid };
}

const WESTERN_AND_DIVISION = {
  'bustime-response': {
    prd: [
      prd('8367', 'Western & Division', '49', 'Berwyn', '21:52', '8', '1301'),
      prd('8367', 'Western & Division', '49', 'Berwyn', '21:45', 'DUE', '1300'),
      prd('8367', 'Western & Division', 'X49', 'Berwyn', '21:58', '14', '1400'),
      prd('8367', 'Western & Division', '49', 'Berwyn', '22:05', 'DLY', '1302'),
      prd('8367', 'Western & Division', '49', 'Berwyn', '22:20', '36', '1303')
    ]
  }
};

function okUpstream(body: unknown = WESTERN_AND_DIVISION) {
  return vi.fn<Upstream>(async () => new Response(JSON.stringify(body), { status: 200 }));
}

function get(pathAndQuery: string): Request {
  return new Request(BASE + pathAndQuery);
}

describe('GET /buses', () => {
  it('asks Bus Tracker for the stop and route, with the bus key', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/buses?stop=8367&rt=49'), ENV, upstream);

    const url = new URL(upstream.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(CTA_PREDICTIONS);
    expect(url.searchParams.get('stpid')).toBe('8367');
    expect(url.searchParams.get('rt')).toBe('49');
    expect(url.searchParams.get('key')).toBe('bus-key');
    expect(url.searchParams.get('format')).toBe('json');
  });

  it('answers in the /trains shape: the stop as a station, groups by route and destination', async () => {
    const response = await handleRequest(get('/buses?stop=8367'), ENV, okUpstream());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: '21:44',
      stations: [{
        id: '8367',
        name: 'Western & Division',
        trains: [
          { line: '#49', to: 'Berwyn', min: [0, 8, 21], runs: [1300, 1301, 1302] },
          { line: '#X49', to: 'Berwyn', min: [14], runs: [1400] }
        ]
      }]
    });
  });

  it('answers no buses, not an error, when Bus Tracker has no arrival times', async () => {
    const upstream = okUpstream({ 'bustime-response': { error: [{ stpid: '8367', msg: 'No arrival times' }] } });
    const response = await handleRequest(get('/buses?stop=8367&rt=49'), ENV, upstream);

    expect(response.status).toBe(200);
    const body = await response.json() as { updated: string; stations: unknown[] };
    expect(body.stations).toEqual([{ id: '8367', name: '', trains: [] }]);
    expect(body.updated).toMatch(/^\d{2}:\d{2}$/);
  });

  it("passes Bus Tracker's other errors through as a 502", async () => {
    const upstream = okUpstream({ 'bustime-response': { error: [{ msg: 'Invalid API access key supplied' }] } });
    const response = await handleRequest(get('/buses?stop=8367'), ENV, upstream);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Invalid API access key supplied' });
  });

  it('answers 502 when Bus Tracker is unreachable', async () => {
    const upstream = vi.fn<Upstream>(async () => { throw new Error('down'); });
    expect((await handleRequest(get('/buses?stop=8367'), ENV, upstream)).status).toBe(502);
  });

  it.each([['', ''], ['abc', ''], ['1234567', ''], ['8367', 'bad route'], ['8367', '12345']])(
    'rejects stop=%j rt=%j with a 400 and never calls CTA', async (stop, rt) => {
      const upstream = okUpstream();
      const response = await handleRequest(get(`/buses?stop=${stop}&rt=${encodeURIComponent(rt)}`), ENV, upstream);

      expect(response.status).toBe(400);
      expect(upstream).not.toHaveBeenCalled();
    });
});

const BUS_1300 = {
  'bustime-response': {
    prd: [
      prd('8370', 'Western & Chicago', '49', 'Berwyn', '21:48', '4', '1300', '100'),
      prd('8367', 'Western & Division', '49', 'Berwyn', '21:45', 'DUE', '1300', '100'),
      prd('8373', 'Western & Grand', '49', 'Berwyn', '21:51', '7', '1300', '100'),
      prd('1001', 'Western & Berwyn', '49', '79th', '23:10', '86', '1300', '200')
    ]
  }
};

describe('GET /busfollow', () => {
  it("lists the bus's next stops on its current trip, soonest first", async () => {
    const upstream = okUpstream(BUS_1300);
    const response = await handleRequest(get('/busfollow?vid=1300'), ENV, upstream);

    expect(new URL(upstream.mock.calls[0][0]).searchParams.get('vid')).toBe('1300');
    expect(await response.json()).toEqual({
      updated: '21:44',
      run: '1300',
      line: '#49',
      to: 'Berwyn',
      stops: [
        { id: '8367', name: 'Western & Division', min: 0 },
        { id: '8370', name: 'Western & Chicago', min: 4 },
        { id: '8373', name: 'Western & Grand', min: 7 }
      ]
    });
  });

  it('answers an empty stop list once Bus Tracker has nothing for the bus', async () => {
    const upstream = okUpstream({ 'bustime-response': { error: [{ vid: '1300', msg: 'No data found for parameter' }] } });
    const response = await handleRequest(get('/busfollow?vid=1300'), ENV, upstream);

    expect(response.status).toBe(200);
    const body = await response.json() as { stops: unknown[]; run: string };
    expect(body.run).toBe('1300');
    expect(body.stops).toEqual([]);
  });

  it.each(['', 'abc', '1234567'])('rejects vid=%j with a 400', async vid => {
    const upstream = okUpstream(BUS_1300);
    expect((await handleRequest(get(`/busfollow?vid=${vid}`), ENV, upstream)).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('compactBuses', () => {
  it('skips departure-only predictions and other stops', () => {
    const result = compactBuses('8367', [
      prd('8367', 'Western & Division', '49', 'Berwyn', '21:50', '6', '1', '1', 'D'),
      prd('9999', 'Elsewhere', '49', 'Berwyn', '21:50', '6')
    ]);
    expect(result.stations[0].trains).toEqual([]);
  });

  it('reads the Chicago clock for "updated" when there are no predictions', () => {
    // 03:30 UTC is 22:30 in Chicago (CDT, UTC-5) on 2026-10-28.
    expect(compactBuses('1', [], new Date('2026-10-28T03:30:00Z')).updated).toBe('22:30');
  });
});

describe('compactBusFollow', () => {
  it('keeps at most 12 stops and drops repeats of a stop', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      prd(String(100 + i), `Stop ${i}`, '66', 'Navy Pier', `21:${String(45 + i).padStart(2, '0')}`, String(i + 1)));
    many.push(prd('100', 'Stop 0', '66', 'Navy Pier', '21:46', '2'));
    const stops = compactBusFollow('1', many).stops;
    expect(stops).toHaveLength(12);
    expect(new Set(stops.map(s => s.id)).size).toBe(12);
  });
});

describe('real Bus Tracker answers', () => {
  // Recorded 2026-10-28 02:09 through Dani's backend (which drops the "bustime-response" wrapper).
  const western = { prd: [
    { tmstmp: '20261028 02:09', typ: 'A', stpnm: 'Western & Chicago', stpid: '8388', vid: '8923', rt: '49', des: 'Berwyn', prdtm: '20261028 02:15', tatripid: '4949266', dly: false, prdctdn: '6' },
    { tmstmp: '20261028 02:09', typ: 'A', stpnm: 'Western & Chicago', stpid: '8388', vid: '8862', rt: '49', des: 'Berwyn', prdtm: '20261028 02:36', tatripid: '4949267', dly: false, prdctdn: '27' }
  ] };

  it('groups them and trims stop names', () => {
    expect(compactBuses('8388', western.prd)).toEqual({
      updated: '02:09',
      stations: [{ id: '8388', name: 'Western & Chicago', trains: [{ line: '#49', to: 'Berwyn', min: [6, 27], runs: [8923, 8862] }] }]
    });
    const palmer = { ...western.prd[0], stpnm: 'Western & Palmer ', tmstmp: '20261028 02:09:14', prdtm: '20261028 02:23:14', prdctdn: '14' };
    expect(compactBusFollow('8923', [palmer]).stops).toEqual([{ id: '8388', name: 'Western & Palmer', min: 14 }]);
    expect(compactBusFollow('8923', [palmer]).updated).toBe('02:09');
  });
});
