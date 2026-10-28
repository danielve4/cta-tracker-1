// Serves CTA train arrivals to the eLBus e-ink keychain (an ESP32-S3) in a payload small enough to
// parse on the device. The CTA key stays here as a Worker secret, never on the device.

export type Upstream = (input: string, init?: RequestInit) => Promise<Response>;

export interface Env {
  CTA_TRAIN_KEY: string;
}

const CTA_ARRIVALS_URL = 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx';
const CACHE_SECONDS = 20;
const ALLOWED_METHODS = 'GET, OPTIONS';
const TRAINS_PER_GROUP = 3;

// Station map ids (40570). CTA's mapid takes at most four.
const STOPS_PATTERN = /^\d{5}(,\d{5}){0,3}$/;

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

export async function handleRequest(request: Request, env: Env, upstream: Upstream): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (url.pathname !== '/trains') {
    return jsonError(404, 'Not found.');
  }
  if (request.method !== 'GET') {
    return jsonError(405, 'Method not allowed.', { Allow: ALLOWED_METHODS });
  }

  const stops = url.searchParams.get('stops') ?? '';
  if (!STOPS_PATTERN.test(stops)) {
    return jsonError(400, 'Invalid stops.');
  }

  const upstreamUrl = new URL(CTA_ARRIVALS_URL);
  upstreamUrl.searchParams.set('key', env.CTA_TRAIN_KEY);
  upstreamUrl.searchParams.set('mapid', stops);
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

  const ctatt = body.ctatt;
  if (!ctatt || ctatt.errCd !== '0' || !ctatt.tmst) {
    return jsonError(502, ctatt?.errNm ?? 'Unexpected CTA response.');
  }

  return new Response(JSON.stringify(compact(stops.split(','), ctatt.tmst, ctatt.eta)), {
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
    const groups = new Map<string, TrainGroup>();
    for (const e of here) {
      const line = LINE_NAMES[e.rt] ?? e.rt;
      const key = `${line}|${e.destNm}`;
      const group = groups.get(key) ?? { line, to: e.destNm, min: [] };
      group.min.push(e.isApp === '1' ? 0 : Math.max(0, Math.floor((ctaTime(e.arrT) - now) / 60000)));
      groups.set(key, group);
    }
    const trains = [...groups.values()]
      .map(g => ({ ...g, min: g.min.sort((a, b) => a - b).slice(0, TRAINS_PER_GROUP) }))
      .sort((a, b) => a.min[0] - b.min[0] || a.to.localeCompare(b.to));
    return { id, name: here[0]?.staNm ?? '', trains };
  });

  return { updated: tmst.slice(11, 16), stations };
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
