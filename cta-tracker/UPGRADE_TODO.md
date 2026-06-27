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

## [ ] TODO 3 — Signal-based components with OnPush (the big one)

**Story:** As a user on a weak mobile CPU, I want change detection to update only the DOM that
changed, so I'll convert component state to signals and make every component explicitly `OnPush`.

**Acceptance criteria**
- [ ] All 12 components declare `changeDetection: ChangeDetectionStrategy.OnPush`.
- [ ] Mutable view state (`refreshing`, `isInitialLoading`, `vehicles$|async`, `error`, `lastRefreshed`, `isFavorite`, …) becomes `signal()`/`computed()`; templates read signals instead of `| async` where practical; `setTimeout`-driven field flips update signals so they re-render under OnPush.
- [ ] `inject()` used over constructor DI where touched; no broken bindings; `track` expressions still valid.
- [ ] Manual subscriptions removed (favoring signals) or kept with `takeUntilDestroyed`; no leaks.
- [ ] App visually/behaviorally identical, verified by running it (lists render, polling refresh updates the view, favoriting toggles, theme toggle works).

**Files:** all `src/app/**/**.component.{ts,html}` — reference the existing signal pattern in `services/theme.service.ts`
**Note:** Largest/riskiest item; may be split per component-group during its own planning pass.

---

## [ ] TODO 4 — Zoneless change detection (remove zone.js)

**Story:** As a user, I want ~30KB of zone.js gone and no async-interception overhead, so the app
runs fully zoneless.

**Acceptance criteria**
- [ ] `provideZonelessChangeDetection()` replaces `provideZoneChangeDetection(...)`; `"zone.js"` removed from `angular.json` `polyfills` and from `package.json`.
- [ ] Production bundle no longer contains zone.js (verify in build stats); build + runtime show no `NG0908`/zoneless warnings.
- [ ] Polling refresh, route changes, favoriting, and theme toggle all still update the UI (proves TODO 3 covered every CD path).

**Files:** `src/app/app.config.ts`, `angular.json`, `package.json`
**Depends on:** TODO 3

---

## [ ] TODO 5 — Signal data fetching with `resource()` / `httpResource()`

**Story:** As a user, I want arrivals to fetch reactively, auto-cancel superseded requests, and keep
RxJS off the hot path, so data fetching moves to the stable Resource APIs.

**Acceptance criteria**
- [ ] The 4 polling components (`arrivals`, `train-arrivals`, `train-follow`, `follow-vehicle`) drive fetches via `resource`/`httpResource` keyed on signal params, replacing `timer(0,30s)+subscribe`; periodic refresh preserved and **in-flight duplicates auto-cancel**.
- [ ] Route-param-driven loaders (`stops`, `directions`, `train-stops`) use `httpResource`/`rxResource` instead of `switchMap` chains.
- [ ] `loading`/`error`/`value` states come from the resource; existing localStorage caching in `bus/train.service.ts` preserved or deliberately re-homed.
- [ ] Behavior parity verified by running the app; `withFetch` (TODO 2) underpins `httpResource`.

**Files:** the listed components + `src/app/services/bus.service.ts`, `train.service.ts`
**Depends on:** TODO 2, TODO 3

---

## [ ] TODO 6 — Code-splitting: lazy routes + `injectAsync` for heavy services

**Story:** As a user, I want only the landing route's JS at startup, so non-critical routes and
heavy services load on demand.

**Acceptance criteria**
- [ ] `app.routes.ts` uses `loadComponent: () => import(...)` for non-landing routes (settings, follow/train-follow, train-* and other below-the-fold screens); `/routes` stays eager.
- [ ] At least one heavy/background service (e.g. `FavoritesService` sync or `TrainService`'s large `traindata` path) loads via **`injectAsync()`** (with `onIdle` prefetch where it helps) instead of eager root injection — confirmed by a separate lazy chunk.
- [ ] Build output shows the initial chunk shrank and lazy chunks exist; all routes still navigate and function.

**Files:** `src/app/app.routes.ts`, the targeted service consumers
**Depends on:** TODO 1

---

## [ ] TODO 7 — Deferrable views (`@defer`) for below-the-fold sections

**Story:** As a user, I want below-the-fold/secondary UI to download and render only when needed,
keeping the initial bundle microscopic.

**Acceptance criteria**
- [ ] Template sections wrapped in `@defer` with sensible triggers (`on viewport`, `on idle`, `on interaction`) plus `@placeholder`/`@loading`/`@error` (reuse existing skeleton-card markup as placeholders).
- [ ] Candidate areas: long route/stop lists, the train-lines vs bus-routes split on `/routes`, follow/map-ish secondary panels.
- [ ] Deferred chunks visible in build output; no layout-shift regressions; verified by running and scrolling/interacting.

**Files:** the relevant `src/app/**/**.component.html`
**Depends on:** TODO 1 (pairs with TODO 9 for hydrate triggers)

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
