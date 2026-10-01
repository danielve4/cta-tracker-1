# cta-alerts-proxy

Cloudflare Worker in front of the [CTA Customer Alerts API](https://www.transitchicago.com/developers/alerts/).
CTA sends no CORS headers, so the browser can't call it directly. The API needs no key, so this
Worker only adds `Access-Control-Allow-Origin: *` and a 30-second edge cache.

Deployed at `https://cta-alerts-proxy.danve4.workers.dev`.

## API

`GET /alerts` returns CTA's JSON body unchanged, always with `activeonly=true&outputType=JSON`.

| Query | Forwarded as | Notes |
|---|---|---|
| `routeid=Red,22` | `routeid` | Train line ids (`Red`, `Brn`, `G`…) and bus routes, comma-separated |
| `stationid=40380` | `stationid` | Train station `mapid` |
| neither | — | Every active alert |

- CTA rejects `routeid` and `stationid` together, so when both are given `routeid` wins.
- Values must match `^[A-Za-z0-9,]{1,200}$`, else `400 {"error":"Invalid routeid."}`.
- Other query parameters are dropped.
- "No alerts" is CTA's `ErrorCode: "50"` body with a 200, passed through as is. The app's
  `normalizeAlerts` turns it into an empty list.
- If CTA is unreachable or returns a non-2xx status, the Worker answers `502 {"error":"Unable to reach CTA services."}` with `Cache-Control: no-store`.
- `OPTIONS` → 204. Other methods → 405. Other paths → 404.

## Develop

```bash
npm install
npm test            # vitest; the handler takes its upstream fetch as a parameter, so no Workers runtime is needed
npm run typecheck
npm run dev         # wrangler dev on http://localhost:8787 (point alertsBaseURL in environment.ts at it)
npm run deploy      # wrangler deploy (needs `npx wrangler login` first)
```
