import { describe, expect, it, vi } from 'vitest';
import { handleRequest, type Upstream } from './index';

const CTA_ALERTS = 'https://www.transitchicago.com/api/1.0/alerts.aspx';
const BASE = 'https://cta-alerts-proxy.example.workers.dev';

// Captured from the live API; passed through byte-for-byte.
const RED_LINE_BODY = '{"CTAAlerts":{"TimeStamp":"2026-09-30T21:44:44","ErrorCode":"0","ErrorMessage":null,' +
  '"Alert":[{"AlertId":"117610","Headline":"Elevator at 69th Temporarily Out-of-Service"}]}}';

function okUpstream(body = RED_LINE_BODY) {
  return vi.fn<Upstream>(async () => new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
}

function get(pathAndQuery: string, init?: RequestInit): Request {
  return new Request(BASE + pathAndQuery, init);
}

function upstreamUrl(upstream: ReturnType<typeof okUpstream>): URL {
  expect(upstream).toHaveBeenCalledTimes(1);
  return new URL(upstream.mock.calls[0][0]);
}

describe('GET /alerts', () => {
  it('forwards routeid to the CTA alerts endpoint with active-only JSON output', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts?routeid=Red'), upstream);

    const url = upstreamUrl(upstream);
    expect(url.origin + url.pathname).toBe(CTA_ALERTS);
    expect(url.searchParams.get('routeid')).toBe('Red');
    expect(url.searchParams.get('activeonly')).toBe('true');
    expect(url.searchParams.get('outputType')).toBe('JSON');
    expect(url.searchParams.has('stationid')).toBe(false);
  });

  it('passes the CTA body through unchanged with a 200', async () => {
    const response = await handleRequest(get('/alerts?routeid=Red'), okUpstream());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(RED_LINE_BODY);
  });

  it('sets CORS, JSON and 30s cache headers', async () => {
    const response = await handleRequest(get('/alerts?routeid=Red'), okUpstream());

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30');
  });

  it('asks Cloudflare to edge-cache the upstream response for 30s', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts?routeid=Red'), upstream);

    const init = upstream.mock.calls[0][1] as RequestInit & { cf?: Record<string, unknown> };
    expect(init?.cf).toEqual({ cacheTtl: 30, cacheEverything: true });
  });

  it('forwards a comma-separated routeid list', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts?routeid=Red,22'), upstream);

    expect(upstreamUrl(upstream).searchParams.get('routeid')).toBe('Red,22');
  });

  it('forwards stationid', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts?stationid=40990'), upstream);

    const url = upstreamUrl(upstream);
    expect(url.searchParams.get('stationid')).toBe('40990');
    expect(url.searchParams.has('routeid')).toBe(false);
  });

  it('drops stationid when routeid is also given, because CTA rejects the combination', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts?routeid=Red&stationid=40990'), upstream);

    const url = upstreamUrl(upstream);
    expect(url.searchParams.get('routeid')).toBe('Red');
    expect(url.searchParams.has('stationid')).toBe(false);
  });

  it('requests every active alert when no filter is given', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts'), upstream);

    const url = upstreamUrl(upstream);
    expect([...url.searchParams.keys()].sort()).toEqual(['activeonly', 'outputType']);
  });

  it('never forwards parameters other than the filter', async () => {
    const upstream = okUpstream();
    await handleRequest(get('/alerts?routeid=Red&activeonly=false&outputType=XML&key=x'), upstream);

    const url = upstreamUrl(upstream);
    expect(url.searchParams.get('activeonly')).toBe('true');
    expect(url.searchParams.get('outputType')).toBe('JSON');
    expect(url.searchParams.has('key')).toBe(false);
  });

  it('passes a CTA "no alerts" body (ErrorCode 50) through as a 200', async () => {
    const body = '{"CTAAlerts":{"TimeStamp":"2026-09-30T21:44:53","ErrorCode":"50",' +
      '"ErrorMessage":"There are no active alerts based on your filter criteria"}}';
    const response = await handleRequest(get('/alerts?routeid=Y'), okUpstream(body));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  });
});

describe('input validation', () => {
  it.each([
    ['routeid', '<script>'],
    ['routeid', 'Red&stationid=1'],
    ['routeid', 'Red Line'],
    ['routeid', ''],
    ['routeid', 'a'.repeat(201)],
    ['stationid', '40990;drop'],
    ['stationid', '../x']
  ])('rejects %s=%j with a 400 and never calls CTA', async (name, value) => {
    const upstream = okUpstream();
    const query = new URLSearchParams({ [name]: value }).toString();
    const response = await handleRequest(get(`/alerts?${query}`), upstream);

    expect(response.status).toBe(400);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ error: `Invalid ${name}.` });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('accepts a 200-character filter', async () => {
    const upstream = okUpstream();
    const response = await handleRequest(get(`/alerts?routeid=${'a'.repeat(200)}`), upstream);

    expect(response.status).toBe(200);
  });
});

describe('upstream failures', () => {
  it('returns 502 when CTA cannot be reached', async () => {
    const upstream = vi.fn<Upstream>(async () => { throw new TypeError('fetch failed'); });
    const response = await handleRequest(get('/alerts?routeid=Red'), upstream);

    expect(response.status).toBe(502);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ error: 'Unable to reach CTA services.' });
  });

  it('returns 502 when CTA answers with a non-2xx status', async () => {
    const upstream = vi.fn<Upstream>(async () => new Response('<html>oops</html>', { status: 503 }));
    const response = await handleRequest(get('/alerts?routeid=Red'), upstream);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Unable to reach CTA services.' });
  });

  it('does not let the browser cache an error', async () => {
    const upstream = vi.fn<Upstream>(async () => { throw new TypeError('fetch failed'); });
    const response = await handleRequest(get('/alerts?routeid=Red'), upstream);

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('routing and methods', () => {
  it('answers a CORS preflight with 204', async () => {
    const upstream = okUpstream();
    const response = await handleRequest(get('/alerts', { method: 'OPTIONS' }), upstream);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE'])('rejects %s with 405', async (method) => {
    const upstream = okUpstream();
    const response = await handleRequest(get('/alerts', { method }), upstream);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(['/', '/routes', '/alerts/extra', '/alerts.aspx'])('returns 404 for %s', async (path) => {
    const upstream = okUpstream();
    const response = await handleRequest(get(path), upstream);

    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(upstream).not.toHaveBeenCalled();
  });
});
