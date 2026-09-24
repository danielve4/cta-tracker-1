# Plan: direction-column layouts for train arrivals (six variants + settings)

> **Superseded.** The six styles this plan describes (Split Board, Mirror Timeline, Departure
> Board, Next Up, Spine Rails, Inverted Cards) were replaced by Platform LED, Typographic, Solari,
> Sentence, Headway and Pocket LCD, plus a third layout, Approach. AGENTS.md ("Train arrivals
> layout") describes what ships now. This file is kept for the reasoning behind the shared
> foundation (the base directive, the subgrid-levelled headers, the per-line swap), which still
> holds.

**Status:** implemented on `claude/column-layout-plan-gfgg8s` · originally planned for `claude/train-arrivals-column-layout-ox4gzk`
Deviations from this document, each with its reason in the commit that made it: the meta line stacks instead of using the list's `·` separator (wrapping left the separator starting the second line); both Spine Rails rails read top-to-bottom rather than mirroring; Mirror Timeline and Departure Board change shape under 340px beyond what §4.2/§4.3 describe. At one direction the card reflows into a row (§2, "One direction only") — spanning the width alone left the column-width stack sitting in the left half of it — and there the meta takes the `·` separator back, since the width that forced it to stack is the width it now has.
**Audience:** the agent implementing this. Everything needed is in this file plus `AGENTS.md`;
the code survey it references was done against the `develop` head this branch forks from.
Work the "Implementation steps" top to bottom, one commit each, and run the "Verification"
section before pushing. Do not open a PR unless asked.

---

## 1. Context

The train arrivals screen (`cta-tracker/src/app/train-arrivals/`) currently stacks every arrival as a
full-width horizontal card, grouped under one direction heading after the other. At a two-direction
station you have to scroll past all Howard-bound trains before you see the first 95th-bound one. The
rider on a platform usually cares about one direction, but wants to *see both at once* to confirm
which side they're on and how the two compare.

CTA's own signage solves this with colour inversion: on the Green Line, Ashland/63rd trains are white
text on green, Cottage Grove trains are green text on white. Dani wants that idea in the app: two
columns, one per direction, distinguishable at a glance without clutter, selectable from Settings so
the existing list stays the default.

Six column treatments are specified below. All six get built, behind one settings toggle
(list vs. columns) plus a "column style" picker. **Split Board (§4.1) is the default column style**
and is built first; the other five follow, one commit each, on the same shared foundation (§3).

Scope is the **train** arrivals screen only. The bus arrivals screen (`src/app/arrivals/`) is
per-stop and already single-direction, so columns don't apply there.

Repo conventions that apply (from `AGENTS.md`): standalone components, `ChangeDetectionStrategy.OnPush`,
`inject()`, signals/`computed`, built-in `@if`/`@for`/`@switch` with mandatory `track`, no
`ngTemplateOutlet` (see `cta-tracker/UPGRADE_TODO.md` TODO 0), `isPlatformBrowser` guards around
`localStorage`, Vitest only for Angular-free modules, every new persisted key goes into
`PRESERVED_KEYS`. One commit per logical step.

### Current code the plan builds on

- `train-arrivals.component.ts:17-27` — `TrainArrivalDisplay` (= `TrainEta` + `countdown`,
  `apiArrivalTime`, `distance`, `lineColor`) and `ArrivalGroup { directionLabel, arrivals }`.
- `train-arrivals.component.ts:67-120` — `processed` computed: filters `eta` by `routeId`, derives
  countdown from `receivedAt + (arrT - tmst)` decayed against `ClockService.now()`, groups by
  `${rt}_${trDr}`, sorts groups alphabetically by label.
- `train-arrivals.component.html:31-85` — per group an `<h3 class="cols-4 direction-label">` then a
  `<ul class="cols-4 arrivals-list">` of `.arrival-card` (48px line badge | destination + time + meta
  | 64px countdown pill), delayed/scheduled as full-width banners, whole card a `routerLink` to
  `/train-follow/:rn` with `{from: stationId, rt}`.
- Host element `app-train-arrivals` is a 4-column CSS grid, 16px padding, 16px gap
  (`src/styles.css:263-277`); `.cols-4` spans it.
- `trainResponse.ts:69-100` — `TRAIN_LINE_CSS_MAP` (route → `--cta-*` var) and
  `TRAIN_DIRECTION_MAP` (route → `{ '1': label, '5': label }`).
- `services/display-preferences.service.ts` — boolean signal prefs backed by `localStorage`,
  `isBrowser` must be the first field. Settings rows in `settings/settings.component.html:15-39`
  use `<app-toggle-switch>`.
- `TimeuntilPipe` (`'time'` → clock string, `'minutes'` → `'min'` or `''`); `countdownLabel()` in
  `services/arrival-time.ts` yields `'DUE'` / minutes / `'--'`.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Settings model | Toggle **Column Layout** (`list` / `columns`) + radio-chip **Column Style** (6 values, shown only when the toggle is on) | Matches the ask ("toggle current vs column") and still lets every variant be tried. |
| Default column style | `split-board` | Closest to CTA's convention, safest on 320px. |
| Column order | `trDr` `'1'` left, `'5'` right, unknown last | Fixed per line so muscle memory works; today's alphabetical order flips sides between lines. |
| Swapping sides | A **Swap** chip in the stop header (columns layout, two directions only) flips `'5'` to the left for that *line*, stored as a JSON array of route ids under `train-arrivals-swapped-lines` | Per line keeps the same-side-at-every-station rule while letting a rider put their usual direction first. Fill/outline and timeline sides key off position, so they follow the swap. |
| One direction only (terminals, Loop stations, late-night gaps) | Render that group full width in the same style; never an empty placeholder column. The card reflows into a row — countdown beside the text, `.columns.single` in `columns-shared.css` — rather than keeping the column-width stack | Every Loop stop for Brown/Orange/Pink/Purple and every terminal would otherwise carry a permanent empty half-screen. Spanning the width is not using it: a stack drawn for a 165px column leaves the right half of a 343px card empty, which is the same empty half by another route. A width-driven concession (a stacked meta, Mirror Timeline's and Departure Board's sub-340px fallbacks, Spine Rails hiding the meta) has to be scoped to `:not(.single)` for the same reason. |
| Component structure | One switcher component + one small component per style, sharing an abstract base directive and a shared stylesheet | Keeps each template short; `@switch` in one 400-line template would be unreadable and Angular scopes CSS per component anyway. |
| Line colour delivery | `--col-color` / `--col-text` custom properties set on each column element | Every variant's CSS derives from two vars; no per-line classes. |
| Filled vs outlined | `.fill` / `.outline` modifier classes on the column element | Shared by all six variants; status colours swap the *colour*, never the *treatment*. |
| List layout | Untouched byte-for-byte when the toggle is off | "Current layout" must stay exactly current. |

---

## 3. Shared foundation

### 3.1 Preference model — `src/app/services/arrivals-layout.ts` (Angular-free)

```ts
export const TRAIN_ARRIVALS_LAYOUT_KEY = 'train-arrivals-layout';
export const TRAIN_ARRIVALS_COLUMN_STYLE_KEY = 'train-arrivals-column-style';

export type ArrivalsLayout = 'list' | 'columns';
export const DEFAULT_ARRIVALS_LAYOUT: ArrivalsLayout = 'list';

export type ColumnStyle =
  | 'split-board' | 'mirror-timeline' | 'departure-board'
  | 'next-up' | 'spine-rails' | 'inverted-cards';
export const DEFAULT_COLUMN_STYLE: ColumnStyle = 'split-board';
export const COLUMN_STYLES: ReadonlyArray<{ id: ColumnStyle; title: string; blurb: string }> = [
  { id: 'split-board',     title: 'Split Board',     blurb: 'Filled vs outlined direction pills, compact cards.' },
  { id: 'mirror-timeline', title: 'Mirror Timeline', blurb: 'Both directions on one shared time spine.' },
  { id: 'departure-board', title: 'Departure Board', blurb: 'Dense station-sign rows, most trains on screen.' },
  { id: 'next-up',         title: 'Next Up',         blurb: 'Big next train per direction, later ones as chips.' },
  { id: 'spine-rails',     title: 'Spine Rails',     blurb: 'Direction label as a vertical rail on the outer edge.' },
  { id: 'inverted-cards',  title: 'Inverted Cards',  blurb: 'Whole cards in line colour on one side, inverted on the other.' }
];

export function parseArrivalsLayout(raw: string | null | undefined): ArrivalsLayout; // only 'columns' → 'columns'
export function parseColumnStyle(raw: string | null | undefined): ColumnStyle;       // unknown → DEFAULT_COLUMN_STYLE
```

`arrivals-layout.spec.ts`: `'columns'` → columns; `'list'`, `null`, `''`, `'COLUMNS'`, garbage → list;
each of the six ids round-trips; garbage → `split-board`.

### 3.2 `DisplayPreferencesService` additions

```ts
readonly arrivalsLayout = signal<ArrivalsLayout>(this.loadLayout());
readonly columnStyle    = signal<ColumnStyle>(this.loadColumnStyle());
setArrivalsLayout(layout: ArrivalsLayout): void; toggleArrivalsLayout(): void;
setColumnStyle(style: ColumnStyle): void;
```
Loaders return the default when `!isBrowser`, else `parseX(localStorage.getItem(KEY))`. Add a
`storeString(key, value)` next to the boolean `store()`. Re-export the two keys and both types from
the service so `settings.component.ts` keeps importing keys from one place. Append both keys to
`PRESERVED_KEYS` in `settings.component.ts`.

### 3.3 Grouping — `src/app/train-arrivals/train-arrival-groups.ts` (Angular-free)

Move the two interfaces out of the component and add one field the timeline needs:

```ts
import { TrainEta, TRAIN_DIRECTION_MAP } from '../trainResponse';

export interface TrainArrivalDisplay extends TrainEta {
  countdown: string;        // 'DUE' | minutes | '--'
  arrivalEpochMs: number;   // NEW: the anchored instant the countdown is derived from (NaN when unknown)
  apiArrivalTime: string;
  distance: string;
  lineColor: string;        // 'var(--cta-red)' etc.
}
export interface ArrivalGroup {
  key: string;              // `${rt}_${trDr}`
  trDr: string;
  directionLabel: string;   // TRAIN_DIRECTION_MAP[rt]?.[trDr] ?? stpDe (unchanged behaviour)
  arrivals: TrainArrivalDisplay[];   // API order preserved (arrival-time ascending in practice)
}
export type GroupOrder = 'label' | 'direction';

/** '1' → 1, '5' → 5, anything else → Number.MAX_SAFE_INTEGER. */
export function directionSortKey(trDr: string): number;
/** 'label' = today's localeCompare order (list layout). 'direction' = directionSortKey order (columns). */
export function groupTrainArrivals(arrivals: TrainArrivalDisplay[], order: GroupOrder): ArrivalGroup[];
/** Variant helpers, all pure: */
export function splitNextUp(group: ArrivalGroup): { hero: TrainArrivalDisplay; later: TrainArrivalDisplay[] };
export interface TimelineRow { side: 'left' | 'right'; arrival: TrainArrivalDisplay; }
/** Merge ≤2 groups into one list ordered by arrivalEpochMs (NaN last), ties: left first. */
export function mergeTimeline(groups: ArrivalGroup[]): TimelineRow[];
/** Short destination for chips: text before the first ' & ' or '/', max 14 chars + '…'. */
export function shortDestination(destNm: string): string;
```

`train-arrival-groups.spec.ts` covers: groups by rt+trDr; `'direction'` puts 1 before 5 and unknown
last regardless of label; `'label'` reproduces the current alphabetical order; label falls back to
`stpDe` for an unmapped route; order within a group is preserved; Green Line trDr 5 keeps
Ashland/63rd and Cottage Grove in one group; `splitNextUp` on a 1-arrival group gives empty
`later`; `mergeTimeline` interleaves by time with NaN last and left-first ties; `shortDestination`
("Ashland/63rd" → "Ashland", "Harlem/Lake" → "Harlem", "95th/Dan Ryan" → "95th", "Cottage Grove"
unchanged). Fixtures: a tiny `eta(overrides)` factory inside the spec, no Angular imports.

`TrainArrivalsComponent.processed` then becomes: build `displays` exactly as today plus
`arrivalEpochMs`, then
`groupTrainArrivals(displays, this.prefs.arrivalsLayout() === 'columns' ? 'direction' : 'label')`.
Reading the pref inside the `computed` makes a settings flip re-order live.

### 3.4 Component layout — `src/app/train-arrivals/columns/`

```
columns/
  column-variant.base.ts          @Directive() abstract class ColumnVariantBase (inputs + prefs + helpers)
  columns-shared.css              tokens, .fill/.outline, compact card, countdown pill, status chip, skeleton, keyframes
  train-arrival-columns.component.ts|html|css   the switcher (@switch on prefs.columnStyle())
  split-board.component.ts|html|css
  mirror-timeline.component.ts|html|css
  departure-board.component.ts|html|css
  next-up.component.ts|html|css
  spine-rails.component.ts|html|css
  inverted-cards.component.ts|html|css
```

`ColumnVariantBase`:
```ts
@Directive()
export abstract class ColumnVariantBase {
  readonly groups = input<ArrivalGroup[] | null>(null);
  readonly loading = input(false);                 // render the variant's skeleton
  readonly stationId = input.required<string>();
  readonly refreshing = input(false);              // adds .loading shimmer to cards
  protected readonly prefs = inject(DisplayPreferencesService);
  readonly skeletonColumns = [[0, 1], [0, 1]];
  variantFor(index: number): 'fill' | 'outline' { return index === 0 ? 'fill' : 'outline'; }
  colorFor(group: ArrivalGroup): string { return group.arrivals[0]?.lineColor ?? 'var(--cta-grey)'; }
  textColorFor(group: ArrivalGroup): string { return TRAIN_LINE_TEXT_COLOR_MAP[group.arrivals[0]?.rt] ?? '#FFFFFF'; }
  isSingle(groups: ArrivalGroup[]): boolean { return groups.length === 1; }
}
```
Every variant: `@Component({ selector: 'app-<style>', imports: [RouterLink, TimeuntilPipe],
styleUrls: ['./columns-shared.css', './<style>.component.css'], changeDetection: OnPush })
export class XComponent extends ColumnVariantBase {}`.

Switcher template:
```html
@switch (prefs.columnStyle()) {
  @case ('mirror-timeline') { <app-mirror-timeline [groups]="groups()" [loading]="loading()" [stationId]="stationId()" [refreshing]="refreshing()" /> }
  @case ('departure-board') { <app-departure-board … /> }
  @case ('next-up')         { <app-next-up … /> }
  @case ('spine-rails')     { <app-spine-rails … /> }
  @case ('inverted-cards')  { <app-inverted-cards … /> }
  @default                  { <app-split-board … /> }
}
```
The switcher itself extends nothing; it takes the same four inputs and forwards them. Its host gets
`class="cols-4"` from the parent (`.cols-4` is global in `styles.css`).

Parent template (`train-arrivals.component.html`), inside the `@defer` block only. The
`@placeholder` / `@loading` / `@error` blocks stay untouched (they show before the chunk exists):
```html
@if (isInitialLoading()) {
  @if (prefs.arrivalsLayout() === 'columns') {
    <app-train-arrival-columns class="cols-4" [loading]="true" [stationId]="stationId()" />
  } @else { …existing skeleton <ul> unchanged… }
}
@if (!isInitialLoading()) {
  …existing error <p> unchanged…
  @if (arrivalGroups(); as groups) {
    @if (prefs.arrivalsLayout() === 'columns') {
      <app-train-arrival-columns class="cols-4" [groups]="groups" [stationId]="stationId()" [refreshing]="refreshing()" />
    } @else { …existing @for unchanged except `track group.directionLabel` → `track group.key`… }
  }
}
```

### 3.5 Colour rules (`columns-shared.css`)

- `trainResponse.ts`: add `export const TRAIN_LINE_TEXT_COLOR_MAP: Record<string, string> = { 'Y': '#000000' };`
  Yellow (`rgb(249,227,0)`) fails contrast with white. Pink (`rgb(226,126,166)`) with white is
  ~2.6:1 but matches CTA's own signage; keep white and use 700+ weight. Document both in a comment.
- Each column element sets `[style.--col-color]="colorFor(group)"` and
  `[style.--col-text]="textColorFor(group)"`. (Angular binds custom properties via `[style.--name]`.)
- Derived once per column:
  `--col-ink: color-mix(in srgb, var(--col-color) 72%, var(--text-primary));` — keeps Brown and
  Purple legible on the dark theme, still reads as the line colour in light mode.
  `--col-tint: color-mix(in srgb, var(--col-color) 12%, transparent);`
- Treatments:
  ```css
  .fill    .pill { background: var(--col-color); color: var(--col-text, #fff); border-color: transparent; }
  .outline .pill { background: var(--surface-card); color: var(--col-ink); border-color: var(--col-color); }
  /* status colours replace the colour, never the treatment */
  .fill .countdown-due       { background: var(--bus-due); color: #fff; }
  .outline .countdown-due    { color: var(--bus-due); border-color: var(--bus-due); }
  .fill .countdown-delayed   { background: var(--pink); color: #fff; }
  .outline .countdown-delayed{ color: var(--pink); border-color: var(--pink); }
  .fill .countdown-scheduled { background: var(--yellow); color: #000; }
  .outline .countdown-scheduled { color: var(--yellow); border-color: var(--yellow); }
  ```
  `.pill` is the shared class on header pills and countdown pills; every pill has a 2px border
  (transparent on `.fill`) so filled and outlined siblings are the same height.

### 3.6 Shared building blocks (`columns-shared.css`)

- `.columns` — `display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; padding-bottom: calc(56px + 24px)` (FAB clearance, mirrors `.arrivals-list:last-of-type`). `.columns.single { grid-template-columns: minmax(0,1fr); }`
- `.column` — `display:flex; flex-direction:column; gap:10px; min-width:0;` plus the derived vars above.
- `.column-header` — `<h3>`, `.pill`, 11px / 700 / uppercase / `letter-spacing:.06em` / `text-align:center` / `padding:6px 10px` / `border-radius:999px`; wraps to two lines for "Ashland/63rd & Cottage Grove-bound" at 138px.
- `.col-card` — compact vertical card: `border-radius:16px; padding:12px; display:flex; flex-direction:column; gap:8px; background:var(--surface-card); border:1px solid var(--card-border); box-shadow:var(--card-shadow); animation: cardEnter …` (copy the `cardEnter`, `duePulse`, `shimmer`, `skeletonShimmer` keyframes from `train-arrivals.component.css`; view encapsulation means they must be redeclared here). `.col-link` = `display:flex; flex-direction:column; gap:8px; text-decoration:none; color:inherit`.
- `.col-countdown` — `.pill`, `height:56px; border-radius:14px; display:flex; flex-direction:column; align-items:center; justify-content:center;` value 24px/900 (`DUE` 18px), unit 10px uppercase, `color:inherit; opacity:.8`. Keep `duePulse` on `.countdown-due`.
- `.col-destination` — 13px/700, 2-line clamp (`display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden`).
- `.col-time` — 12px/500 `--text-tertiary`. `.col-meta` — 10px, same `·` separator rule as `.arrival-meta`, `:empty { display:none }`.
- `.status-chip` — `display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; padding:3px 8px; border-radius:999px; align-self:flex-start;` `.delayed { background:var(--pink-opacity); color:var(--pink) }`, `.scheduled { background:var(--yellow-opacity); color:var(--yellow) }`, 12px inline SVG (same paths as the current banners).
- `.loading .col-link::before` — same shimmer overlay as `.loading .arrival-content::before`.
- Skeleton: `.skeleton-surface`, `.skeleton-line`, `.skeleton-card { pointer-events:none }` copied from the list CSS; each variant defines its own skeleton shape.

### 3.7 Sizing reference (16px page padding, 12px column gap)

| Viewport | Content | Column | Card inner (12px padding) |
|---|---|---|---|
| 320 | 288 | 138 | 114 |
| 375 | 343 | 165.5 | 141.5 |
| 390 | 358 | 173 | 149 |
| 430 | 398 | 193 | 169 |

No horizontal overflow is allowed at 320px in any variant; every `grid-template-columns` uses
`minmax(0, 1fr)` and every text block has `min-width: 0`.

### 3.8 Accessibility (all variants)

- Direction headers are `<h3>` (or the rail `<h3>` in Spine Rails); label text is the primary cue,
  fill/outline reinforces it.
- Every arrival stays an `<a routerLink>`; tap target ≥ 44px tall.
- Status chips always carry visible text.
- Where DOM order interleaves directions (Mirror Timeline) each link gets
  `[attr.aria-label]="directionLabel + ': ' + countdown + ' min to ' + destNm"`.
- The Column Style picker is a `role="radiogroup"` of `<button role="radio" aria-checked>`.

---

## 4. Variant specs

Each variant receives `groups` already ordered `'1'` left, `'5'` right, and uses `variantFor(i)`
(`fill` for index 0, `outline` for index 1). With one group, index 0 → `fill` and the wrapper gets
`.single`.

### 4.1 Split Board (`split-board`) — default

**Look.** Two columns. Filled header pill on the left, outlined on the right. Compact vertical
cards; the countdown pill echoes the column treatment so the number style alone tells the direction.

**Template.**
```html
@if (loading()) {
  <div class="columns" aria-hidden="true">
    @for (col of skeletonColumns; track $index) {
      <section class="column">
        <div class="column-header skeleton-line skeleton-surface" style="height:26px"></div>
        @for (card of col; track card) {
          <div class="col-card skeleton-card">
            <div class="col-countdown skeleton-surface" style="background: var(--bus-countdown-bg)"></div>
            <span class="skeleton-line skeleton-surface" style="width:80%;height:12px"></span>
            <span class="skeleton-line skeleton-surface" style="width:50%;height:10px"></span>
          </div>
        }
      </section>
    }
  </div>
} @else if (groups(); as groups) {
  <div class="columns" [class.single]="isSingle(groups)">
    @for (group of groups; track group.key; let i = $index) {
      <section class="column" [class.fill]="variantFor(i) === 'fill'" [class.outline]="variantFor(i) === 'outline'"
               [style.--col-color]="colorFor(group)" [style.--col-text]="textColorFor(group)">
        <h3 class="column-header pill">{{ group.directionLabel }}</h3>
        <ul class="column-list">
          @for (arrival of group.arrivals; track arrival.rn + arrival.stpId) {
            <li class="col-card" [class.loading]="refreshing()">
              <a [routerLink]="['/train-follow', arrival.rn]" [queryParams]="{from: stationId(), rt: arrival.rt}" class="col-link">
                @if (arrival.isDly === '1') { <span class="status-chip delayed"><svg …/>Delayed</span> }
                @if (arrival.isSch === '1') { <span class="status-chip scheduled"><svg …/>Scheduled</span> }
                <div class="col-countdown pill" [class.countdown-due]="arrival.countdown === 'DUE'"
                     [class.countdown-delayed]="arrival.isDly === '1'" [class.countdown-scheduled]="arrival.isSch === '1'">
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
**CSS.** Only `.column-list { display:flex; flex-direction:column; gap:10px; }` beyond the shared
file. **Edge cases.** Green trDr 5 shows both branch destinations in one column via
`.col-destination`; single group → full width.

### 4.2 Mirror Timeline (`mirror-timeline`)

**Look.** One vertical spine in the line colour down the centre. Every arrival, both directions,
is one row ordered by arrival time; a row's card sits left (trDr 1) or right (trDr 5) of the spine
and touches it with its countdown pill, so reading top-to-bottom is reading "what comes next at
this station" and the side tells you the direction. Rows are spaced by *rank*, not by minutes, so
the layout never jitters as the clock ticks.

**Data.** `mergeTimeline(groups)` (§3.3). Time source is `arrivalEpochMs`; `'DUE'` rows have the
smallest values naturally. NaN (`'--'`) rows sort last.

**Template.**
```html
<div class="timeline" [class.single]="isSingle(groups)">
  <header class="timeline-head">
    <h3 class="column-header pill fill" [style.--col-color]="colorFor(groups[0])" …>{{ groups[0].directionLabel }}</h3>
    <span class="spine-cap" aria-hidden="true"></span>
    @if (groups[1]) { <h3 class="column-header pill outline" …>{{ groups[1].directionLabel }}</h3> } @else { <span></span> }
  </header>
  <ol class="timeline-rows" [style.--col-color]="colorFor(groups[0])" [style.--col-text]="textColorFor(groups[0])">
    @for (row of rows(); track row.arrival.rn + row.arrival.stpId) {
      <li class="timeline-row" [class.left]="row.side === 'left'" [class.right]="row.side === 'right'"
          [class.fill]="row.side === 'left'" [class.outline]="row.side === 'right'" [class.loading]="refreshing()">
        <a class="timeline-card" [routerLink]="['/train-follow', row.arrival.rn]" [queryParams]="{from: stationId(), rt: row.arrival.rt}"
           [attr.aria-label]="labelFor(row)">
          <div class="col-countdown pill" …status classes…>…value/unit…</div>
          <div class="timeline-text">
            <span class="col-destination">To {{ row.arrival.destNm }}</span>
            <span class="col-time">{{ row.arrival.countdown | timeuntil:'time' }}</span>
            @if (row.arrival.isDly === '1') { <span class="status-chip delayed">…</span> }
            @if (row.arrival.isSch === '1') { <span class="status-chip scheduled">…</span> }
            <span class="col-meta">…</span>
          </div>
        </a>
        <span class="spine-dot" aria-hidden="true"></span>
      </li>
    }
  </ol>
</div>
```
`rows = computed(() => mergeTimeline(this.groups() ?? []))`; `labelFor(row)` returns
`${directionLabel}: ${countdown} min to ${destNm}` (directionLabel looked up from the row's side).

**CSS.**
```css
.timeline { display:flex; flex-direction:column; gap:8px; padding-bottom: calc(56px + 24px); }
.timeline-head, .timeline-row { display:grid; grid-template-columns: minmax(0,1fr) 28px minmax(0,1fr); column-gap:6px; align-items:center; }
.timeline-rows { position:relative; display:flex; flex-direction:column; gap:10px; }
.timeline-rows::before { content:''; position:absolute; left:50%; top:0; bottom:0; width:4px; transform:translateX(-50%); background:var(--col-color); border-radius:2px; opacity:.9; }
.spine-cap { width:12px; height:12px; border-radius:50%; background:var(--col-color); justify-self:center; }
.spine-dot { grid-column:2; width:14px; height:14px; border-radius:50%; border:3px solid var(--col-color); background:var(--background); justify-self:center; z-index:1; }
.timeline-row.left  .timeline-card { grid-column:1; flex-direction:row-reverse; }   /* pill hugs the spine */
.timeline-row.right .timeline-card { grid-column:3; flex-direction:row; }
.timeline-card { display:flex; gap:8px; align-items:center; padding:8px; border-radius:14px; background:var(--surface-card); border:1px solid var(--card-border); box-shadow:var(--card-shadow); text-decoration:none; color:inherit; min-width:0; }
.timeline-card .col-countdown { width:52px; height:52px; flex-shrink:0; }
.timeline-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
.timeline-row.left .timeline-text { text-align:right; align-items:flex-end; }
.timeline.single .timeline-head, .timeline.single .timeline-row { grid-template-columns: 28px minmax(0,1fr); }
.timeline.single .spine-cap, .timeline.single .spine-dot { grid-column:1; }
.timeline.single .timeline-card { grid-column:2; flex-direction:row; }
.timeline.single .timeline-rows::before { left:14px; }
```
Sizes at 375px: side width `(343 - 28 - 12) / 2 = 151px`; card inner after 8px padding = 135px;
pill 52px leaves 75px for text (destination wraps to 2 lines, 12px font). At 320px side = 124px,
text 48px: drop `.col-time` below 340px via `@media (max-width: 340px) { .timeline .col-time { display:none } }`.
DUE pulse stays. **Skeleton:** 4 rows alternating sides, grey pills. **Edge cases.** Single group →
spine on the left, all cards on the right (`.single`). Ten+ arrivals: fine, it's a normal scrolling
list. Sort stability: `mergeTimeline` must be a stable sort so equal-minute rows keep API order.

### 4.3 Departure Board (`departure-board`)

**Look.** Two dense panels like the LED signs on a platform: a full-width header bar, then one
40px row per train — destination on the left, big tabular countdown on the right — separated by
hairlines, no cards. Six or seven trains per column above the fold.

**Template.**
```html
<div class="columns" [class.single]="isSingle(groups)">
  @for (group of groups; track group.key; let i = $index) {
    <section class="column panel" [class.fill]=… [class.outline]=… [style.--col-color]=… [style.--col-text]=…>
      <h3 class="panel-header pill">{{ group.directionLabel }}</h3>
      <ol class="panel-rows">
        @for (arrival of group.arrivals; track arrival.rn + arrival.stpId) {
          <li class="panel-row" [class.loading]="refreshing()">
            <a class="row-link" [routerLink]=… [queryParams]=…>
              <span class="row-main">
                <span class="row-dest">
                  @if (arrival.isDly === '1') { <svg class="row-icon delayed" …/> }
                  @if (arrival.isSch === '1') { <svg class="row-icon scheduled" …/> }
                  {{ arrival.destNm }}
                </span>
                @if (prefs.showApiTimestamp() || (prefs.showDistance() && arrival.distance)) {
                  <span class="col-meta">…API / distance…</span>
                }
              </span>
              <span class="row-eta" [class.countdown-due]=… [class.countdown-delayed]=… [class.countdown-scheduled]=…>
                <span class="row-eta-value">{{ arrival.countdown }}</span>
                <span class="row-eta-unit">{{ arrival.countdown | timeuntil:'minutes' }}</span>
              </span>
            </a>
          </li>
        }
      </ol>
    </section>
  }
</div>
```
**CSS.**
```css
.panel { gap:0; background:var(--surface-card); border:1px solid var(--card-border); border-radius:16px; overflow:hidden; box-shadow:var(--card-shadow); }
.panel-header { border-radius:0; padding:8px 10px; margin:0; }           /* pill treatment, square corners */
.outline .panel-header { border-width:0 0 2px 0; }                          /* underline instead of a box */
.panel-rows { display:flex; flex-direction:column; }
.panel-row + .panel-row { border-top:1px solid var(--card-border); }
.row-link { display:grid; grid-template-columns: minmax(0,1fr) auto; align-items:center; gap:8px; min-height:44px; padding:6px 10px; text-decoration:none; color:inherit; }
.row-dest { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:4px; }
.row-icon { width:12px; height:12px; flex-shrink:0; } .row-icon.delayed { color:var(--pink) } .row-icon.scheduled { color:var(--yellow) }
.row-eta { display:flex; align-items:baseline; gap:2px; font-variant-numeric: tabular-nums; }
.row-eta-value { font-size:18px; font-weight:900; letter-spacing:-.02em; }
.row-eta-unit { font-size:9px; font-weight:700; text-transform:uppercase; color:var(--text-tertiary); }
.row-eta.countdown-due .row-eta-value { color:var(--bus-due); font-size:14px; }
.row-eta.countdown-delayed .row-eta-value { color:var(--pink); }
.row-eta.countdown-scheduled .row-eta-value { color:var(--yellow); }
.fill .row-eta-value { color: var(--col-ink); }            /* fill column: ETAs in line colour */
.outline .row-eta-value { color: var(--text-primary); }    /* outline column: plain ETAs */
.loading .row-link::before { …shimmer… }
```
The fill/outline distinction here lives in the header bar (solid vs underlined) and the ETA ink,
since there are no pills per row. Rows with meta grow to 52px. **Skeleton:** header bar + 4 rows
with two grey lines each. **Edge cases.** Long destinations ellipsise (`title` attribute carries
the full name); single group → one full-width panel.

### 4.4 Next Up (`next-up`)

**Look.** Per column: header pill, then one hero card for the next train with a huge countdown, then
the later trains as a wrapping row of small chips ("7 min", "12 min", "19 min"). Glanceable from
across the platform.

**Data.** `splitNextUp(group)` → `{ hero, later }`. Chips show `shortDestination(destNm)` under the
number only when it differs from the hero's `destNm` (Green Line branches, Blue short turns);
otherwise the chip is number + unit only.

**Template.**
```html
<section class="column" …fill/outline/vars…>
  <h3 class="column-header pill">{{ group.directionLabel }}</h3>
  @let split = splitNextUp(group);
  <a class="hero col-card" [class.loading]="refreshing()" [routerLink]=…hero… [queryParams]=…>
    @if (split.hero.isDly === '1') { <span class="status-chip delayed">…</span> }
    @if (split.hero.isSch === '1') { <span class="status-chip scheduled">…</span> }
    <div class="col-countdown pill hero-countdown" …status classes…>
      <span class="countdown-value">{{ split.hero.countdown }}</span>
      <span class="countdown-unit">{{ split.hero.countdown | timeuntil:'minutes' }}</span>
    </div>
    <span class="col-destination">To {{ split.hero.destNm }}</span>
    <span class="col-time">{{ split.hero.countdown | timeuntil:'time' }}</span>
    <span class="col-meta">…</span>
  </a>
  @if (split.later.length) {
    <p class="later-label">Then</p>
    <ul class="later">
      @for (arrival of split.later; track arrival.rn + arrival.stpId) {
        <li>
          <a class="chip pill" [routerLink]=… [queryParams]=… [title]="'To ' + arrival.destNm"
             [class.countdown-due]=… [class.countdown-delayed]=… [class.countdown-scheduled]=…>
            <span class="chip-value">{{ arrival.countdown }}<small>{{ arrival.countdown | timeuntil:'minutes' }}</small></span>
            @if (arrival.destNm !== split.hero.destNm) { <span class="chip-dest">{{ shortDestination(arrival.destNm) }}</span> }
          </a>
        </li>
      }
    </ul>
  }
</section>
```
(`@let` is available in Angular 22 templates; it avoids calling `splitNextUp` four times.)

**CSS.**
```css
.hero-countdown { height:84px; border-radius:18px; }
.hero-countdown .countdown-value { font-size:40px; } .hero-countdown.countdown-due .countdown-value { font-size:28px; }
.later-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text-tertiary); margin:2px 0 -4px 4px; }
.later { display:flex; flex-wrap:wrap; gap:6px; }
.chip { display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:56px; min-height:44px; padding:4px 8px; border-radius:12px; text-decoration:none; }
.chip-value { font-size:15px; font-weight:900; line-height:1; } .chip-value small { font-size:8px; font-weight:700; margin-left:2px; text-transform:uppercase; opacity:.8; }
.chip-dest { font-size:9px; font-weight:600; max-width:80px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:.9; }
/* chips take the column treatment but muted: */
.fill .chip { background: color-mix(in srgb, var(--col-color) 80%, var(--surface-card)); }
.outline .chip { border-width:1.5px; }
```
Status colours on chips follow the shared rules (`.fill .countdown-delayed` etc.). At 138px column
width two chips fit per row (56 + 6 + 56 = 118px); three at 193px. **Skeleton:** header, one tall
grey pill, two small grey chips. **Edge cases.** One arrival → hero only, no "Then". Hero is
`isSch` → still hero (it is the next scheduled train), chip and pill turn yellow.

### 4.5 Spine Rails (`spine-rails`)

**Look.** No header row. The direction label is a vertical rail hugging the *outer* edge of each
column (left edge for trDr 1, right edge for trDr 5), filled on the left, outlined on the right,
running the full height of that column's cards. Cards are the Split Board compact cards.

**Template.**
```html
<div class="columns" [class.single]="isSingle(groups)">
  @for (group of groups; track group.key; let i = $index) {
    <section class="column railed" [class.rail-left]="i === 0" [class.rail-right]="i === 1" …fill/outline/vars…>
      <h3 class="rail pill"><span class="rail-text">{{ group.directionLabel }}</span></h3>
      <ul class="column-list">…same <li class="col-card"> as Split Board…</ul>
    </section>
  }
</div>
```
**CSS.**
```css
.railed { display:grid; grid-template-columns: 28px minmax(0,1fr); column-gap:8px; align-items:stretch; }
.railed.rail-right { grid-template-columns: minmax(0,1fr) 28px; }
.railed.rail-right .rail { grid-column:2; grid-row:1; } .railed.rail-right .column-list { grid-column:1; grid-row:1; }
.rail { margin:0; padding:10px 0; border-radius:999px; display:flex; align-items:flex-start; justify-content:center; min-height:120px; overflow:hidden; }
.rail-text { writing-mode: vertical-rl; text-orientation: mixed; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-height:100%; }
.rail-left .rail-text { transform: rotate(180deg); }   /* left rail reads bottom-to-top, right rail top-to-bottom: book-spine mirror */
.railed .column-list { display:flex; flex-direction:column; gap:10px; min-width:0; }
.columns.single .railed { grid-template-columns: 28px minmax(0,1fr); }
```
Card width at 375px: `165.5 - 28 - 8 = 129.5px` (inner 105px): shrink `.railed .countdown-value`
to 22px and `.col-destination` to 12px. At 320px it is 102px (inner 78px): also hide `.col-meta`
under `@media (max-width: 340px)`. The rail is `align-self: stretch` so it grows with the card
stack; a single card (56px pill + text ≈ 130px) still fits "Howard-bound"; longer labels ellipsise
and the full label is in `title`. **Skeleton:** grey rail + two skeleton cards per column.
**Edge cases.** Single group → rail on the left. Screen readers read the rotated `<h3>` normally.

### 4.6 Inverted Cards (`inverted-cards`)

**Look.** Dani's original idea taken all the way: the *whole card* carries the treatment. Left
column cards are solid line colour with white (or black, for Yellow) text; right column cards are
the surface colour with line-colour text and a 2px line-colour border. Header pills as in Split
Board. Maximum contrast between the two directions.

**Template.** Identical to Split Board (§4.1) with `col-card` → `inv-card`.

**CSS.**
```css
.fill .inv-card    { background: var(--col-color); color: var(--col-text, #fff); border-color: transparent;
                     box-shadow: 0 4px 14px color-mix(in srgb, var(--col-color) 35%, transparent); }
.outline .inv-card { background: var(--surface-card); color: var(--col-ink); border: 2px solid var(--col-color); }
/* countdown pill sits *inside* an already-coloured card, so it becomes a translucent well */
.fill .inv-card .col-countdown    { background: rgba(255,255,255,.18); color: inherit; border-color: transparent; }
.fill .inv-card[style*="--col-text: #000000"] .col-countdown { background: rgba(0,0,0,.10); }   /* or bind a .dark-text class from textColorFor() */
.outline .inv-card .col-countdown { background: var(--col-tint); color: var(--col-ink); border-color: transparent; }
/* status colours on a filled card: white well with coloured text reads on every line colour */
.fill .inv-card .countdown-due       { background:#fff; color: var(--bus-due); }
.fill .inv-card .countdown-delayed   { background:#fff; color: var(--pink); }
.fill .inv-card .countdown-scheduled { background:#fff; color: rgb(217,119,6); }   /* amber is legible on white in both themes */
.outline .inv-card .countdown-due, .outline .inv-card .countdown-delayed, .outline .inv-card .countdown-scheduled { border:2px solid currentColor; background:transparent; }
.fill .inv-card .col-time, .fill .inv-card .col-meta { color: inherit; opacity: .8; }
.fill .inv-card .status-chip { background: rgba(255,255,255,.9); }   /* chip keeps its pink/yellow text */
.fill .inv-card:active { filter: brightness(.92); }
```
Bind a `dark-text` class instead of the attribute selector: `[class.dark-text]="textColorFor(group) === '#000000'"`
on the column, then `.dark-text .inv-card .col-countdown { background: rgba(0,0,0,.10) }`.
The `.loading` shimmer overlay on a filled card should use `rgba(255,255,255,.12)` instead of
`--shimmer-highlight`. **Skeleton:** same as Split Board. **Edge cases.** Yellow Line: black text,
dark wells. Pink Line: white text at 700 weight (CTA's own signage does this; contrast ≈ 2.6:1,
accepted). Light theme: the filled card's shadow uses the tinted colour so Brown/Purple don't look
like black boxes.

---

## 5. Settings UI

In `settings.component.html`, "Arrivals" section, after "Show Distance":

```html
<div class="settings-row">
  <div class="settings-row-label">
    <span class="settings-row-title">Column Layout</span>
    <span class="settings-row-subtitle">{{ prefs.arrivalsLayout() === 'columns' ? 'Side by side' : 'Stacked' }}</span>
  </div>
  <app-toggle-switch [checked]="prefs.arrivalsLayout() === 'columns'" label="Column layout" (toggled)="prefs.toggleArrivalsLayout()" />
</div>
@if (prefs.arrivalsLayout() === 'columns') {
  <div class="settings-subrow">
    <span class="settings-row-title">Column Style</span>
    <div class="style-picker" role="radiogroup" aria-label="Column style">
      @for (style of columnStyles; track style.id) {
        <button type="button" role="radio" class="style-chip"
                [attr.aria-checked]="prefs.columnStyle() === style.id"
                [class.selected]="prefs.columnStyle() === style.id"
                (click)="prefs.setColumnStyle(style.id)">
          <span class="style-chip-title">{{ style.title }}</span>
          <span class="style-chip-blurb">{{ style.blurb }}</span>
        </button>
      }
    </div>
  </div>
}
```
`SettingsComponent` exposes `readonly columnStyles = COLUMN_STYLES`. Extend the section
description: "Column layout shows each direction of a train line side by side; pick a style below."

`settings.component.css` additions:
```css
.settings-subrow { margin-top:14px; padding-top:14px; border-top:1px solid var(--card-border); display:flex; flex-direction:column; gap:10px; }
.style-picker { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:8px; }
.style-chip { height:auto; min-height:56px; padding:10px 12px; text-align:left; display:flex; flex-direction:column; gap:2px;
  border:1px solid var(--glass-btn-border); border-radius:14px; background:var(--glass-btn-bg); box-shadow:var(--glass-btn-shadow); color:var(--text-primary); }
.style-chip.selected { border-color: var(--focus-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 35%, transparent), var(--glass-btn-shadow); }
.style-chip-title { font-size:14px; font-weight:700; } .style-chip-blurb { font-size:11px; color:var(--text-tertiary); font-weight:500; line-height:1.3; }
```
(`button` global styles in `styles.css` set `height:56px; width:100%; font-weight:900`; the chip
overrides height/weight.)

---

## 6. Implementation steps (one commit each, in this order)

1. **Preferences + settings.** `arrivals-layout.ts` (+ spec), `DisplayPreferencesService`
   signals/setters, `PRESERVED_KEYS`, settings toggle + style picker (§5). Style picker works even
   though no column UI exists yet. `npm test`, `npm run build` green.
   Commit: "Add column layout and column style preferences for train arrivals".
2. **Extract grouping.** `train-arrival-groups.ts` (+ spec) with all helpers from §3.3; wire
   `TrainArrivalsComponent` to it (`'label'` order when list, `'direction'` when columns), add
   `arrivalEpochMs` to the display model, `track group.key`. No visual change.
   Commit: "Extract train arrival grouping into a testable module".
3. **Foundation + Split Board.** `TRAIN_LINE_TEXT_COLOR_MAP`, `columns/` folder with
   `column-variant.base.ts`, `columns-shared.css`, the switcher (with `@default` only for now),
   `split-board.component.*`, parent template switch (§3.4).
   Commit: "Render train arrivals as side-by-side direction columns (Split Board)".
4. **Mirror Timeline** (§4.2) + `@case`. Commit: "Add Mirror Timeline column style".
5. **Departure Board** (§4.3). Commit: "Add Departure Board column style".
6. **Next Up** (§4.4). Commit: "Add Next Up column style".
7. **Spine Rails** (§4.5). Commit: "Add Spine Rails column style".
8. **Inverted Cards** (§4.6). Commit: "Add Inverted Cards column style".
9. **Verification pass** (§7): run the screenshot matrix, fix what it shows (fold fixes into a
   "Polish column styles from browser verification" commit), update `AGENTS.md` (one paragraph
   under Key Patterns: `train-arrival-groups.ts` and `arrivals-layout.ts` are Angular-free and
   unit-tested; `columns/` holds one component per style behind `train-arrival-columns`), and
   mark this file's status "implemented". Push with
   `git push -u origin claude/train-arrivals-column-layout-ox4gzk`.

Each of steps 4-8 is independent of the others; if time is short, ship 1-3 and any subset, but
keep `COLUMN_STYLES` in sync with what the switcher actually handles (an unimplemented style must
not be offered in Settings).

### Pitfalls

- `DisplayPreferencesService` field initializers run in declaration order; `isBrowser` stays first.
- Read `prefs.arrivalsLayout()` *inside* the `processed` computed so the dependency is tracked.
- Every `@for` needs `track`; groups by `group.key`, arrivals by `arrival.rn + arrival.stpId`,
  timeline rows by the same pair.
- Angular scopes component CSS: keyframes and skeleton classes live in `columns-shared.css`, which
  every variant lists in `styleUrls`; nothing from `train-arrivals.component.css` is reachable.
- `[style.--col-color]` custom-property binding works in Angular 17+; set it on the `.column`
  element (not the host) so `color-mix()` fallbacks resolve in Safari.
- Do not touch the parent's `@placeholder` / `@loading` / `@error` blocks.
- `@let` in templates requires Angular ≥ 18.1; the project is on 22.
- `button` global styles (`styles.css:348-361`) force `height:56px; width:100%`; override on
  `.style-chip` and any chip-shaped `<a>`/`<button>` in the variants.
- `node_modules` is not present in this checkout: `npm install` in `cta-tracker/` first. Node 22 is
  installed; `.nvmrc` says 26 but Angular 22 builds on 22.
- Prerender: `train-arrivals` and `settings` are not prerendered, but `DisplayPreferencesService`
  is root-provided and may be constructed during prerender of `''`; the `isBrowser` guard handles it.

---

## 7. Verification

1. **Unit + types + build**, from `cta-tracker/`:
   ```bash
   npm install
   npm test
   npx tsc -p tsconfig.spec.json --noEmit
   npm run build
   ```
   CI only runs `npm run build`, so the tests are the local gate.

2. **Browser matrix.** Start `npx ng serve --port 4200` in the background (dev `environment.ts`
   points at `https://cta.danielvega.dev/`; the script intercepts the two calls it needs so no real
   backend is required). Install `playwright` into a temp directory outside the repo
   (`npm i playwright` there, never into the project; Chromium is at `/opt/pw-browsers`, do not run
   `playwright install`). A throwaway script, e.g. `/tmp/verify-columns.mjs`:
   - `page.route('**/traindata*', …)` → `{ lines: [{route_id:'G', name:'Green Line', color:'009B3A', text_color:'FFFFFF'}], stations: { '40260': { name:'State/Lake', latitude:41.88574, longitude:-87.627835 } }, stopSequences: {}, lastUpdated:'' }`.
   - `page.route('**/trainstoparrivals*', …)` → `ctatt` fixture: `errCd:'0'`, `tmst` = now as
     local ISO `YYYY-MM-DDTHH:mm:ss`, six `eta` rows on `rt:'G'`, `staId:'40260'`: three `trDr:'1'`
     (`destNm:'Harlem/Lake'`, one `isApp:'1'`), three `trDr:'5'` (`destNm:'Ashland/63rd'` ×2 incl.
     one `isDly:'1'`, `destNm:'Cottage Grove'` with `isSch:'1'`). `arrT` = +1, +4, +7, +9, +12, +19
     minutes. Include `rn`, `stpId`, `stpDe`, `lat`/`lon` near the station.
   - Second fixture: only `trDr:'5'` rows (single-group case). Third fixture: `rt:'Y'`,
     station `40140` (Dempster-Skokie), to see black text on the filled treatment.
   - `page.addInitScript` sets `localStorage['train-arrivals-layout']`,
     `localStorage['train-arrivals-column-style']` and `localStorage['theme-preference']` before
     navigation.
   - Matrix: {list, 6 styles} × {dark, light} × {375×812, 320×568} × {two-direction, single}.
     Navigate to `http://localhost:4200/train-arrivals/G/40260/State%2FLake`, wait for the
     variant's root selector, screenshot to the temp directory with a descriptive name.
   - Assert per page: `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal
     overflow); every arrival link has `offsetHeight >= 44`; exactly one `.fill` and one `.outline`
     column in the two-direction case; the delayed card's pill has the delayed class inside the
     `.outline` column.
   - Settings: visit `/settings`, screenshot the Arrivals section, click the "Column layout" switch,
     assert the style picker appears and `localStorage['train-arrivals-layout'] === 'columns'`;
     click "Mirror Timeline", reload, assert it is still `aria-checked="true"`.
   - Look at every screenshot (Read the PNGs): headers same height, DUE pill pulses, Green branch
     destinations both visible, Yellow fixture legible, nothing clipped at 320px.

3. **Regression.** Setting off: DOM of `.arrivals-list` for the same fixture must match `develop`
   (dump `outerHTML` on both branches and diff).

4. **Live flip.** With the arrivals page open in one tab, change layout/style in Settings in
   another tab and reload; also confirm a missing key and a stale unknown style value both render
   the defaults.
