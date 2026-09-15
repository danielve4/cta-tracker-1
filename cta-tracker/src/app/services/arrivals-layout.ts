/**
 * How the train arrivals screen lays out its direction groups.
 *
 * Angular-free so the parsing is unit-testable without a TestBed; `DisplayPreferencesService`
 * owns the signal and the localStorage round-trip.
 */

export const TRAIN_ARRIVALS_LAYOUT_KEY = 'train-arrivals-layout';

/** `'list'` is today's stacked cards; `'columns'` is the side-by-side Split Board. */
export type ArrivalsLayout = 'list' | 'columns';

export const DEFAULT_ARRIVALS_LAYOUT: ArrivalsLayout = 'list';

/** Only an exact `'columns'` opts in, so a stale or corrupt value falls back to today's layout. */
export function parseArrivalsLayout(raw: string | null | undefined): ArrivalsLayout {
  return raw === 'columns' ? 'columns' : DEFAULT_ARRIVALS_LAYOUT;
}
