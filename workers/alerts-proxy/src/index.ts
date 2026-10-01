// Proxies the CTA Customer Alerts API, which sends no CORS headers and so cannot be called from the
// browser directly. It needs no API key; the Worker only adds CORS and an edge cache.

export type Upstream = (input: string, init?: RequestInit) => Promise<Response>;

const CTA_ALERTS_URL = 'https://www.transitchicago.com/api/1.0/alerts.aspx';
const CACHE_SECONDS = 30;
const ALLOWED_METHODS = 'GET, OPTIONS';

// Route ids (Red, Brn, 22, X9), station map ids (40990) and comma lists of them.
const FILTER_PATTERN = /^[A-Za-z0-9,]{1,200}$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': ALLOWED_METHODS,
  'Access-Control-Max-Age': '86400'
};

export async function handleRequest(request: Request, upstream: Upstream): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (url.pathname !== '/alerts') {
    return jsonError(404, 'Not found.');
  }
  if (request.method !== 'GET') {
    return jsonError(405, 'Method not allowed.', { Allow: ALLOWED_METHODS });
  }

  const upstreamUrl = new URL(CTA_ALERTS_URL);
  upstreamUrl.searchParams.set('activeonly', 'true');
  upstreamUrl.searchParams.set('outputType', 'JSON');

  // CTA rejects routeid and stationid together (ErrorCode 106), so route wins.
  const filter = url.searchParams.has('routeid') ? 'routeid'
    : url.searchParams.has('stationid') ? 'stationid'
    : null;
  if (filter) {
    const value = url.searchParams.get(filter) ?? '';
    if (!FILTER_PATTERN.test(value)) {
      return jsonError(400, `Invalid ${filter}.`);
    }
    upstreamUrl.searchParams.set(filter, value);
  }

  let response: Response;
  try {
    response = await upstream(upstreamUrl.toString(), {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    } as RequestInit);
  } catch {
    return jsonError(502, 'Unable to reach CTA services.');
  }
  if (!response.ok) {
    return jsonError(502, 'Unable to reach CTA services.');
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`
    }
  });
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
  fetch(request: Request): Promise<Response> {
    return handleRequest(request, (input, init) => fetch(input, init));
  }
};
