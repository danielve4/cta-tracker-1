import { describe, expect, it, vi } from 'vitest';
import { compact, compactFollow, handleRequest, type Upstream } from './index';

const CTA_ARRIVALS = 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx';
const CTA_FOLLOW = 'https://lapi.transitchicago.com/api/1.0/ttfollow.aspx';
const BASE = 'https://cta-device-proxy.example.workers.dev';
const ENV = { CTA_TRAIN_KEY: 'test-key', CTA_BUS_KEY: 'bus-key' };
const TMST = '2026-10-27T21:44:44';

function eta(staId: string, staNm: string, rt: string, destNm: string, arrT: string, isApp = '0', rn = '100') {
  return { staId, staNm, rn, rt, destNm, arrT: `2026-10-27T${arrT}`, isApp };
}

const CALIFORNIA_AND_MONROE = {
  ctatt: {
    tmst: TMST,
    errCd: '0',
    errNm: null,
    eta: [
      eta('40570', 'California', 'Blue', "O'Hare", '21:56:10', '0', '112'),
      eta('40570', 'California', 'Blue', 'Forest Park', '21:47:50', '0', '201'),
      eta('40570', 'California', 'Blue', "O'Hare", '21:45:30', '1', '111'),
      eta('40570', 'California', 'Blue', "O'Hare", '22:03:00', '0', '113'),
      eta('40570', 'California', 'Blue', "O'Hare", '22:15:00', '0', '114'),
      eta('40790', 'Monroe', 'Blue', 'Forest Park', '21:51:00', '0', '202')
    ]
  }
};

function okUpstream(body: unknown = CALIFORNIA_AND_MONROE) {
  return vi.fn<Upstream>(async () => new Response(JSON.stringify(body), { status: 200 }));
}

function get(pathAndQuery: string, init?: RequestInit): Request {
  return new Request(BASE + pathAndQuery, init);
}

describe('GET /trains', () => {
  it('asks CTA for every stop in one request, with the secret key', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/trains?stops=40570,40790'), ENV, upstream);

    expect(upstream).toHaveBeenCalledTimes(1);
    const url = new URL(upstream.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(CTA_ARRIVALS);
    expect(url.searchParams.get('mapid')).toBe('40570,40790');
    expect(url.searchParams.get('key')).toBe('test-key');
    expect(url.searchParams.get('outputType')).toBe('JSON');
  });

  it('returns stations in request order, grouped by line and destination, soonest first', async () => {
    const response = await handleRequest(get('/trains?stops=40570,40790'), ENV, okUpstream());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: '21:44',
      stations: [
        {
          id: '40570',
          name: 'California',
          trains: [
            { line: 'Blue', to: "O'Hare", min: [0, 11, 18], runs: [111, 112, 113] },
            { line: 'Blue', to: 'Forest Park', min: [3], runs: [201] }
          ]
        },
        { id: '40790', name: 'Monroe', trains: [{ line: 'Blue', to: 'Forest Park', min: [6], runs: [202] }] }
      ]
    });
  });

  it('sets JSON and 20s cache headers and edge-caches CTA for 20s', async () => {
    const upstream = okUpstream();
    const response = await handleRequest(get('/trains?stops=40570'), ENV, upstream);

    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=20');
    const init = upstream.mock.calls[0][1] as RequestInit & { cf?: Record<string, unknown> };
    expect(init?.cf).toEqual({ cacheTtl: 20, cacheEverything: true });
  });

  it.each(['', 'abc', '4057', '40570,', '1,2', '40570,40790,40380,41320,40900'])(
    'rejects stops=%j with a 400 and never calls CTA', async stops => {
      const upstream = okUpstream();
      const response = await handleRequest(get(`/trains?stops=${stops}`), ENV, upstream);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid stops.' });
      expect(upstream).not.toHaveBeenCalled();
    });

  it('answers 502 with no-store when CTA is unreachable', async () => {
    const upstream = vi.fn<Upstream>(async () => { throw new Error('down'); });
    const response = await handleRequest(get('/trains?stops=40570'), ENV, upstream);

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 502 when CTA returns a non-2xx status', async () => {
    const upstream = vi.fn<Upstream>(async () => new Response('oops', { status: 500 }));
    const response = await handleRequest(get('/trains?stops=40570'), ENV, upstream);

    expect(response.status).toBe(502);
  });

  it("passes CTA's own error message through as a 502", async () => {
    const upstream = okUpstream({ ctatt: { tmst: TMST, errCd: '101', errNm: 'Invalid API key' } });
    const response = await handleRequest(get('/trains?stops=40570'), ENV, upstream);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Invalid API key' });
  });

  it('answers 404 for other paths and 405 for other methods', async () => {
    expect((await handleRequest(get('/'), ENV, okUpstream())).status).toBe(404);
    const post = await handleRequest(get('/trains?stops=40570', { method: 'POST' }), ENV, okUpstream());
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, OPTIONS');
  });

  it('answers OPTIONS with 204', async () => {
    const response = await handleRequest(get('/trains', { method: 'OPTIONS' }), ENV, okUpstream());
    expect(response.status).toBe(204);
  });
});

describe('compact', () => {
  it('accepts a single prediction as an object rather than an array', () => {
    const result = compact(['40790'], TMST, eta('40790', 'Monroe', 'Red', 'Howard', '21:50:00'));
    expect(result.stations[0].trains).toEqual([{ line: 'Red', to: 'Howard', min: [5], runs: [100] }]);
  });

  it('lists a station with no predictions with an empty name and no trains', () => {
    expect(compact(['40570'], TMST, undefined).stations).toEqual([{ id: '40570', name: '', trains: [] }]);
  });

  it('spells out short line codes and never goes below zero minutes', () => {
    const result = compact(['41320'], TMST, eta('41320', 'Belmont', 'Brn', 'Loop', '21:40:00'));
    expect(result.stations[0].trains).toEqual([{ line: 'Brown', to: 'Loop', min: [0], runs: [100] }]);
  });
});

const FOLLOW_142 = {
  ctatt: {
    tmst: TMST,
    errCd: '0',
    errNm: null,
    eta: [
      eta('40490', 'Grand', 'Blue Line', "O'Hare", '21:49:00', '0', '142'),
      eta('40320', 'Division', 'Blue Line', "O'Hare", '21:45:10', '1', '142'),
      eta('40590', 'Damen', 'Blue Line', "O'Hare", '21:52:50', '0', '142')
    ]
  }
};

describe('GET /follow', () => {
  it('asks ttfollow for the run and lists its next stops, soonest first', async () => {
    const upstream = okUpstream(FOLLOW_142);
    const response = await handleRequest(get('/follow?run=142'), ENV, upstream);

    const url = new URL(upstream.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(CTA_FOLLOW);
    expect(url.searchParams.get('runnumber')).toBe('142');
    expect(url.searchParams.get('key')).toBe('test-key');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: '21:44',
      run: '142',
      line: 'Blue',
      to: "O'Hare",
      stops: [
        { id: '40320', name: 'Division', min: 0 },
        { id: '40490', name: 'Grand', min: 4 },
        { id: '40590', name: 'Damen', min: 8 }
      ]
    });
  });

  it('answers an empty stop list once CTA no longer tracks the run', async () => {
    const upstream = okUpstream({
      ctatt: { tmst: TMST, errCd: '501', errNm: 'No trains with runnumber 142 were found.' }
    });
    const response = await handleRequest(get('/follow?run=142'), ENV, upstream);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: '21:44', run: '142', line: '', to: '', stops: [] });
  });

  it.each(['', 'abc', '12345', '1,2'])('rejects run=%j with a 400 and never calls CTA', async run => {
    const upstream = okUpstream(FOLLOW_142);
    const response = await handleRequest(get(`/follow?run=${run}`), ENV, upstream);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid run.' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("passes CTA's other errors through as a 502", async () => {
    const upstream = okUpstream({ ctatt: { tmst: TMST, errCd: '101', errNm: 'Invalid API key' } });
    const response = await handleRequest(get('/follow?run=142'), ENV, upstream);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Invalid API key' });
  });
});

describe('compactFollow', () => {
  it('keeps at most 12 stops', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      eta(`4${String(i).padStart(4, '0')}`, `Stop ${i}`, 'Red Line', 'Howard', `21:${String(45 + i).padStart(2, '0')}:00`));
    expect(compactFollow('900', TMST, many).stops).toHaveLength(12);
  });
});
