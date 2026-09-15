# Plan: side-by-side "Split Board" column layout for train arrivals

**Status:** implemented on `claude/column-layout-plan-gfgg8s` · originally planned for `claude/train-arrivals-column-layout-ox4gzk`
**Audience:** the agent implementing this. Everything needed is in this file plus `AGENTS.md`;
the survey of the code it references was done against the `develop` head this branch forks from.
Work the "Implementation steps" top to bottom, one commit each, and run the "Verification"
section before pushing. Do not open a PR unless asked.


## Context

The train arrivals screen (`cta-tracker/src/app/train-arrivals/`) currently stacks every arrival as a
full-width horizontal card, grouped under one direction heading after the other. At a two-direction
station you have to scroll past all Howard-bound trains before you see the first 95th-bound one. The
rider standing on a platform usually cares about one direction, but wants to *see both at once* to
confirm which side they're on and how the two compare.

CTA's own signage solves this with colour inversion: on the Green Line, Ashland/63rd trains are white
text on green, Cottage Grove trains are green text on white. Dani wants the same idea in the app: two
columns, one per direction, distinguishable at a glance without looking cluttered, selectable from
Settings so the existing list layout stays the default.

Six column treatments were considered (survey below). Dani chose **Split Board**. The toggle is
binary: `list` (current, default) vs `columns` (Split Board).

Branch: `claude/train-arrivals-column-layout-ox4gzk`. Scope is the **train** arrivals screen only;
the bus arrivals screen (`src/app/arrivals/`) is per-stop and already single-direction, so columns
don't apply there.

Repo conventions that apply (from `AGENTS.md`): standalone components, `ChangeDetectionStrategy.OnPush`,
`inject()`, signals/`computed`, built-in `@if`/`@for` with mandatory `track`, no `ngTemplateOutlet`
(see `cta-tracker/UPGRADE_TODO.md` TODO 0), `isPlatformBrowser` guards around `localStorage`, Vitest
only for Angular-free modules, new persisted keys go into `PRESERVED_KEYS`. One commit per logical
step, no PR unless asked.

## Layout survey (for the record; only #1 is being built)

All six share the same skeleton: direction `trDr` `'1'` on the left, `'5'` on the right, fixed per
line (today's groups are sorted alphabetically by label, which flips left/right between lines).

1. **Split Board** (chosen). Two columns. Left header is a *filled* pill (white on the line colour),
   right header is the *inverted* pill (line colour text on the card surface, 2px line-colour
   border). Cards are compact and vertical: countdown on top, "To {destNm}" below, meta line last.
   The countdown pill echoes the column's filled/outlined treatment so the number style alone says
   which direction it is. Status (Delayed / Scheduled) becomes a small chip instead of a full-width
   banner. Lowest risk on 320-390px phones; closest to CTA's convention.
2. **Mirror Timeline.** A centre vertical spine in the line colour; arrivals hang left/right of it
   positioned by ETA so vertical alignment shows which direction's train comes first. Layout jumps
   every clock tick and needs minute-bucket grid rows; rejected for jitter/complexity.
3. **Departure Board.** Two dense LED-sign panels: colour header bar, rows of abbreviated destination
   + `tabular-nums` countdown, no cards. Fits 6+ per column but shrinks tap targets and drops the
   card motion the rest of the app uses.
4. **Next-Up Hero.** Per column a giant hero card for the next train, later trains as a wrap of
   small "7 · 12 · 19 min" chips. Most glanceable; hides per-train destination variance (Green Line
   branches, Blue Line short turns) unless chips carry it.
5. **Spine Rails.** The direction label rotated 90° as a rail on the outer edge of each column
   (filled vs outlined), no header row. Saves ~40px vertical; rotated text is a readability and
   screen-reader wart.
6. **Full-card inversion.** Dani's idea taken all the way: left cards solid line colour with white
   text, right cards surface with line-colour text and border. Strongest contrast but every status
   colour (`--pink`, `--yellow`, DUE green) needs a variant that survives a coloured background, and
   Yellow Line needs black text. Worth revisiting as a second variant later; Split Board's CSS is
   written so the filled/outlined pair (`.fill` / `.outline` modifier classes) is reusable.

## Design spec: Split Board

### Behaviour

- Setting off (`'list'`): render exactly today's markup and CSS. No visual change.
- Setting on (`'columns'`):
  - Groups ordered by `trDr` ascending (`'1'` left, `'5'` right); unknown `trDr` values sort last.
  - Two groups: a two-column grid. One group (terminals, Loop stations where the line runs one way,
    late-night gaps): that group spans full width but keeps the column header/card style. Never
    render an empty placeholder column: too many stations (every Loop stop for Brown/Orange/Pink/
    Purple, every terminal) would carry a permanently empty half-screen.
  - Column header: `<h3>` with the direction label from `TRAIN_DIRECTION_MAP` (falls back to `stpDe`
    exactly as today). Left column `fill`, right column `outline`. When only one group renders it
    uses `fill`.
  - Card (compact, vertical, whole card is the existing `routerLink` to `/train-follow/:rn` with
    `{from: stationId, rt}`):
    1. Optional status chip (icon + "Delayed" / "Scheduled") using the existing `--pink` / `--yellow`
       tokens, replacing the full-width banner.
    2. Countdown pill: value (`DUE` / minutes / `--`) + unit (`min`). `fill` variant in the left
       column, `outline` in the right. Status colours (DUE green, delayed pink, scheduled yellow)
       replace the *colour* but never the *treatment*: a delayed train in the right column is a
       pink-outlined pill, in the left column a pink-filled pill. Keep the DUE pulse animation.
    3. `To {destNm}` clamped to 2 lines (Green Line trDr 5 mixes Ashland/63rd and Cottage Grove in
       one column, so the destination stays on every card).
    4. Clock time (`countdown | timeuntil:'time'`), then the existing meta line (API time / distance)
       gated by `prefs.showApiTimestamp()` / `prefs.showDistance()`.
  - Skeleton while loading: two columns, two compact skeleton cards each (uses the same
    `.skeleton-surface` / `.skeleton-line` shimmer classes, copied into the new component's CSS
    because Angular view encapsulation scopes them per component).
  - Everything else (30s auto refresh, `lastRefreshed`, shimmer on refresh via `.loading`,
    favourite + refresh FABs, error message, `@defer (on idle)`) is unchanged.

### Colour

- Line colour is already computed per arrival as `arrival.lineColor` (`var(--cta-*)` string, from
  `TRAIN_LINE_CSS_MAP`). The column element sets it once as `[style.--col-color]` and every rule in
  the new CSS derives from that custom property. (Angular supports `[style.--custom-prop]` binding.)
- `fill`: `background: var(--col-color); color: var(--col-text, #fff)`.
- `outline`: `background: var(--surface-card); color: var(--col-ink); border: 2px solid var(--col-color)`,
  where `--col-ink: color-mix(in srgb, var(--col-color) 72%, var(--text-primary))` so dark Brown
  and Purple stay legible on the dark theme and still read as the line colour in light mode.
- Yellow Line (`rgb(249,227,0)`) fails contrast with white text. Add
  `TRAIN_LINE_TEXT_COLOR_MAP: Record<string,string> = { 'Y': '#000000' }` next to `TRAIN_LINE_CSS_MAP`
  in `trainResponse.ts` and bind it as `--col-text` (undefined → CSS fallback `#fff`). The
  comprehensive-data `CTALine.text_color` exists but only once `traindata` is cached; the static map
  is deterministic and matches CTA's published palette.

### Sizing (page padding 16px each side, column gap 12px)

| Viewport | Content width | Column width | Card inner width (12px padding) |
|---|---|---|---|
| 320 | 288 | 138 | 114 |
| 375 | 343 | 165.5 | 141.5 |
| 390 | 358 | 173 | 149 |
| 430 | 398 | 193 | 169 |

- Header pill: font 11px / 700 / uppercase / `letter-spacing: 0.06em`, `padding: 6px 10px`,
  `border-radius: 999px`, `text-align: center`, allowed to wrap (Green's
  "Ashland/63rd & Cottage Grove-bound" is 2 lines at 138px). Both variants get the same 2px border
  (transparent on `fill`) so the two headers are the same height.
- Card: `border-radius: 16px`, `padding: 12px`, `gap: 8px`, same `--surface-card` / `--card-border` /
  `--card-shadow` / `cardEnter` animation as the list cards.
- Countdown pill: full card width, `height: 56px`, `border-radius: 14px`; value 24px / 900
  (`DUE` drops to 18px like today), unit 10px uppercase.
- Destination: 13px / 700, `display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden`.
- Time: 12px / 500 `--text-tertiary`; meta: 10px, same `·` separator rule as today.
- Status chip: 10px / 700 uppercase, `padding: 3px 8px`, `border-radius: 999px`, 12px icon.
- Bottom padding of the columns wrapper: `calc(56px + 24px)` so the FABs don't cover the last card
  (mirrors `.arrivals-list:last-of-type`).

### Accessibility

- Headers stay `<h3>`; the label text is the primary cue, fill/outline is reinforcement.
- Cards keep the `<a routerLink>` so they're focusable and the tap target is the whole card
  (≥ 56px tall).
- Status chips carry visible text, no icon-only states.
- Toggle row uses the existing `app-toggle-switch` (`role="switch"`, `aria-checked`).

## Files

### New

- `cta-tracker/src/app/train-arrivals/train-arrival-groups.ts` — Angular-free. Owns the view-model
  interfaces (moved out of the component) and the grouping/ordering logic:
  ```ts
  import { TrainEta, TRAIN_DIRECTION_MAP } from '../trainResponse';
  export interface TrainArrivalDisplay extends TrainEta { countdown: string; apiArrivalTime: string; distance: string; lineColor: string; }
  export interface ArrivalGroup { key: string; trDr: string; directionLabel: string; arrivals: TrainArrivalDisplay[]; }
  export type GroupOrder = 'label' | 'direction';
  /** '1' → 1, '5' → 5, anything else → Number.MAX_SAFE_INTEGER (sorts last). */
  export function directionSortKey(trDr: string): number;
  /** Groups by `${rt}_${trDr}`, label from TRAIN_DIRECTION_MAP falling back to stpDe. 'label' keeps
   *  today's localeCompare order (list layout), 'direction' orders by directionSortKey (columns). */
  export function groupTrainArrivals(arrivals: TrainArrivalDisplay[], order: GroupOrder): ArrivalGroup[];
  ```
- `cta-tracker/src/app/train-arrivals/train-arrival-groups.spec.ts` — Vitest. Cases: groups by
  rt+trDr; `'direction'` puts trDr 1 before 5 and unknown last regardless of label; `'label'`
  matches the current alphabetical behaviour; label falls back to `stpDe` for an unmapped route;
  arrivals keep API order within a group; Green Line trDr 5 keeps Ashland and Cottage Grove in one
  group. Build fixtures with a tiny `eta(overrides)` factory in the spec (no Angular imports).
- `cta-tracker/src/app/services/arrivals-layout.ts` — Angular-free:
  ```ts
  export const TRAIN_ARRIVALS_LAYOUT_KEY = 'train-arrivals-layout';
  export type ArrivalsLayout = 'list' | 'columns';
  export const DEFAULT_ARRIVALS_LAYOUT: ArrivalsLayout = 'list';
  export function parseArrivalsLayout(raw: string | null | undefined): ArrivalsLayout; // only 'columns' → 'columns'
  ```
- `cta-tracker/src/app/services/arrivals-layout.spec.ts` — `'columns'` → columns; `'list'`, `null`,
  `''`, `'COLUMNS'`, garbage → list.
- `cta-tracker/src/app/train-arrivals/train-arrival-columns.component.ts|html|css` — standalone,
  OnPush, `imports: [RouterLink, TimeuntilPipe]`, `inject(DisplayPreferencesService)` for the two
  meta toggles. Inputs:
  ```ts
  readonly groups = input<ArrivalGroup[] | null>(null);
  readonly loading = input(false);       // renders the 2×2 skeleton
  readonly stationId = input.required<string>();
  readonly refreshing = input(false);    // adds .loading shimmer to cards
  readonly skeletonColumns = [[0, 1], [0, 1]];
  ```
  Helper: `variantFor(index: number, total: number): 'fill' | 'outline'` → `index === 0 ? 'fill' : 'outline'`.
  Text colour: `textColorFor(rt)` from `TRAIN_LINE_TEXT_COLOR_MAP`. The column's `--col-color` comes
  from `group.arrivals[0].lineColor`.

### Modified

- `cta-tracker/src/app/trainResponse.ts` — add `TRAIN_LINE_TEXT_COLOR_MAP`.
- `cta-tracker/src/app/services/display-preferences.service.ts` — re-export
  `TRAIN_ARRIVALS_LAYOUT_KEY` / `ArrivalsLayout`; add
  `readonly arrivalsLayout = signal<ArrivalsLayout>(this.loadLayout())`,
  `setArrivalsLayout(layout)`, `toggleArrivalsLayout()`, `private loadLayout()` (returns
  `DEFAULT_ARRIVALS_LAYOUT` when not in the browser, else `parseArrivalsLayout(localStorage.getItem(KEY))`).
  The existing `store()` takes a boolean; add a string overload or a separate `storeLayout()`. Keep
  `isBrowser` declared first.
- `cta-tracker/src/app/settings/settings.component.ts` — import the key, append to `PRESERVED_KEYS`.
- `cta-tracker/src/app/settings/settings.component.html` — in the "Arrivals" section, after "Show
  Distance", add a `.settings-row`: title "Column Layout", subtitle
  `{{ prefs.arrivalsLayout() === 'columns' ? 'Side by side' : 'Stacked' }}`,
  `<app-toggle-switch [checked]="prefs.arrivalsLayout() === 'columns'" label="Column layout" (toggled)="prefs.toggleArrivalsLayout()" />`.
  Extend the `section-description` with: "Column layout shows each direction of a train line side
  by side."
- `cta-tracker/src/app/train-arrivals/train-arrivals.component.ts` — delete the two local
  interfaces, import them + `groupTrainArrivals` from `./train-arrival-groups`; replace the inline
  `groupMap` block (lines 103-116) with
  `groupTrainArrivals(displays, this.prefs.arrivalsLayout() === 'columns' ? 'direction' : 'label')`
  (the `computed` now also depends on the layout signal, so flipping the setting re-orders live);
  add `TrainArrivalColumnsComponent` to `imports`.
- `cta-tracker/src/app/train-arrivals/train-arrivals.component.html` — inside the `@defer` block
  only (placeholder/loading/error blocks stay as they are, they show for a split second before the
  chunk loads):
  ```html
  @if (isInitialLoading()) {
    @if (prefs.arrivalsLayout() === 'columns') {
      <app-train-arrival-columns class="cols-4" [loading]="true" [stationId]="stationId()" />
    } @else { …existing skeleton <ul>… }
  }
  @if (!isInitialLoading()) {
    …existing error <p>…
    @if (arrivalGroups(); as groups) {
      @if (prefs.arrivalsLayout() === 'columns') {
        <app-train-arrival-columns class="cols-4" [groups]="groups" [stationId]="stationId()" [refreshing]="refreshing()" />
      } @else { …existing @for groups… (change `track group.directionLabel` to `track group.key`) }
    }
  }
  ```
  `class="cols-4"` on the child host works because `.cols-4` is global in `styles.css`.
- `cta-tracker/src/app/train-arrivals/train-arrivals.component.css` — no changes.
- `AGENTS.md` — one line under "Key Patterns" noting `train-arrival-groups.ts` is Angular-free and
  unit-tested, and that the column layout lives in `train-arrival-columns.component`.

### Columns template sketch (`train-arrival-columns.component.html`)

```html
@if (loading()) {
  <div class="columns" aria-hidden="true">
    @for (col of skeletonColumns; track $index) {
      <section class="column">
        <div class="column-header skeleton-line skeleton-surface"></div>
        @for (card of col; track card) { <div class="col-card skeleton-card">…pill + 2 lines…</div> }
      </section>
    }
  </div>
} @else if (groups(); as groups) {
  <div class="columns" [class.single]="groups.length === 1">
    @for (group of groups; track group.key; let i = $index) {
      <section class="column"
               [class.fill]="variantFor(i, groups.length) === 'fill'"
               [class.outline]="variantFor(i, groups.length) === 'outline'"
               [style.--col-color]="group.arrivals[0].lineColor"
               [style.--col-text]="textColorFor(group.arrivals[0].rt)">
        <h3 class="column-header">{{ group.directionLabel }}</h3>
        <ul class="column-list">
          @for (arrival of group.arrivals; track arrival.rn + arrival.stpId) {
            <li class="col-card" [class.loading]="refreshing()">
              <a [routerLink]="['/train-follow', arrival.rn]" [queryParams]="{from: stationId(), rt: arrival.rt}" class="col-link">
                @if (arrival.isDly === '1') { <span class="status-chip delayed">…svg… Delayed</span> }
                @if (arrival.isSch === '1') { <span class="status-chip scheduled">…svg… Scheduled</span> }
                <div class="col-countdown" [class.countdown-due]="arrival.countdown === 'DUE'" [class.countdown-delayed]="arrival.isDly === '1'" [class.countdown-scheduled]="arrival.isSch === '1'">
                  <span class="countdown-value">{{ arrival.countdown }}</span>
                  <span class="countdown-unit">{{ arrival.countdown | timeuntil:'minutes' }}</span>
                </div>
                <span class="col-destination">To {{ arrival.destNm }}</span>
                <span class="col-time">{{ arrival.countdown | timeuntil:'time' }}</span>
                <span class="col-meta">
                  @if (prefs.showApiTimestamp()) { <span>API {{ arrival.apiArrivalTime }}</span> }
                  @if (prefs.showDistance() && arrival.distance) { <span>{{ arrival.distance }}</span> }
                </span>
              </a>
            </li>
          }
        </ul>
      </section>
    }
  </div>
}
```

CSS skeleton for the variants:
```css
.columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding-bottom: calc(56px + 24px); }
.columns.single { grid-template-columns: minmax(0, 1fr); }
.column { --col-ink: color-mix(in srgb, var(--col-color) 72%, var(--text-primary)); display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.column-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; text-align: center; padding: 6px 10px; border-radius: 999px; border: 2px solid transparent; }
.fill .column-header { background: var(--col-color); color: var(--col-text, #fff); }
.outline .column-header { background: var(--surface-card); color: var(--col-ink); border-color: var(--col-color); }
.col-countdown { height: 56px; border-radius: 14px; border: 2px solid transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.fill .col-countdown { background: var(--col-color); color: var(--col-text, #fff); }
.outline .col-countdown { background: transparent; color: var(--col-ink); border-color: var(--col-color); }
/* status colours swap the colour, keep the treatment */
.fill .countdown-due { background: var(--bus-due); color: #fff; }
.outline .countdown-due { color: var(--bus-due); border-color: var(--bus-due); }
.fill .countdown-delayed { background: var(--pink); color: #fff; }
.outline .countdown-delayed { color: var(--pink); border-color: var(--pink); }
.fill .countdown-scheduled { background: var(--yellow); color: #000; }
.outline .countdown-scheduled { color: var(--yellow); border-color: var(--yellow); }
```
Note: `.fill .countdown-unit` should inherit the pill colour (`color: inherit; opacity: .8`) rather
than `--text-tertiary`.

## Implementation steps (one commit each)

1. **Preference + settings row.** `arrivals-layout.ts` (+ spec), `DisplayPreferencesService`
   signal/setters, `PRESERVED_KEYS`, settings HTML row. `npm test` and `npm run build` green.
   Commit: "Add column layout preference for train arrivals".
2. **Extract grouping.** `train-arrival-groups.ts` (+ spec), wire `TrainArrivalsComponent` to it
   with `'label'` order only (no visual change yet), `track group.key`. Commit:
   "Extract train arrival grouping into a testable module".
3. **Columns component.** `TRAIN_LINE_TEXT_COLOR_MAP`, `train-arrival-columns.component.*`, parent
   template switch, `'direction'` order when columns are on. Commit:
   "Render train arrivals as side-by-side direction columns".
4. **Browser verification + polish** (below). Fix anything the screenshots show; fold fixes into
   step 3's area with a follow-up commit if needed. Update `AGENTS.md`. Push
   `git push -u origin claude/train-arrivals-column-layout-ox4gzk`.

Pitfalls:
- `DisplayPreferencesService` field initializers run in declaration order; `isBrowser` must stay the
  first field.
- `computed` in `TrainArrivalsComponent` must read `this.prefs.arrivalsLayout()` *inside* the
  callback so the dependency is tracked.
- Every `@for` needs `track`; groups by `group.key`, arrivals by `arrival.rn + arrival.stpId`.
- Angular scopes component CSS: the skeleton shimmer classes and the `cardEnter` / `duePulse`
  keyframes must be redeclared in the new component's CSS (copy, don't reference).
- `[style.--col-color]` binding: Angular strips nothing, but Safari needs the property to be set on
  an element *inside* the host for `color-mix` fallbacks; setting it on `.column` (not the host) is
  fine.
- Don't touch the three `@placeholder` / `@loading` skeleton copies in the parent template; they are
  outside the scope and render before the child chunk exists.
- The `node_modules` folder is not present in this checkout: run `npm install` in `cta-tracker/`
  first (Node 22 is installed; `.nvmrc` says 26 but the Angular 22 build works on 22).

## Verification

1. **Unit + types**, from `cta-tracker/`:
   ```bash
   npm install
   npm test
   npx tsc -p tsconfig.spec.json --noEmit
   npm run build
   ```
   All three must be green; CI only runs `npm run build`, so the tests are the local gate.
2. **Browser**, both layouts, both themes, 375×812 and 320×568. Start `npx ng serve --port 4200`
   in the background (dev `environment.ts` points at `https://cta.danielvega.dev/`; the script
   intercepts the two calls it needs so no real backend is required). Install `playwright` into a
   temp directory outside the repo (`npm i playwright` there, never into the project; Chromium is at
   `/opt/pw-browsers`, do not run `playwright install`). Script outline
   (a throwaway script outside the repo, e.g. `/tmp/verify-columns.mjs`):
   - `page.route('**/traindata*', …)` → `{ lines: [{route_id:'G', name:'Green Line', color:'009B3A', text_color:'FFFFFF'}], stations: { '40260': { name:'State/Lake', latitude:41.88574, longitude:-87.627835 } }, stopSequences: {}, lastUpdated:'' }`.
   - `page.route('**/trainstoparrivals*', …)` → a `ctatt` fixture with `errCd:'0'`, `tmst` = now,
     and 5 `eta` rows on `rt:'G'`, `staId:'40260'`: two `trDr:'1'` (`destNm:'Harlem/Lake'`, one
     `isApp:'1'`), three `trDr:'5'` (`destNm:'Ashland/63rd'` ×2 incl. one `isDly:'1'`, and
     `destNm:'Cottage Grove'` with `isSch:'1'`). `arrT` values 1, 4, 7, 12, 19 minutes after `tmst`
     (ISO local `YYYY-MM-DDTHH:mm:ss`, no zone). Include `rn`, `stpId`, `stpDe`, `lat`/`lon` near
     the station.
   - `page.addInitScript` sets `localStorage['train-arrivals-layout']` (`'columns'` / `'list'`) and
     `localStorage['theme-preference']` (`'dark'` / `'light'`) before navigation.
   - Navigate to `http://localhost:4200/train-arrivals/G/40260/State%2FLake`, wait for
     `.column-header` (columns) or `.direction-label` (list), screenshot to that temp directory.
   - Also visit `/settings`, screenshot the Arrivals section, click the "Column layout" switch and
     assert `localStorage['train-arrivals-layout'] === 'columns'`, then reload and assert the
     switch is still checked.
   - Second arrivals fixture with only `trDr:'5'` rows to confirm the single-group full-width case.
   - Look at each screenshot: no horizontal overflow at 320px, both headers same height, DUE pill
     pulses, the delayed card shows a pink outlined pill in the right column, Yellow Line fixture
     (`rt:'Y'`) shows black text on the filled header.
3. **Regression**: with the setting off, diff the rendered `.arrivals-list` DOM against `develop`
   (same fixture) to confirm the list layout is unchanged.
4. Toggle live: with the arrivals page open, change the setting in another tab and reload; also
   check that a stale `'list'` value and a missing key both render the list layout.
