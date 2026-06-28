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

## [ ] TODO 8 — Static prerender (SSG) + non-destructive hydration

**Story:** As an installed-PWA user, I want the app shell painted from prerendered HTML and reused
(not destroyed) when JS boots, eliminating startup flicker — while staying on static Firebase Hosting.

**Acceptance criteria**
- [ ] `@angular/ssr` added; SSR schematic wired with **`outputMode: 'static'`**, `app.config.server.ts`, `main.server.ts`, `server.ts` as needed; `angular.json` server/prerender config builds **without a runtime server**.
- [ ] `provideClientHydration(withEventReplay())` added; landing/shell routes prerendered to static HTML under `dist/cta-tracker/browser` so `firebase.json` stays unchanged.
- [ ] Production build emits prerendered HTML containing real shell markup (not just `<app-root></app-root>`); hydration logs **no `NG0500`-style mismatch** warnings.
- [ ] PWA/service worker still registers and caches the prerendered shell; iOS meta tags and theme bootstrap script in `index.html` preserved.

**Files:** new `src/app/app.config.server.ts`, `src/main.server.ts`, `server.ts`, `angular.json`, `src/app/app.config.ts`, `ngsw-config.json` (verify), `firebase.json` (verify)
**Depends on:** TODO 4, TODO 3

---

## [ ] TODO 9 — Incremental & partial hydration + event replay

**Story:** As a user on a slow phone, I want JS for server-rendered sections to activate only as they
enter the viewport, and early taps captured and replayed once the app is interactive.

**Acceptance criteria**
- [ ] `provideClientHydration(withEventReplay(), withIncrementalHydration())`.
- [ ] Deferred sections from TODO 7 use **`@defer (hydrate on viewport)`** / `hydrate on idle` so prerendered content hydrates incrementally instead of all-at-once.
- [ ] A tap on an interactive control before hydration completes is **replayed** after boot (verified with throttled CPU/network).
- [ ] No double-execution or hydration-mismatch errors; measured reduction in main-thread work at startup vs TODO 8 baseline.

**Files:** `src/app/app.config.ts` + the `@defer` templates from TODO 7
**Depends on:** TODO 7, TODO 8

---

## [ ] TODO 10 — Final startup-performance verification & cleanup

**Story:** As the product owner, I want evidence the installed iOS PWA starts faster than the
Angular 21 baseline.

**Acceptance criteria**
- [ ] Before/after captured: initial bundle size (build stats), Lighthouse mobile (FCP/LCP/TBT/TTI), zone.js absence.
- [ ] Budgets in `angular.json` reviewed/tightened to lock in gains.
- [ ] README/this file updated with results; all earlier TODOs `[x]`.
