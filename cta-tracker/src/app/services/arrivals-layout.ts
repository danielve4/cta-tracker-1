/**
 * How the train arrivals screen lays out its direction groups.
 *
 * Angular-free so the parsing is unit-testable without a TestBed; `DisplayPreferencesService`
 * owns the signals and the localStorage round-trip.
 */

export const TRAIN_ARRIVALS_LAYOUT_KEY = 'train-arrivals-layout';
export const TRAIN_ARRIVALS_COLUMN_STYLE_KEY = 'train-arrivals-column-style';
export const TRAIN_ARRIVALS_DEPTH_STYLE_KEY = 'train-arrivals-depth-style';
/** The lines whose two directions the rider has swapped, as a JSON array of route ids. */
export const TRAIN_ARRIVALS_SWAPPED_LINES_KEY = 'train-arrivals-swapped-lines';

/**
 * `'list'` is the stacked cards; `'columns'` puts each direction in its own column, drawn in one
 * of the column styles below; `'approach'` draws the line itself, with the station in the middle
 * and each direction's trains closing in from its own side; `'depth'` draws the arrivals in 3D, in
 * one of the depth styles below.
 */
export type ArrivalsLayout = 'list' | 'columns' | 'approach' | 'depth';

export const DEFAULT_ARRIVALS_LAYOUT: ArrivalsLayout = 'list';

/** The layout picker's source of truth, in the order Settings shows them. */
export const ARRIVALS_LAYOUTS: ReadonlyArray<{ id: ArrivalsLayout; title: string; blurb: string }> = [
  { id: 'list',     title: 'Stacked',  blurb: 'One card per train, directions one above the other.' },
  { id: 'columns',  title: 'Columns',  blurb: 'Each direction side by side, in the style below.' },
  { id: 'approach', title: 'Approach', blurb: 'The line itself, with trains closing in on your station.' },
  { id: 'depth',    title: '3D',       blurb: 'Trains in space, in the 3D style below.' }
];

/** Which of the column treatments renders when the layout is `'columns'`. */
export type ColumnStyle =
  | 'platform-led' | 'typographic' | 'solari'
  | 'flip-clock' | 'headway' | 'pocket-lcd';

export const DEFAULT_COLUMN_STYLE: ColumnStyle = 'platform-led';

/**
 * The style picker's source of truth. Keep it in sync with what the switcher actually handles —
 * offering a style nothing renders would silently fall back to the default.
 */
export const COLUMN_STYLES: ReadonlyArray<{ id: ColumnStyle; title: string; blurb: string }> = [
  { id: 'platform-led', title: 'Platform LED', blurb: 'A dot-matrix platform sign, lit in the line colour.' },
  { id: 'typographic',  title: 'Typographic',  blurb: 'No boxes. Big numerals and whitespace.' },
  { id: 'solari',       title: 'Solari',       blurb: 'A departure board in SF Mono, 24-hour times.' },
  { id: 'flip-clock',   title: 'Flip Clock',   blurb: 'Split-flap digits that flip as the minutes tick down.' },
  { id: 'headway',      title: 'Headway',      blurb: 'A countdown, and how far apart the trains are.' },
  { id: 'pocket-lcd',   title: 'Pocket LCD',   blurb: 'A 90s watch face. Dark mode lights the Indiglo.' }
];

/** Which of the 3D treatments renders when the layout is `'depth'`. */
export type DepthStyle = 'tunnel' | 'diorama' | 'cover-flow' | 'time-stack' | 'neon-skyline' | 'holo-card';

export const DEFAULT_DEPTH_STYLE: DepthStyle = 'tunnel';

/** The 3D picker's source of truth. Same rule as COLUMN_STYLES: only list what the switcher renders. */
export const DEPTH_STYLES: ReadonlyArray<{ id: DepthStyle; title: string; blurb: string }> = [
  { id: 'tunnel',     title: 'Tunnel',     blurb: 'Down the subway tunnel, headlights getting closer.' },
  { id: 'diorama',    title: 'Diorama',    blurb: 'A tiny elevated L. Drag, or tilt your phone, to look around.' },
  { id: 'cover-flow', title: 'Cover Flow', blurb: 'Swipe through glass cards, one per train.' },
  { id: 'time-stack', title: 'Time Stack', blurb: 'Later trains stacked deeper, spaced by the minutes between them.' },
  { id: 'neon-skyline', title: 'Neon Skyline', blurb: 'Synthwave. Neon trains racing in from the skyline.' },
  { id: 'holo-card',  title: 'Holo Card',  blurb: 'The next train on a holographic card that tilts in the light.' }
];

/** An unknown value — stale, corrupt, or from another build — falls back to the default. */
export function parseArrivalsLayout(raw: string | null | undefined): ArrivalsLayout {
  return ARRIVALS_LAYOUTS.some(layout => layout.id === raw)
    ? raw as ArrivalsLayout
    : DEFAULT_ARRIVALS_LAYOUT;
}

/**
 * An unknown style falls back to the default. That includes every style an earlier build offered
 * (Split Board, Mirror Timeline, Sentence and the rest), so a rider who picked one of those lands
 * on the default rather than on nothing.
 */
export function parseColumnStyle(raw: string | null | undefined): ColumnStyle {
  return COLUMN_STYLES.some(style => style.id === raw)
    ? raw as ColumnStyle
    : DEFAULT_COLUMN_STYLE;
}

/** An unknown 3D style falls back to the default, like `parseColumnStyle`. */
export function parseDepthStyle(raw: string | null | undefined): DepthStyle {
  return DEPTH_STYLES.some(style => style.id === raw)
    ? raw as DepthStyle
    : DEFAULT_DEPTH_STYLE;
}

/** Only `'list'` keeps the A-Z order; every other layout places each direction on a fixed side. */
export function isSideBySide(layout: ArrivalsLayout): boolean {
  return layout !== 'list';
}

/**
 * Only a JSON array counts, and only its string entries: a corrupt value swaps nothing, so every
 * line falls back to the default `'1'`-left order.
 */
export function parseSwappedLines(raw: string | null | undefined): ReadonlySet<string> {
  if (!raw) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((route): route is string => typeof route === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}
