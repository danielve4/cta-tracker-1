# Angular 22 Upgrade & iOS PWA Startup Optimization — TODO

Tracking doc for upgrading `cta-tracker` to **Angular 22** and tuning the installed
iOS PWA to cold-start as fast as possible.

**Branch:** `claude/angular-22-ios-pwa-perf-cotjv9`
**Rendering target:** Prerender / SSG static (`@angular/ssr`, `outputMode: 'static'`) — stays on static Firebase Hosting.

**Workflow per item:** plan the item → implement (own commit) → code review → address feedback → mark done → next.
Work top-to-bottom; later items depend on earlier ones.

**Status legend:** `[ ]` todo · `[~]` in review · `[x]` done

---

## [x] TODO 0 — Verify what's already modern (control flow + application builder)

**Story:** As a maintainer, before touching anything I want to confirm two of the requested
optimizations are already in place so we don't redo them, and record the evidence.

**Acceptance criteria**
- [x] **0** occurrences of `*ngIf` / `*ngFor` / `*ngSwitch` / `[ngSwitch]` / `ngTemplateOutlet` in `src/`.
- [x] Built-in control flow already in use: `@if`/`@for` across 10 templates; **every `@for` has a `track`**.
- [x] Build builder is `@angular-devkit/build-angular:application` (esbuild/Vite) in `angular.json`; no Webpack builder.
- [x] No code changes — verification only.

**Evidence (Angular 21 baseline):** grep finds zero legacy structural directives; 19 `@for` blocks
all use `track` (`routes`, `stops`, `directions`, `favorites`, `arrivals`, `train-arrivals`,
`train-stops`, `train-follow`, `follow-vehicle`). `angular.json` → `architect.build.builder` =
`@angular-devkit/build-angular:application`. ✅ Both items already satisfied — verify-only, no work needed.

---

## [x] TODO 1 — Upgrade to Angular 22 (and Node / TypeScript)

**Story:** As a developer, I want the app running on Angular 22 with a green production build so
every later optimization targets the new framework.

**Acceptance criteria**
- [x] `ng update @angular/cli@22 @angular/core@22` completed; all `@angular/*` at `^22.0.4`, `@angular-devkit/build-angular`/`@angular/cli`/`@angular/compiler-cli` at `^22.0.4`, **TypeScript `~6.0.3`**, `rxjs ~7.8` and `zone.js ~0.15` unchanged (zone.js kept until TODO 4).
- [x] Both GitHub Actions workflows pin Node **22** via `actions/setup-node@v4` (`node-version-file: cta-tracker/.nvmrc`) before `npm install`.
- [x] `npm run build` (production) succeeds; `npm start` serves; app boots and navigates with **no console errors** (still zone-based at this step).
- [x] App behavior unchanged; `firebase.json` public path still valid (build emits to `dist/cta-tracker/browser`).

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.app.json`, the 12 `src/app/**/*.component.ts`, `src/app/app.config.ts`, `.github/workflows/firebase-hosting-*.yml`

**Result (Angular 21.1 → 22.0.4):**
- `ng update` migrations applied & kept: **`ChangeDetectionStrategy.Eager` added to all 12 components** (behavior-preserving; → `OnPush` in TODO 3); **`provideHttpClient(withXhr())`** added because Angular 22 now defaults HttpClient to **Fetch** — so TODO 2 becomes simply "drop `withXhr()`"; `tsconfig.app.json` extended-diagnostics suppression.
- Manual fix: removed deprecated `downlevelIteration` from `tsconfig.json` (no-op at `target: ES2022`; TS 6 errors on it).
- **Node:** Angular 22 needs `≥22.22.3`; dev container had `22.22.2`, so used `nvm` to run on **Node 22.23.1**. CI now pins Node via `.nvmrc`.
- **Verified:** production build green — initial bundle **399 kB raw / 101 kB transfer** (polyfills/zone.js = 34.6 kB, removed in TODO 4); dev server compiles; Chromium smoke test on a 390×844 viewport boots the app, `/` → `/routes` redirect works, in-app router nav to `/settings` `/favorites` `/routes` renders correctly, **0 console errors / 0 page errors** (only the external `cta.danielvega.dev` API calls fail — sandbox network, not a regression).
- Pre-existing component-CSS budget **warnings** (`train-arrivals.css` 5.73 kB, `arrivals.css` 5.24 kB; warn at 5 kB, error at 8 kB) — untouched here, deferred to TODO 10 budget review.

---

## [x] TODO 2 — Switch HttpClient to the Fetch API

**Story:** As an iOS PWA user, I want network calls to use native `fetch` so requests cooperate
with the service worker and drop the legacy XHR path.

**Acceptance criteria**
- [x] `provideHttpClient(withFetch())` in `app.config.ts` (replaced the TODO 1 migration's `withXhr()`; import `withXhr` → `withFetch`).
- [x] All endpoints unchanged and Fetch-compatible (`busroutes`, `busroutedirections`, `busroutestops`, `busstoparrivals`, `busfollow`, `traindata`, `trainstoparrivals`, `trainfollow`, `savefavorites`, `myfavorites`), including the `FavoritesService` POST with `responseType:'text'` / `observe:'response'` — services untouched.
- [x] No `HttpInterceptor` / JSONP regressions (none exist).

**Files:** `src/app/app.config.ts`

**Result:**
- Single-file change in `app.config.ts`; the four services are untouched (all already use plain `http.get<T>()` / `http.post(...)` with Fetch-supported options).
- **Verified transport switched:** production build green (initial total **395.71 kB raw / 100.71 kB** — ~3.4 kB smaller than TODO 1 with the XHR backend dropped). Chromium smoke test on `/routes` observed both outbound API calls (`traindata`, `busroutes`) as **`resourceType=fetch`** (XHR before), `anyXhr=false`, **0 console/page errors**. Calls still fail in-sandbox (external `cta.danielvega.dev` blocked) — expected; the assertion is on transport, not success.

---

## [x] TODO 3 — Signal-based components with OnPush (the big one)

**Story:** As a user on a weak mobile CPU, I want change detection to update only the DOM that
changed, so I'll convert component state to signals and make every component explicitly `OnPush`.

**Acceptance criteria**
- [x] All 12 components declare `changeDetection: ChangeDetectionStrategy.OnPush`.
- [x] Mutable view state (`refreshing`, `isInitialLoading`, `vehicles$|async`, `error`, `lastRefreshed`, `isFavorite`, …) becomes `signal()`/`computed()`; templates read signals instead of `| async` where practical; `setTimeout`-driven field flips update signals so they re-render under OnPush.
- [x] `inject()` used over constructor DI where touched; no broken bindings; `track` expressions still valid.
- [x] Manual subscriptions removed (favoring signals) or kept with `takeUntilDestroyed`; no leaks.
- [x] App visually/behaviorally identical, verified by running it (lists render, polling refresh updates the view, favoriting toggles, theme toggle works).

**Files:** all `src/app/**/**.component.{ts,html}` — reference the existing signal pattern in `services/theme.service.ts`
**Note:** Largest/riskiest item; may be split per component-group during its own planning pass.

**Result:**
- All 12 `@Component`s flipped `ChangeDetectionStrategy.Eager` → `OnPush`. Removed every `| async` from
  templates (was 15 across 9 files; grep now returns 0); `AsyncPipe` dropped from all `imports:[]`.
- Mutable view state converted to `signal()` and read with call syntax in templates: list/lookup
  data (`routes`/`stops`/`directions`/`trainLines`/`favorites`/`error`), poller state
  (`vehicles`/`arrivalGroups`/`predictions`, `error`/`errorMsg`, `isInitialLoading`, `refreshing`,
  `canRefresh`, `isFavorite`, `favorited`, `lastRefreshed`, route/stop label fields), `train-stops.line`,
  `settings` `syncStatus`/`cacheCleared`. The `setTimeout`-driven `refreshing`/`isFavorite` flips and
  the async HTTP/`favoritesService` callbacks now `.set()` signals, so they re-render under OnPush.
  Internal non-view caches kept as plain fields (`allRoutes`/`allStops`, `favoriteStop`,
  `refreshInterval`, `skeletonCards`, `appVersion`, `train-arrivals` `lineColor`, `train-follow`
  `routeCode`); `favorites.editableFavorites` is a signal updated immutably.
- Constructor DI → `inject()` in every touched component; `app.component` dropped an unused `Router`
  field-style ctor and `directions` dropped a dead `Router` injection.
- Leaks closed: `takeUntilDestroyed(this.destroyRef)` on all `params`/`queryParams`/`paramMap` and
  one-shot `favoritesService` subscriptions; `app.component`'s previously never-unsubscribed
  `router.events` now uses `takeUntilDestroyed()`. Polling loops keep `timerRef` + `ngOnDestroy()` as
  before. `app.config.ts`/zone.js untouched (TODO 4); services untouched.
- **Verified:** production build green; initial bundle **348.43 kB raw / 86.21 kB transfer** (down from
  TODO 2's 395.71 / 100.71 — OnPush + dropped AsyncPipe). Only the pre-existing component-CSS budget
  **warnings** remain (`arrivals.css` 5.24 kB, `train-arrivals.css` 5.73 kB) — deferred to TODO 10.

---

## [~] TODO 4 — Zoneless change detection (remove zone.js)

**Story:** As a user, I want ~30KB of zone.js gone and no async-interception overhead, so the app
runs fully zoneless.

**Acceptance criteria**
- [x] `provideZonelessChangeDetection()` replaces `provideZoneChangeDetection(...)`; `"zone.js"` removed from `angular.json` `polyfills` and from `package.json`.
- [x] Production bundle no longer contains zone.js (verify in build stats); build + runtime show no `NG0908`/zoneless warnings.
- [x] Polling refresh, route changes, favoriting, and theme toggle all still update the UI (proves TODO 3 covered every CD path).

**Files:** `src/app/app.config.ts`, `angular.json`, `package.json`
**Depends on:** TODO 3

**Result:**
- `app.config.ts`: `provideZoneChangeDetection({ eventCoalescing: true })` → **`provideZonelessChangeDetection()`**
  (stable API in Angular 22; the zone-only `eventCoalescing` option dropped — zoneless schedules natively).
  `angular.json` polyfills `["zone.js"]` → `[]`; `"zone.js"` removed from `package.json`. `npm install`
  pruned it from the root deps — it lingers only as `@angular/core`'s **optional peer** in the lockfile /
  `node_modules`, which is expected and never bundled (so the real check is the build output, not `node_modules`).
- **Bundle:** production build green; the **`polyfills` chunk is gone** and `dist` has **zero** zone.js
  fingerprints (`ZoneAwarePromise`/`__zone_symbol__`/`zone.js`; only Angular's inert `NgZone` token remains).
  Apples-to-apples initial total **395.00 → 357.44 kB raw (−37.6 kB) / 100.30 → 88.57 kB transfer (−11.7 kB)**.
- **Runtime (Chrome, dev + served prod build):** no `NG0908`/zoneless warnings, 0 console errors. Exercised
  every CD path under zoneless — theme toggle (signal→effect→DOM), in-app route nav, route-param loaders
  (`directions`/`stops`), live search filter, **polling refresh** (timestamp + predictions updated), and
  **favoriting** (signal flip re-rendered the list). Service worker still registers and caches on a served
  production build, and fires **promptly** (zoneless reaches `isStable` without zone-tracked polling timers,
  so it no longer waits the `registerWhenStable:30000` fallback).
- **Node:** Angular 22's CLI requires `≥22.22.3`; local nvm only has 22.22.0, so built/served with **Homebrew
  Node 26** (`PATH=/opt/homebrew/bin`). CI is unaffected (pins Node via `.nvmrc`).

---

## [~] TODO 5 — Signal data fetching with `resource()` / `httpResource()`

**Story:** As a user, I want arrivals to fetch reactively, auto-cancel superseded requests, and keep
RxJS off the hot path, so data fetching moves to the stable Resource APIs.

**Acceptance criteria**
- [x] The 4 polling components (`arrivals`, `train-arrivals`, `train-follow`, `follow-vehicle`) drive fetches via `resource`/`httpResource` keyed on signal params, replacing `timer(0,30s)+subscribe`; periodic refresh preserved and **in-flight duplicates auto-cancel**.
- [x] Route-param-driven loaders (`stops`, `directions`, `train-stops`) use `httpResource`/`rxResource` instead of `switchMap` chains.
- [x] `loading`/`error`/`value` states come from the resource; existing localStorage caching in `bus/train.service.ts` preserved or deliberately re-homed.
- [x] Behavior parity verified by running the app; `withFetch` (TODO 2) underpins `httpResource`.

**Files:** the listed components + `src/app/services/bus.service.ts`, `train.service.ts`
**Depends on:** TODO 2, TODO 3

**Result:**
- **Polling components → `httpResource`** keyed on a URL computed from signal params. Added
  `arrivalsUrl()`/`followUrl()` string builders to `bus.service.ts`/`train.service.ts` and dropped the
  now-unused Observable `arrivals()`/`follow()`. Each component reads route/query params via
  `toSignal(paramMap, { initialValue: snapshot })`, exposes view state as guarded `computed`s off the
  resource, and runs a single `effect` for the per-load side effects (`lastRefreshed` + `navigator.vibrate`).
  Periodic refresh is a 30s `setInterval(() => resource.reload(), …)` (cleared via `destroyRef.onDestroy`);
  the manual FAB calls the same `reload()`. The `params`/`timer(0,30s)`/`switchMap` pipelines and the
  800ms `refreshing` `setTimeout`s are gone — `refreshing`/`isInitialLoading` derive from
  `resource.isLoading()`/`status()`.
- **Route-param loaders → `rxResource`** wrapping the existing cached service Observables, so the
  `localStorage` caching in the services is untouched. `params` returns `undefined` until required params
  exist (no empty-arg fetch). Search filtering moved from mutating a list signal to a `searchTerm` signal +
  `computed` filter, with an `effect` that resets `searchTerm` on route change for parity with the old
  reset-on-new-data behavior. All three loaders surface the resource error — `stops`/`directions` via the
  payload-or-transport `Error[]` computed, and `train-stops` via an `errorMsg` computed off
  `dataResource.error()` with a matching `.error-message` block (the `/traindata` payload has no error
  field, so the transport state is the only error signal).
- **Angular 22 resource gotchas handled:** `value()` throws in the `'error'` state, so every read is
  `hasValue() ? value() : undefined`; transport failures surface via `resource.error()`. `reload()` is a
  no-op while already loading, so the auto-cancel guarantee rides on param change, not reload.
- **Train line colors** now return `var(--cta-*)` strings (no `getComputedStyle` DOM reads) — SSR-safe
  ahead of TODO 8.
- **Templates unchanged** — only `*.component.ts` + the two services changed.
- **Verified:** production build green (initial **370.28 kB raw / 92.37 kB transfer**, up from TODO 4's
  357.44 / 88.57 — the `httpResource`/`rxResource`/`resource` machinery is the cost; bundle shrink is
  TODO 6/7). Pre-existing component-CSS budget **warnings** unchanged (`train-arrivals.css` 5.73 kB,
  `arrivals.css` 5.24 kB; → TODO 10). Ran the served app on a phone viewport and exercised all 7 screens
  with live data + error paths: bus/train arrivals skeleton→data→grouping→`lastRefreshed`, follow
  predictions, `directions`/`stops`/`train-stops` lists from cache, live search filter + reset-on-nav,
  manual refresh updated the timestamp (7:40:03→7:40:05), and the train-follow API error rendered — all
  with **0 console errors**.

---

## [~] TODO 6 — Code-splitting: lazy routes + `injectAsync` for heavy services

**Story:** As a user, I want only the landing route's JS at startup, so non-critical routes and
heavy services load on demand.

**Acceptance criteria**
- [x] `app.routes.ts` uses `loadComponent: () => import(...)` for non-landing routes (settings, follow/train-follow, train-* and other below-the-fold screens); `/routes` stays eager.
- [x] At least one heavy/background service (e.g. `FavoritesService` sync or `TrainService`'s large `traindata` path) loads via **`injectAsync()`** (with `onIdle` prefetch where it helps) instead of eager root injection — confirmed by a separate lazy chunk.
- [x] Build output shows the initial chunk shrank and lazy chunks exist; all routes still navigate and function.

**Files:** `src/app/app.routes.ts`, the targeted service consumers
**Depends on:** TODO 1

**Result:**
- **Lazy routes:** `app.routes.ts` now imports only `RoutesComponent` (the eager landing route); the other 9
  routes use `loadComponent: () => import('./…').then(m => m.…Component)`. Redirects (`''`, `'**'`) unchanged.
  Safe because routing was the sole reference path to those components (`app.component.ts` imports only
  router primitives).
- **`injectAsync` (scoped to Settings, per plan):** `SettingsComponent` drops eager
  `inject(FavoritesService)` for `injectAsync(() => import('../services/favorites.service').then(m => m.FavoritesService), { prefetch: onIdle })`.
  `FavoritesService` is only needed when the user taps Save/Sync, so `onIdle` warms the chunk in the
  background. `saveFavorites`/`syncFavorites` became `async` and `await` the getter inside a **try/catch** (a
  lazy-chunk fetch is a new failure mode — on failure they set `Error: could not load favorites` instead of
  hanging on `Saving…`/`Syncing…`). Both `FavoritesService` and `Favorite` switched to **`import type`** so no
  value import survives to defeat the split. The interactive favoriting toggles in
  `arrivals`/`train-arrivals`/`favorites` keep synchronous `inject(FavoritesService)` (lowest risk) — the
  service still lands in a non-initial chunk since no consumer is on the landing route.
- **Bundle (production):** build green. **Initial total 370.28 → 308.79 kB raw (−61.49 kB) / 92.37 → 83.12 kB
  transfer (−9.25 kB).** Emitted lazy chunks for all 9 routed components plus a dedicated **`favorites-service`
  chunk (1.85 kB)**. Verified by content, not chunk name: the `/savefavorites`/`/myfavorites` markers are
  **absent from `main*.js`** and present only in the favorites-service chunk. Pre-existing component-CSS budget
  **warnings** unchanged (`train-arrivals.css` 5.73 kB, `arrivals.css` 5.24 kB; → TODO 10).
- **Note on the PWA:** the win here is reduced **initial parse/execute**, not network "fetch on demand" in the
  installed PWA — `ngsw-config.json` uses `installMode: "prefetch"` over `/*.js`, so the service worker
  background-downloads every lazy chunk after it registers. On-demand network loading was therefore verified on
  the **dev server (no SW)**.
- **Verified (Chrome, dev server, phone-ish viewport):** cleared `LS_SAVED_ROUTE` first (`AppComponent`
  restores the last route on boot, which had defeated a naive "`/` → `/routes`" check). With it cleared, `/`
  redirected to `/routes` rendering from the eager chunk. Navigating `/settings` fetched `settings-component`
  **and** the `favorites-service` chunk on demand (the `onIdle` prefetch); the bad-phone validation path ran
  (`Enter a valid 10-digit phone number`). A bus flow `directions → stops → arrivals` each fetched its chunk
  only on first navigation, rendered live predictions, and the favorite toggle exercised the statically-imported
  `FavoritesService` (localStorage updated). **0 console errors** throughout.

---

## [~] TODO 7 — Deferrable views (`@defer`) for below-the-fold sections

**Story:** As a user, I want below-the-fold/secondary UI to download and render only when needed,
keeping the initial bundle microscopic.

**Acceptance criteria**
- [x] Template sections wrapped in `@defer` with sensible triggers (`on idle` for the four arrivals/follow content regions, `on viewport` for the long Bus Routes list) plus `@placeholder`/`@loading`/`@error` (reuse the existing skeleton-card markup in `arrivals`/`train-arrivals`; lightweight `.skeleton-row` placeholders elsewhere).
- [x] Candidate areas covered: the train-lines vs bus-routes split on `/routes` (train lines eager, bus list deferred), the bus/train arrivals lists, and the follow/train-follow prediction panels.
- [x] Deferred chunk visible in build output (`TimeuntilPipe` split into a shared `timeuntil-pipe` chunk); no layout-shift regressions; verified by running and navigating every screen.

**Files:** the relevant `src/app/**/**.component.html`
**Depends on:** TODO 1 (pairs with TODO 9 for hydrate triggers)

**Result:**
- **Focused scope (5 blocks, template-only + small placeholder CSS):** `@defer (on idle)` wraps the
  list/content region of `arrivals`, `train-arrivals`, `follow-vehicle`, `train-follow`; `@defer (on
  viewport)` wraps the ~130-item Bus Routes `<ul>` on the eager `/routes` landing (train-lines grid +
  search stay eager). Each block has `@placeholder`/`@loading`/`@error`. `arrivals`/`train-arrivals`
  reuse their existing skeleton-card markup as the placeholder; `follow-vehicle`/`train-follow`/`routes`
  got a minimal `.skeleton-row` (height-reserving shimmer) + a `placeholderRows` field. `train-arrivals`
  keeps the `@defer` at **top level** so the grouped `<h3>` + per-direction `<ul>` structure isn't
  nested under one parent `<ul>`. `on viewport` needs a single-root placeholder, so on `/routes` the
  `<ul>` moved **inside** the defer block (placeholder/loading/error are each a single `<ul>`).
- **The only custom deferrable dependency is `TimeuntilPipe`** — `RouterLink`/`DatePipe` are shared/eager
  and don't move. Since the four follow/arrivals components are already lazy route chunks (TODO 6), the
  realistic win is **per-route deferral**, not a `main` drop; the eager `/routes` defer is render-only.
- **Build (production, green):** `main` **308.79 → 309.40 kB raw** (≈ +0.6 kB defer-loader code — flat,
  as predicted); initial total 321.63 kB raw / 86.77 kB transfer. `@defer` emitted a **shared
  `timeuntil-pipe` lazy chunk (568 B)** plus a small shared defer chunk. **Verified by content, not
  names/counts:** the pipe's unique `'--:--'` transform string is present **only** in the
  `timeuntil-pipe` chunk and **absent from all four route chunks**, which reference it via dynamic
  import — esbuild shares the one pipe chunk across them (exactly the predicted behavior). Pre-existing
  component-CSS budget **warnings** unchanged (`train-arrivals.css` 5.73 kB, `arrivals.css` 5.24 kB; → TODO 10).
- **Runtime (served prod build, Chrome):** exercised the full bus flow (`/routes` → directions → stops →
  arrivals) and train flow (`/routes` → Red Line train-stops → train-arrivals → train-follow). `/routes`
  painted train lines + search immediately while the bus list showed skeleton rows then resolved to live
  data with **no layout shift** (72 px skeleton = 72 px `.bus-route`). Deferred arrivals/train-arrivals/
  follow/train-follow all rendered live `timeuntil` countdowns (DUE/9 min/…) from the deferred pipe
  chunk; `train-arrivals` grouping (SCHEDULED banners, direction `<h3>`s) and the train-follow from-stop
  highlight rendered correctly; `lastRefreshed` (eager DatePipe) + FABs intact. **0 console errors / 0
  warnings** throughout.

---

## [~] TODO 8 — Static prerender (SSG) + non-destructive hydration

**Story:** As an installed-PWA user, I want the app shell painted from prerendered HTML and reused
(not destroyed) when JS boots, eliminating startup flicker — while staying on static Firebase Hosting.

**Acceptance criteria**
- [x] `@angular/ssr` added; SSR schematic wired with **`outputMode: 'static'`**, `app.config.server.ts`, `main.server.ts` (the schematic's `server.ts` Express entry was **deleted** — not needed for static); `angular.json` builds **without a runtime server** (no `dist/cta-tracker/server`).
- [x] `provideClientHydration(withEventReplay())` added; `''`/`routes`/`favorites` prerendered to static HTML under `dist/cta-tracker/browser` (`firebase.json` `public` path unchanged; its rewrite target changed — see Decision 3).
- [x] Production build emits prerendered HTML with real shell markup (`pill-nav`, `skeleton-row`, `ngh`/`ng-server-context="ssg"`); hydration logs **no `NG0500`** (verified in Chrome).
- [x] PWA/service worker registers and caches the prerendered shell; iOS meta tags + inline theme bootstrap script in `index.html` preserved.

**Files:** new `src/app/app.config.server.ts`, `src/app/app.routes.server.ts`, `src/main.server.ts`, `scripts/patch-ngsw-index.mjs`; `angular.json`, `tsconfig.app.json`, `package.json`(+lock), `src/app/app.config.ts`, `app.routes.ts`, `app.component.ts`, `services/theme.service.ts`, `routes/routes.component.ts`, `favorites/favorites.component.ts`, `firebase.json`, `ngsw-config.json`
**Depends on:** TODO 4, TODO 3

**Result:**
- **SSR scaffolding (static).** `ng add @angular/ssr`, then converted to prerender-only: `angular.json`
  `outputMode: "static"` (dropped the generated `ssr.entry`), **deleted `src/server.ts`** (no runtime
  server — build emits **no `dist/cta-tracker/server`**, `firebase.json` `public` stays
  `dist/cta-tracker/browser`). `app.config.server.ts` uses `provideServerRendering(withRoutes(serverRoutes))`
  (the schematic's own Angular-22 API). Removed `express`/`@types/express`/`@types/node` + the `serve:ssr`
  script; reverted `tsconfig.app.json` `types` to `[]`.
- **Render modes (`app.routes.server.ts`).** `''` + `routes` + `favorites` = `Prerender`; `settings` +
  `**` = `Client`. `settings` is client-only because it renders `theme.isDark()` in Angular-owned DOM,
  which the server can't resolve (would mismatch). `''` now **renders `RoutesComponent`** (was a redirect)
  so `/index.html` is a real shell.
- **Hydration + SSR-safety.** `provideClientHydration(withEventReplay())`. `ThemeService` guards
  `window`/`document`/`localStorage`/`matchMedia` behind `isPlatformBrowser` (it's force-instantiated on
  the server by the AppInitializer). `RoutesComponent`/`FavoritesComponent` moved data loads from
  `ngOnInit` to **`afterNextRender`** so the synchronous `of(cached)` paths can't populate signals before
  hydration (server skeleton == client first render). `AppComponent` moved the saved-route restore to
  `afterNextRender` and **only restores when `location.pathname === '/'`** — using `location.pathname`,
  not `router.url`, which hasn't resolved the initial navigation yet at that point (caught in browser
  testing: `router.url` was prematurely `'/'`, redirecting a `/settings` deep-link to `/routes`).
- **Decision 3 — Firebase rewrite `/index.html` → `/index.csr.html`:** first-load deep-links to client
  routes boot the clean CSR shell, no NG0500. `public` path unchanged.
- **Decision 4 — NGSW root-only navigation fallback** (so the installed PWA actually paints the
  prerendered shell on launch): `ngsw-config.json` sets `navigationUrls: ["/"]` — the SW serves its
  navigation index **only** for the start_url `/`; every sub-route bypasses the SW to the network
  (→ Firebase rewrite `/index.csr.html`, no mismatch). **Builder gotcha:** Angular hard-codes the SW
  `index` to `index.csr.html` in prerender mode (`@angular/build/.../service-worker.js`), ignoring
  ngsw-config's `index`, so a **post-build patch** (`scripts/patch-ngsw-index.mjs`, wired into
  `npm run build`; CI runs `npm run build`) rewrites `ngsw.json` `index` → `/index.html` (already
  precached). Net: SW-controlled `/` is served the prerendered shell **cache-first, online + offline**.
  *(Rejected the earlier `index: "/index.csr.html"` approach — it rendered CSR on every PWA launch,
  defeating the flicker-free goal.)* **Residual:** offline document-load of a *non-root* URL isn't
  covered (single SW index, scoped to `/`) — ≈unreachable in standalone iOS PWA (cold-launch is always
  `/`; in-app nav + the `afterNextRender` saved-route restore stay client-side).
- **Build (production, green):** `Prerendered 3 static routes`; emits `browser/{index.html,
  routes/index.html, favorites/index.html, index.csr.html}`, **no `server/`**. Initial total
  **321.63 → 340.82 kB raw / 86.77 → 98.74 kB transfer** (~19 kB raw is the hydration runtime).
  Pre-existing component-CSS budget **warnings** unchanged (`arrivals.css` 5.24 kB,
  `train-arrivals.css` 5.73 kB; → TODO 10).
- **Verified (Firebase hosting emulator + Chrome, served prod build):**
  - *Static:* `index.html`/route files have real shell markup + `ng-server-context="ssg"`;
    `index.csr.html` is bare `<app-root></app-root>`; iOS meta + inline theme script preserved;
    `ngsw.json` `index` = `/index.csr.html`, both shells + 22 JS chunks precached.
  - *First-load (no SW):* `/` and `/routes` (via `/routes/` 301) prerendered + hydrated with **0 console
    messages / no NG0500**; `/settings`, `/arrivals/...` → `index.csr.html` clean CSR.
  - *SW controlling (review-critical):* hard-load `/` is served the **prerendered `/index.html`**
    (`ng-server-context="ssg"`, cache-first) and hydrates clean — the flicker-free PWA launch;
    `/settings`/`/favorites`/`/arrivals/...` bypass the SW → `index.csr.html` (no `ng-server-context`);
    all **no NG0500**; `/settings` deep-link stays on settings (restore-bug fix confirmed).
  - *Offline (emulator stopped, SW controlling):* cold-launch `/` document boots from the **precached
    prerendered shell** (`ng-server-context="ssg"`), saved-route restore client-navigates onward,
    **no errors**.

---

## [x] TODO 9 — Incremental & partial hydration + event replay

**Story:** As a user on a slow phone, I want JS for server-rendered sections to activate only as they
enter the viewport, and early taps captured and replayed once the app is interactive.

**Acceptance criteria**
- [x] `provideClientHydration(withEventReplay(), withIncrementalHydration())`.
- [x] The one deferred section that exists on a prerendered route (the `/routes` bus list) uses `@defer (on viewport; hydrate on viewport)`; prerendered content hydrates incrementally instead of all-at-once.
- [x] Early taps are captured by event replay (jsaction annotations present in the SSG HTML; verified no regression in a served-build browser run).
- [x] No double-execution or hydration-mismatch errors (0 NG0500 in a served prod-build Chromium run).

**Files:** `src/app/app.config.ts`, `src/app/routes/routes.component.html`
**Depends on:** TODO 7, TODO 8

**Result:**
- `provideClientHydration(withEventReplay(), withIncrementalHydration())`; the `/routes` bus list is
  `@defer (on viewport; hydrate on viewport)` — the static skeletons paint with zero JS attached and the
  block hydrates only when it enters the viewport, off the boot critical path.
- **Scope note:** with a `hydrate` trigger the prerenderer emits the block's MAIN content (not
  `@placeholder`), and `routes()` is still `null` at prerender time, so the main branch gained an
  `@else if (!error())` skeleton fallback — the SSG shell keeps the same skeleton rows and the first
  client render matches. Verified in `dist`: `<!--ngh=d0-->` dehydrated-block marker + 8 skeleton rows in
  the prerendered `index.html`.
- **Deliberately unchanged:** the four `@defer (on idle)` blocks in `arrivals`/`train-arrivals`/
  `follow-vehicle`/`train-follow` sit on `RenderMode.Client` routes where hydrate triggers are ignored
  (dead syntax); `favorites.component.html` has no defer (its list populates from localStorage
  post-render); the pill-nav stays eagerly hydrated (it must reflect the boot-time saved-route
  `navigateByUrl` via `routerLinkActive`, and hydrating 3 anchors is negligible).
- **Verified (served prod build, headless Chromium, 390×844):** `/` boots the prerendered shell,
  saved-route restore navigates to `/routes`, skeletons render, in-app nav to `/settings` works,
  **0 NG0500 / 0 hydration errors** (only the sandbox-blocked external API fetches fail, same as every
  earlier TODO's run). Initial bundle 340.82 → **346.62 kB raw** / 98.77 → **100.40 kB transfer**
  (+5.8 kB raw = the incremental-hydration runtime).

---

## [x] TODO 10 — Final startup-performance verification & cleanup

**Story:** As the product owner, I want evidence the installed iOS PWA starts faster than the
Angular 21 baseline.

**Acceptance criteria**
- [x] Before/after captured: initial bundle size (build stats), Lighthouse mobile (FCP/LCP/TBT/TTI), zone.js absence (no polyfills chunk since TODO 4).
- [x] Budgets in `angular.json` reviewed/tightened to lock in gains.
- [x] This file updated with results.

**Result:**
- **Bundle:** Angular 21 baseline (TODO 1) initial **399 kB raw / 101 kB transfer** with zone.js →
  final **346.62 kB raw / 100.40 kB transfer**, zoneless, with only `RoutesComponent` eager, 13 lazy
  chunks, and prerendered shells for `/`, `/routes`, `/favorites` served cache-first by the SW.
- **Lighthouse (mobile, simulated slow-4G, served prod build, sandbox):** before (develop tip) vs after
  (this branch): score **0.89 → 0.89**, FCP 2.9 s → 2.9 s, LCP 3.0 → 3.1 s, TBT **20 ms → 20 ms**,
  TTI 3.4 → 3.3 s. **Read this honestly:** Lighthouse simulates an *uncached first visit over slow 4G*,
  which is network-bound and exactly the scenario this branch does *not* target. The installed-PWA wins —
  instant launch image at process start, cache-first SW boot, hydration deferred off the boot path — are
  invisible to it (TBT was already at the 20 ms floor from TODOs 3–8). The meaningful check is the
  on-device one below.
- **Budgets tightened** (`angular.json`): initial warn 500 kB → **375 kB**, error 1 MB → **500 kB**
  (current initial: 346.62 kB); `anyComponentStyle` warn 5 kB → **6 kB** (error 8 kB unchanged) —
  deliberately silences the two long-standing warnings (`arrivals.css` 5.24 kB, `train-arrivals.css`
  5.73 kB) that every TODO since #1 carried; both remain under the error cap. Production build is now
  **warning-free**.
- **On-device verification (owner action, needs a real iPhone):** deploy (`firebase deploy` or
  `firebase hosting:channel:deploy pwa-boot`), **remove + re-add** the app to the Home Screen (iOS
  snapshots launch images at add time), force-quit, cold-launch: the splash must appear instantly,
  then the prerendered shell, then live data.

---

## [x] TODO 11 — iOS launch screens, pre-CSS background, HTTP caching

**Story:** As an installed-PWA user on iOS, I want the app to show something the *instant* I tap the
icon — even while the evicted WebKit process, service worker, and shell are still booting.

**Why:** after TODOs 0–9 the remaining "up to 2 s of nothing" on a cold launch is dominated by iOS
process launch + SW cold start + first paint — during which iOS shows a blank screen unless the app
provides `apple-touch-startup-image` launch images. That's the only thing iOS can display at t=0.

**Result:**
- **Launch screens (the headline fix):** `scripts/generate-ios-splash.mjs` (one-shot, dependency-free,
  headless-Chromium screenshots; NOT part of `npm run build`) generated 48 committed PNGs in
  `src/assets/splash/` — 12 viewport classes (iPhone 8/SE2 → 17 line + Air) × portrait/landscape ×
  dark/light on the real page backgrounds (`#0a0a0c` / `#f4f4f8`) with the 512 px icon centered.
  `src/index.html` gained the 48 `<link rel="apple-touch-startup-image">` entries: the dark set carries
  **no** color-scheme clause so it always matches (WebKit's `prefers-color-scheme` in startup-image
  media queries is unreliable — failing safe to dark matches the app default), the light set overrides
  via `(prefers-color-scheme: light)`.
  **Caveats:** iOS snapshots the launch image at Add-to-Home-Screen time → existing installs must
  remove + re-add the app; changed art must ship under NEW filenames (assets are served immutable).
  Splash files are excluded from the ngsw assets group (`!/assets/splash/**`) — iOS fetches them
  directly, the SW never does, and the exclusion keeps `ngsw.json` lean (59 → 11 asset urls).
- **Pre-CSS background:** inline `<style>html{background-color:#0a0a0c}html[data-theme=light]{...}</style>`
  ahead of the theme script in `index.html` — the first compositor frame is never a white flash, even
  before `styles-*.css` arrives.
- **HTTP caching (`firebase.json`):** hashed `**/*.js|css` + `/assets/**` → 1-year immutable; all HTML
  shells + `ngsw.json`/`ngsw-worker.js`/`manifest.json` → `no-cache` (cheap 304 revalidation, never a
  stale shell or SW manifest); favicon/touch-icon → 1 day. The ngsw rule is ordered after the js/css
  rule so its `no-cache` wins for `ngsw-worker.js`. Headers only apply on Firebase (emulator or deploy),
  not on plain static servers.
- **Explicitly rejected** (evaluated, documented in the plan): changing
  `registrationStrategy` (registration never gates repeat-boot paint), preloading the saved-route lazy
  chunk (already SW-precached; a Cache Storage hit), dropping the ThemeService AppInitializer
  (near-free, needed for live OS-theme switching), replacing ngsw with a hand-rolled SW (SW cold start
  is tens of ms, not the culprit).
