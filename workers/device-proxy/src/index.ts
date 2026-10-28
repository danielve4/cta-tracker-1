// Serves CTA train arrivals to the eLBus e-ink keychain (an ESP32-S3) in a payload small enough to
// parse on the device. The CTA key stays here as a Worker secret, never on the device.

export type Upstream = (input: string, init?: RequestInit) => Promise<Response>;

export interface Env {
  CTA_TRAIN_KEY: string;
}

const CTA_ARRIVALS_URL = 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx';
const CTA_FOLLOW_URL = 'https://lapi.transitchicago.com/api/1.0/ttfollow.aspx';
const CACHE_SECONDS = 20;
const ALLOWED_METHODS = 'GET, OPTIONS';
const TRAINS_PER_GROUP = 3;

// Station map ids (40570). CTA's mapid takes at most four.
const STOPS_PATTERN = /^\d{5}(,\d{5}){0,3}$/;
// CTA run numbers are three digits today; allow a little room.
const RUN_PATTERN = /^\d{1,4}$/;
const FOLLOW_STOPS = 12;
// ttfollow's "No trains with runnumber … were found": the trip is over (or never existed).
const CTA_NO_TRAIN = '501';

const LINE_NAMES: Record<string, string> = {
  Red: 'Red',
  Blue: 'Blue',
  Brn: 'Brown',
  G: 'Green',
  Org: 'Orange',
  P: 'Purple',
  Pink: 'Pink',
  Y: 'Yellow'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': ALLOWED_METHODS,
  'Access-Control-Max-Age': '86400'
};

interface CtaEta {
  staId: string;
  staNm: string;
  rn: string;
  rt: string;
  destNm: string;
  arrT: string;
  isApp: string;
}

interface CtaArrivals {
  ctatt?: {
    tmst?: string;
    errCd?: string;
    errNm?: string | null;
    eta?: CtaEta | CtaEta[];
  };
}

export interface TrainGroup {
  line: string;
  to: string;
  min: number[];
  // Run number of each train in `min`, same order, for /follow.
  runs: number[];
}

export interface Station {
  id: string;
  name: string;
  trains: TrainGroup[];
}

export interface DeviceTrains {
  updated: string;
  stations: Station[];
}

export interface FollowStop {
  id: string;
  name: string;
  min: number;
}

export interface DeviceFollow {
  updated: string;
  run: string;
  line: string;
  to: string;
  // Next stops, soonest first. Empty once CTA no longer tracks the run (end of the line).
  stops: FollowStop[];
}

export async function handleRequest(request: Request, env: Env, upstream: Upstream): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (url.pathname !== '/trains' && url.pathname !== '/follow') {
    return jsonError(404, 'Not found.');
  }
  if (request.method !== 'GET') {
    return jsonError(405, 'Method not allowed.', { Allow: ALLOWED_METHODS });
  }

  if (url.pathname === '/follow') {
    const run = url.searchParams.get('run') ?? '';
    if (!RUN_PATTERN.test(run)) {
      return jsonError(400, 'Invalid run.');
    }
    const ctatt = await callCta(CTA_FOLLOW_URL, { runnumber: run }, env, upstream);
    if (ctatt instanceof Response) {
      return ctatt;
    }
    if (ctatt.errCd === CTA_NO_TRAIN && ctatt.tmst) {
      return json({ updated: ctatt.tmst.slice(11, 16), run, line: '', to: '', stops: [] });
    }
    if (ctatt.errCd !== '0' || !ctatt.tmst) {
      return jsonError(502, ctatt.errNm ?? 'Unexpected CTA response.');
    }
    return json(compactFollow(run, ctatt.tmst, ctatt.eta));
  }

  const stops = url.searchParams.get('stops') ?? '';
  if (!STOPS_PATTERN.test(stops)) {
    return jsonError(400, 'Invalid stops.');
  }

  const ctatt = await callCta(CTA_ARRIVALS_URL, { mapid: stops }, env, upstream);
  if (ctatt instanceof Response) {
    return ctatt;
  }
  if (ctatt.errCd !== '0' || !ctatt.tmst) {
    return jsonError(502, ctatt.errNm ?? 'Unexpected CTA response.');
  }

  return json(compact(stops.split(','), ctatt.tmst, ctatt.eta));
}

type Ctatt = NonNullable<CtaArrivals['ctatt']>;

// GETs a CTA Train Tracker endpoint (edge-cached for CACHE_SECONDS). Returns its `ctatt`, or the
// 502 to answer with when CTA can't be reached or answers nonsense.
async function callCta(
  endpoint: string, params: Record<string, string>, env: Env, upstream: Upstream
): Promise<Ctatt | Response> {
  const upstreamUrl = new URL(endpoint);
  upstreamUrl.searchParams.set('key', env.CTA_TRAIN_KEY);
  for (const [name, value] of Object.entries(params)) {
    upstreamUrl.searchParams.set(name, value);
  }
  upstreamUrl.searchParams.set('outputType', 'JSON');

  let body: CtaArrivals;
  try {
    const response = await upstream(upstreamUrl.toString(), {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    } as RequestInit);
    if (!response.ok) {
      return jsonError(502, 'Unable to reach CTA services.');
    }
    body = await response.json();
  } catch {
    return jsonError(502, 'Unable to reach CTA services.');
  }
  return body.ctatt ?? jsonError(502, 'Unexpected CTA response.');
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`
    }
  });
}

// Groups each station's trains by line and destination, soonest group first, keeping the next few
// arrivals of each as whole minutes from CTA's own timestamp.
export function compact(stopIds: string[], tmst: string, eta: CtaEta | CtaEta[] | undefined): DeviceTrains {
  // CTA's JSON is converted from XML, so a single prediction arrives as an object.
  const etas = eta === undefined ? [] : Array.isArray(eta) ? eta : [eta];
  const now = ctaTime(tmst);

  const stations = stopIds.map((id): Station => {
    const here = etas.filter(e => e.staId === id);
    const groups = new Map<string, { line: string; to: string; trains: { min: number; run: number }[] }>();
    for (const e of here) {
      const line = lineName(e.rt);
      const key = `${line}|${e.destNm}`;
      const group = groups.get(key) ?? { line, to: e.destNm, trains: [] };
      group.trains.push({ min: minutesUntil(e, now), run: Number(e.rn) });
      groups.set(key, group);
    }
    const trains = [...groups.values()]
      .map((g): TrainGroup => {
        const soonest = g.trains.sort((a, b) => a.min - b.min).slice(0, TRAINS_PER_GROUP);
        return { line: g.line, to: g.to, min: soonest.map(t => t.min), runs: soonest.map(t => t.run) };
      })
      .sort((a, b) => a.min[0] - b.min[0] || a.to.localeCompare(b.to));
    return { id, name: here[0]?.staNm ?? '', trains };
  });

  return { updated: tmst.slice(11, 16), stations };
}

// The run's upcoming stops, soonest first, as whole minutes from CTA's timestamp.
export function compactFollow(run: string, tmst: string, eta: CtaEta | CtaEta[] | undefined): DeviceFollow {
  const etas = (eta === undefined ? [] : Array.isArray(eta) ? eta : [eta])
    .slice()
    .sort((a, b) => ctaTime(a.arrT) - ctaTime(b.arrT));
  const now = ctaTime(tmst);
  return {
    updated: tmst.slice(11, 16),
    run,
    line: etas[0] ? lineName(etas[0].rt) : '',
    to: etas[0]?.destNm ?? '',
    stops: etas.slice(0, FOLLOW_STOPS).map(e => ({ id: e.staId, name: e.staNm, min: minutesUntil(e, now) }))
  };
}

// ttarrivals says "Brn", ttfollow says "Brown Line"; both become "Brown".
function lineName(rt: string): string {
  return LINE_NAMES[rt] ?? rt.replace(/ Line$/, '');
}

function minutesUntil(e: CtaEta, now: number): number {
  return e.isApp === '1' ? 0 : Math.max(0, Math.floor((ctaTime(e.arrT) - now) / 60000));
}

// CTA times are Chicago wall-clock with no offset. Every time in a response shares that zone, so
// reading them all as UTC keeps the differences right.
function ctaTime(value: string): number {
  return Date.parse(`${value}Z`);
}

function jsonError(status: number, error: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, (input, init) => fetch(input, init));
  }
};
