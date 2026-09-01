# CTA Tracker

A real-time Chicago Transit Authority (CTA) bus and train tracker. The application allows users to browse transit routes, view stops, check real-time vehicle arrival predictions, and manage favorite stops. It is built as a Progressive Web App (PWA) for mobile-first offline-capable usage.

## Architecture

The project is split into two parts:

- **Frontend** (`cta-tracker/`): An Angular single-page application
- **Backend** (`node/`): A Node.js Express API server that proxies CTA public APIs and manages favorites persistence

The frontend is built and its output is copied into the backend's `public/` directory for serving as static files in production.

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Angular | 22.x | UI framework (standalone components, built-in control flow) |
| TypeScript | 5.9.x | Language |
| RxJS | 7.8.x | Reactive programming / async data streams |
| Angular Service Worker | 22.x | PWA offline support and caching |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime |
| Express | 5.x | HTTP server framework |
| Google Cloud Datastore | 9.x | Favorites persistence |
| Native fetch | built-in | HTTP client for CTA API proxying |

### Deployment

- Google Cloud App Engine (runtime: `nodejs22`)
- Configuration in `node/app.yaml`

## Project Structure

```
cta-tracker-1/
├── cta-tracker/                  # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── arrivals/         # Real-time arrival predictions view
│   │   │   ├── directions/       # Route direction picker
│   │   │   ├── favorites/        # Saved favorite stops
│   │   │   ├── follow-vehicle/   # Individual vehicle tracking
│   │   │   ├── routes/           # Route listing with search
│   │   │   ├── stops/            # Stop listing for a route/direction
│   │   │   ├── services/         # BusService, FavoritesService
│   │   │   │   └── prediction/   # On-device stop-view log and suggestion ranking
│   │   │   ├── suggested-stop/   # "Heading here?" chip, rendered on Routes and Favorites
│   │   │   ├── app.component.ts  # Root component with nav
│   │   │   ├── app.config.ts     # Application providers config
│   │   │   ├── app.routes.ts     # Route definitions
│   │   │   ├── busResponse.ts    # CTA API response interfaces
│   │   │   └── timeuntil.pipe.ts # Arrival time formatting pipe
│   │   ├── environments/         # Dev/prod environment configs
│   │   ├── assets/               # Icons and static assets
│   │   └── styles.css            # Global styles (CSS reset, grid, theme)
│   ├── angular.json              # Angular CLI build config
│   ├── tsconfig.json             # TypeScript config
│   ├── tsconfig.app.json         # App-specific TS config
│   ├── package.json              # Frontend dependencies
│   └── ngsw-config.json          # Service worker caching rules
├── node/                         # Express backend
│   ├── app.js                    # Server entry point, route registration
│   ├── bus.js                    # CTA Bus API proxy endpoints
│   ├── train.js                  # CTA Train API proxy endpoints
│   ├── favorites.js              # Favorites CRUD with Datastore
│   ├── config.json               # API keys and endpoint URLs
│   ├── app.yaml                  # App Engine deployment config
│   └── package.json              # Backend dependencies
├── build_and_move.sh             # Build script: compiles Angular, copies to node/public
└── AGENTS.md                     # This file
```

## Key Patterns

### Angular Patterns
- **Standalone components**: All components are standalone (no NgModules). Imports are declared directly in each component's `imports` array.
- **Built-in control flow**: Templates use `@if`, `@for`, `@switch` syntax instead of `*ngIf`/`*ngFor` structural directives.
- **Functional providers**: Application is bootstrapped via `bootstrapApplication()` with `provideRouter()`, `provideHttpClient()`, `provideServiceWorker()` and `provideClientHydration()`.
- **Prerendering**: `''`, `routes` and `favorites` are prerendered. Anything reading `localStorage`, IndexedDB or `navigator` must be guarded with `isPlatformBrowser` and deferred to `afterNextRender()`.
- **Zoneless change detection**: Uses `provideZonelessChangeDetection()`; Zone.js is not installed and `polyfills` is empty.
- **Signals**: Components expose `signal()`/`computed()` state, with `toSignal`, `rxResource` and `httpResource` bridging async sources. `FavoritesService` is the one remaining Observable-based service.
- **providedIn root services**: Services use `@Injectable({ providedIn: 'root' })` for tree-shakable singletons.

### Stop Prediction (on-device)

`src/app/services/prediction/` collects the data for predicting which stop a user will open after
being away for a few hours, and ships a heuristic ranker over it. Nothing is transmitted — the log
lives in IndexedDB (`cta-prediction`) and leaves the device only via Settings → Export Data.

The governing rule is **log raw observations, derive features at read time**. `StopViewEvent` stores
`ts`, `tzOffsetMin` and the raw inter-session gap; it never stores an encoding or an `isColdStart`
flag. All feature engineering lives in `features.ts`, so changing it applies retroactively to
history already collected and needs no migration.

| File | Role |
|---|---|
| `stop-view-event.ts` | Event and impression schemas, `SCHEMA_VERSION`, the namespaced `StopKey` |
| `event-log.store.ts` | IndexedDB wrapper, retention pruning, JSON export |
| `stop-view-tracker.service.ts` | The single write path, hooked to router `NavigationEnd` |
| `session-state.ts` | Session id, sequence, and the two distinct gap thresholds (plain, testable) |
| `session.service.ts` | Thin Angular wrapper around `SessionState` |
| `safe-storage.ts` | `localStorage` that swallows quota and security errors |
| `location.service.ts` | Opt-in coarse geolocation (3 dp), never awaited on the write path |
| `features.ts` | Cyclic time encoding, context and per-candidate features |
| `candidates.ts` | Candidate set and offline training-example extraction |
| `baseline-scorer.ts` | Hand-weighted heuristic — the baseline any model must beat |
| `predictor.service.ts` | Ranking, shadow impressions, accuracy readout |

Things to know before changing any of it:

- **Time features must use the stored `tzOffsetMin`**, not the device's current offset, or a DST
  change silently rotates months of history. Any "same time of day" comparison must use
  `circularDistance`, not a plain difference.
- **Time-of-day uses three harmonics**, not one. A single `(cos, sin)` pair is one sinusoid per day
  and cannot represent the AM/PM rush bimodality that dominates transit use.
- **`entry` keeps the training labels honest.** Three values mark views the *app* produced rather
  than the user: `'suggestion'` (the model's own guess, a feedback loop if trained on), `'restored'`
  (`AppComponent`'s `LS_SAVED_ROUTE` auto-navigation) and `'reload'` (the document was reloaded onto
  a stop page — iOS discards a backgrounded PWA and reloads the URL it was on). `isUserDriven()` in
  `candidates.ts` is the single source of truth for that set. Any new code path that navigates to a
  stop programmatically must pass an `entry` in navigation state.
- **`seqInSession === 0` is not "the stop the user chose".** Seq 0 is frequently the app's own
  restore or reload. `extractTrainingExamples` derives the real choice by skipping leading
  app-driven views and taking the session's first user-driven one — filtering on seq 0 *and*
  excluding app-driven entries would discard the whole session, which is the dominant PWA launch
  path. The same distinction exists at runtime: `SessionState` counts `userSeq` alongside `seq`, and
  `hasViewedStop()` — the gate that hides the suggestion once the user has chosen — reads `userSeq`.
  `takeSeq(userDriven)` is how the tracker keeps them apart.
- **The suggestion chip has to be on the screen the user actually launches into.** It renders in
  `RoutesComponent` *and* `FavoritesComponent`. Whichever mounts first triggers the single ranking;
  `PredictorService.hasPredicted` makes the second a no-op. A launch restores `LS_SAVED_ROUTE`, so
  for anyone whose last page was Favorites the Routes screen is never seen — mounting the chip only
  there meant the feature could not fire at all, which is how it shipped and why nobody saw it.
- **Every gate is a silent early return, so name them.** `PredictorService.suppressionReason` records
  which one fired and Settings renders it in words. Diagnosing "I have never seen a suggestion"
  without that required exporting the log and replaying it offline. `gateReason()` is shared by the
  live path and `explain()` so the readout cannot drift from what actually runs.
- **`MIN_CONFIDENT_SCORE` and the distance term are calibrated as a pair.** `distanceRank` is scored
  relative to the neutral rank of 0.5, so an unknown distance — the default, since location is
  opt-in — contributes nothing. The threshold absorbs the offset that centering removed, which keeps
  the effective bar exactly where it was. Change one and the other has to move with it.
- **Telemetry must never throw.** Everything touching `localStorage` goes through `safe-storage.ts`;
  `EventLogStore` tolerates a null database throughout. A quota error must not stop a navigation or
  take down `LS_SAVED_ROUTE` restore.
- **Location never prompts on the write path.** `LocationService.current()` checks
  `navigator.permissions` and returns early unless already granted — the stored opt-in flag alone is
  not enough, since permission can be reset to "ask" long after the user enabled it.
- **Affinity features are smoothed.** `timeAffinity`/`dowAffinity` are ratios, and a ratio over one
  observation is 1.0; they are smoothed toward the base rate so a single glance cannot outrank a
  real routine.
- **Stop coordinates are denormalized onto each event** because Settings → Clear Cache wipes the
  `busroutestops?...` and `traindata` entries they come from.
- **New persisted keys must be added to `PRESERVED_KEYS`** in `settings.component.ts`, or
  `clearCache()` will wipe them.
- **No ML library is used, deliberately.** With a few hundred per-user examples over ~24 features
  and ~20 candidates, a linear model is the right size; TensorFlow.js would cost more gzipped than
  the app's entire initial bundle. The next step is a per-user online linear model (LinUCB or
  logistic regression) in plain TypeScript at the `baseline-scorer.ts` seam.

### Testing

`npm test` runs Vitest (`vitest run`) over `src/app/**/*.spec.ts`. Scoped deliberately to the
dependency-free logic under `services/prediction/` — those modules import nothing from Angular, so
the runner needs no TestBed, no jsdom and no Angular Vite plugin. Typecheck specs with
`npx tsc -p tsconfig.spec.json --noEmit`; `tsconfig.app.json` does not include them, so they never
reach the bundle.

There are no component or integration tests. Anything involving the router, IndexedDB or
geolocation is verified by driving a real browser instead.

### Backend Patterns
- **API proxy**: The backend proxies all requests to the CTA Bus Tracker API and CTA Train Tracker API, keeping API keys server-side.
- **Native fetch**: Uses Node.js built-in `fetch()` for HTTP requests (no external HTTP client library).
- **Static file serving**: Express serves the compiled Angular app from the `public/` directory.
- **SPA fallback**: Unmatched GET routes fall through to `index.html` for Angular's client-side routing.

## API Endpoints

### Bus
- `GET /busroutes` — All CTA bus routes
- `GET /busroutedirections?route={id}` — Directions for a route
- `GET /busroutestops?route={id}&direction={dir}` — Stops for a route/direction
- `GET /busstoparrivals?stopId={id}` — Real-time arrival predictions for a stop
- `GET /busfollow?vehicleId={id}` — Track a specific bus

### Train
- `GET /trainstoparrivals?stopId={id}` — Real-time train arrivals
- `GET /trainfollow?vehicleId={id}` — Track a specific train

### Favorites
- `POST /savefavorites` — Save favorites (body: `{ id: phone, favorites: [...] }`)
- `POST /myfavorites` — Retrieve favorites (body: `{ id: phone }`)

## Building

```bash
# Install frontend dependencies
cd cta-tracker && npm install

# Development server
npm start

# Production build
npm run build

# Build and copy to backend
cd .. && ./build_and_move.sh
```

## Running the Backend

```bash
cd node && npm install && npm start
```

The server runs on port 8080 by default (configurable via `PORT` environment variable).

## Environment Configuration

- `cta-tracker/src/environments/environment.ts` — Development (points to `http://localhost:8080`)
- `cta-tracker/src/environments/environment.prod.ts` — Production (empty baseURL, same-origin)
