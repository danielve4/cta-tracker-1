/**
 * How the train arrivals screen lays out its direction groups.
 *
 * Angular-free so the parsing is unit-testable without a TestBed; `DisplayPreferencesService`
 * owns the signals and the localStorage round-trip.
 */

export const TRAIN_ARRIVALS_LAYOUT_KEY = 'train-arrivals-layout';
export const TRAIN_ARRIVALS_COLUMN_STYLE_KEY = 'train-arrivals-column-style';
/** The lines whose two columns the rider has swapped, as a JSON array of route ids. */
export const TRAIN_ARRIVALS_SWAPPED_LINES_KEY = 'train-arrivals-swapped-lines';

/** `'list'` is today's stacked cards; `'columns'` puts each direction in its own column. */
export type ArrivalsLayout = 'list' | 'columns';

export const DEFAULT_ARRIVALS_LAYOUT: ArrivalsLayout = 'list';

/** Which of the six column treatments renders when the layout is `'columns'`. */
export type ColumnStyle =
  | 'split-board' | 'mirror-timeline' | 'departure-board'
  | 'next-up' | 'spine-rails' | 'inverted-cards';

export const DEFAULT_COLUMN_STYLE: ColumnStyle = 'split-board';

/**
 * The style picker's source of truth. Keep it in sync with what the switcher actually handles —
 * offering a style nothing renders would silently fall back to the default.
 */
export const COLUMN_STYLES: ReadonlyArray<{ id: ColumnStyle; title: string; blurb: string }> = [
  { id: 'split-board',     title: 'Split Board',     blurb: 'Filled vs outlined direction pills, compact cards.' },
  { id: 'mirror-timeline', title: 'Mirror Timeline', blurb: 'Both directions on one shared time spine.' },
  { id: 'departure-board', title: 'Departure Board', blurb: 'Dense station-sign rows, most trains on screen.' },
  { id: 'next-up',         title: 'Next Up',         blurb: 'Big next train per direction, later ones as chips.' },
  { id: 'spine-rails',     title: 'Spine Rails',     blurb: 'Direction label as a vertical rail on the outer edge.' },
  { id: 'inverted-cards',  title: 'Inverted Cards',  blurb: 'Whole cards in line colour on one side, inverted on the other.' }
];

/** Only an exact `'columns'` opts in, so a stale or corrupt value falls back to today's layout. */
export function parseArrivalsLayout(raw: string | null | undefined): ArrivalsLayout {
  return raw === 'columns' ? 'columns' : DEFAULT_ARRIVALS_LAYOUT;
}

/** An unknown style — a value from a build that offered more of them — falls back to the default. */
export function parseColumnStyle(raw: string | null | undefined): ColumnStyle {
  return COLUMN_STYLES.some(style => style.id === raw)
    ? raw as ColumnStyle
    : DEFAULT_COLUMN_STYLE;
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
