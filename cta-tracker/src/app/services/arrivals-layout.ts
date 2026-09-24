/**
 * How the train arrivals screen lays out its direction groups.
 *
 * Angular-free so the parsing is unit-testable without a TestBed; `DisplayPreferencesService`
 * owns the signals and the localStorage round-trip.
 */

export const TRAIN_ARRIVALS_LAYOUT_KEY = 'train-arrivals-layout';
export const TRAIN_ARRIVALS_COLUMN_STYLE_KEY = 'train-arrivals-column-style';
/** The lines whose two directions the rider has swapped, as a JSON array of route ids. */
export const TRAIN_ARRIVALS_SWAPPED_LINES_KEY = 'train-arrivals-swapped-lines';

/**
 * `'list'` is the stacked cards; `'columns'` puts each direction in its own column, drawn in one
 * of the column styles below; `'approach'` draws the line itself, with the station in the middle
 * and each direction's trains closing in from its own side.
 */
export type ArrivalsLayout = 'list' | 'columns' | 'approach';

export const DEFAULT_ARRIVALS_LAYOUT: ArrivalsLayout = 'list';

/** The layout picker's source of truth, in the order Settings shows them. */
export const ARRIVALS_LAYOUTS: ReadonlyArray<{ id: ArrivalsLayout; title: string; blurb: string }> = [
  { id: 'list',     title: 'Stacked',  blurb: 'One card per train, directions one above the other.' },
  { id: 'columns',  title: 'Columns',  blurb: 'Each direction side by side, in the style below.' },
  { id: 'approach', title: 'Approach', blurb: 'The line itself, with trains closing in on your station.' }
];

/** Which of the column treatments renders when the layout is `'columns'`. */
export type ColumnStyle =
  | 'platform-led' | 'typographic' | 'solari'
  | 'sentence' | 'headway' | 'pocket-lcd';

export const DEFAULT_COLUMN_STYLE: ColumnStyle = 'platform-led';

/**
 * The style picker's source of truth. Keep it in sync with what the switcher actually handles —
 * offering a style nothing renders would silently fall back to the default.
 */
export const COLUMN_STYLES: ReadonlyArray<{ id: ColumnStyle; title: string; blurb: string }> = [
  { id: 'platform-led', title: 'Platform LED', blurb: 'The amber dot-matrix sign on a CTA platform.' },
  { id: 'typographic',  title: 'Typographic',  blurb: 'No boxes. Big numerals and whitespace.' },
  { id: 'solari',       title: 'Solari',       blurb: 'A departure board in SF Mono, 24-hour times.' },
  { id: 'sentence',     title: 'Sentence',     blurb: 'Arrivals written as a line of prose.' },
  { id: 'headway',      title: 'Headway',      blurb: 'A countdown, and how far apart the trains are.' },
  { id: 'pocket-lcd',   title: 'Pocket LCD',   blurb: 'A 90s watch face. Dark mode lights the Indiglo.' }
];

/** An unknown value — stale, corrupt, or from another build — falls back to the default. */
export function parseArrivalsLayout(raw: string | null | undefined): ArrivalsLayout {
  return ARRIVALS_LAYOUTS.some(layout => layout.id === raw)
    ? raw as ArrivalsLayout
    : DEFAULT_ARRIVALS_LAYOUT;
}

/**
 * An unknown style falls back to the default. That includes the six styles earlier builds offered
 * (Split Board, Mirror Timeline and the rest), so a rider who picked one of those lands on the
 * default rather than on nothing.
 */
export function parseColumnStyle(raw: string | null | undefined): ColumnStyle {
  return COLUMN_STYLES.some(style => style.id === raw)
    ? raw as ColumnStyle
    : DEFAULT_COLUMN_STYLE;
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
