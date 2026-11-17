# cta-device-proxy

Cloudflare Worker that serves CTA train and bus arrivals to **eLBus**, the ESP32-S3 e-ink keychain. It calls
the [CTA Train Tracker API](https://www.transitchicago.com/developers/ttdocs/) and the
[CTA Bus Tracker API](https://www.transitchicago.com/developers/bustracker/) with keys kept as
Worker secrets, and answers with a payload small enough to parse comfortably on the device.

Runs on the Workers free plan (100k requests/day, no cold starts). Will be deployed at
`https://cta-device-proxy.danve4.workers.dev`.

## API

`GET /trains?stops=40570,40790`

```json
{
  "updated": "21:44",
  "stations": [
    {
      "id": "40570",
      "name": "California",
      "trains": [
        { "line": "Blue", "to": "O'Hare", "min": [0, 11, 18], "runs": [141, 152, 160] },
        { "line": "Blue", "to": "Forest Park", "min": [3], "runs": [228] }
      ]
    }
  ]
}
```

- `stops` is one to four station map ids (CTA's `mapid` takes at most four), else
  `400 {"error":"Invalid stops."}`.
- Stations come back in request order. A station with no predictions has `"name": ""` and no trains.
- Trains are grouped by line and destination, soonest group first, with at most three arrivals each.
- `min` is whole minutes from CTA's response timestamp. An approaching train (`isApp`) is `0`.
- `updated` is CTA's timestamp as Chicago `HH:MM`.
- Line codes are spelled out (`Brn` → `Brown`, `G` → `Green`, `Org` → `Orange`, `P` → `Purple`,
  `Y` → `Yellow`).
- CTA's response is edge-cached for 20 s, and the answer carries `Cache-Control: public, max-age=20`.
- CTA unreachable or non-2xx → `502 {"error":"Unable to reach CTA services."}`. A CTA error code
  (`errCd` other than `0`, e.g. a bad key) → `502` with CTA's `errNm` as the error.
- `runs` is each train's CTA run number, in the same order as `min`, for `/follow`.
- `OPTIONS` → 204. Other methods → 405. Other paths → 404.

`GET /follow?run=141`

```json
{
  "updated": "21:44",
  "run": "141",
  "line": "Blue",
  "to": "O'Hare",
  "stops": [{ "id": "40490", "name": "Grand", "min": 2 }, { "id": "40380", "name": "Clark/Lake", "min": 4 }]
}
```

- The run's next stops from CTA's `ttfollow`, soonest first, at most 12.
- Once CTA no longer tracks the run (it reached the end of the line), `200` with `"stops": []`.
- `run` must be 1–4 digits, else `400 {"error":"Invalid run."}`. Other CTA errors → `502` as above.

`GET /buses?stop=8388&rt=49`

Same shape as `/trains`, so the keychain parses both with the same code. The stop is the one
"station"; buses are grouped by route and destination.

```json
{
  "updated": "02:09",
  "stations": [
    { "id": "8388", "name": "Western & Chicago",
      "trains": [{ "line": "#49", "to": "Berwyn", "min": [6, 27], "runs": [8923, 8862] }] }
  ]
}
```

- `stop` is a Bus Tracker stop id (1–6 digits). `rt` is optional and limits it to one route.
- `line` is the route with a `#`. `runs` are vehicle ids, for `/busfollow`. `DUE` is `0`.
- No buses coming (Bus Tracker's "No arrival times") → `200` with an empty `trains` and
  `"name": ""`, and `updated` from the Chicago clock.

`GET /busfollow?vid=8923`

Same shape as `/follow`: the bus's next stops on the trip it's on now, soonest first, at most 12.
`run` is the vehicle id. Once Bus Tracker has nothing for the bus, `200` with `"stops": []`.

## Develop

```bash
npm install
npm test                            # vitest; the handler takes env and its upstream fetch as parameters
npm run typecheck
printf 'CTA_TRAIN_KEY=...\nCTA_BUS_KEY=...\n' > .dev.vars # git-ignored, used by wrangler dev
npm run dev                         # wrangler dev on http://localhost:8787
npx wrangler secret put CTA_TRAIN_KEY  # once, before the first deploy
npx wrangler secret put CTA_BUS_KEY    # once, before the first deploy with buses
npm run deploy                      # wrangler deploy (needs `npx wrangler login` first)
```
