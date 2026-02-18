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
| Angular | 21.x | UI framework (standalone components, built-in control flow) |
| TypeScript | 5.9.x | Language |
| RxJS | 7.8.x | Reactive programming / async data streams |
| Zone.js | 0.15.x | Change detection (Zone-based) |
| Angular Service Worker | 21.x | PWA offline support and caching |

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
- **Functional providers**: Application is bootstrapped via `bootstrapApplication()` with `provideRouter()`, `provideHttpClient()`, and `provideServiceWorker()`.
- **Zone-based change detection**: Uses `provideZoneChangeDetection()` with event coalescing enabled.
- **Async pipe**: Components expose `Observable` properties and use the `async` pipe in templates for automatic subscription management.
- **providedIn root services**: Services use `@Injectable({ providedIn: 'root' })` for tree-shakable singletons.

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
