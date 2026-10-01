// How the arrivals screens draw their service alerts, and the bits of wording every style shares.
// Angular-free so it is unit-testable; DisplayPreferencesService owns the signal and storage.

import { MINOR_SEVERITY, ServiceAlert, partitionBySeverity, sortBySeverity } from './alert-model';

export const ARRIVALS_ALERT_STYLE_KEY = 'arrivals-alert-style';
/** The set of alerts the rider last dismissed a Toast for, as `toastKey` wrote it. */
export const TOAST_DISMISSED_KEY = 'arrivals-alert-toast-dismissed';

export type AlertStyle = 'ticker' | 'card' | 'capsule' | 'margin-note' | 'counter' | 'toast';

export const DEFAULT_ALERT_STYLE: AlertStyle = 'ticker';

/**
 * The Settings picker's source of truth, in the order it shows them. Keep it in sync with the
 * switcher in `alerts-banner`: a style listed here but not handled there renders the default.
 */
export const ALERT_STYLES: ReadonlyArray<{ id: AlertStyle; title: string; blurb: string }> = [
  { id: 'ticker',      title: 'Ticker',      blurb: 'One quiet line. Headlines take turns.' },
  { id: 'card',        title: 'Card',        blurb: 'Grouped rows with a severity rail.' },
  { id: 'capsule',     title: 'Capsule',     blurb: 'A black pill that opens into a panel.' },
  { id: 'margin-note', title: 'Margin Note', blurb: 'No box. An editorial note in serif.' },
  { id: 'counter',     title: 'Counter',     blurb: 'A count by the stop name. Tap for details.' },
  { id: 'toast',       title: 'Toast',       blurb: 'Drops in from the top, then tucks away.' }
];

export function parseAlertStyle(raw: string | null | undefined): AlertStyle {
  return ALERT_STYLES.some(style => style.id === raw) ? raw as AlertStyle : DEFAULT_ALERT_STYLE;
}

/** `major` is CTA's MajorAlert flag; `note` is everything below MINOR_SEVERITY (elevators, stop moves). */
export type AlertTone = 'major' | 'service' | 'note';

export function toneOf(alert: ServiceAlert): AlertTone {
  if (alert.major) {
    return 'major';
  }
  return alert.severity >= MINOR_SEVERITY ? 'service' : 'note';
}

export interface AlertSummary {
  /** The most severe alert; every collapsed style shows this one. */
  lead: ServiceAlert;
  tone: AlertTone;
  count: number;
  /** All of them, most severe first. */
  ordered: ServiceAlert[];
  prominent: ServiceAlert[];
  minor: ServiceAlert[];
}

export function summarizeAlerts(alerts: ServiceAlert[]): AlertSummary | null {
  if (alerts.length === 0) {
    return null;
  }
  const ordered = sortBySeverity(alerts);
  const { prominent, minor } = partitionBySeverity(ordered);
  return { lead: ordered[0], tone: toneOf(ordered[0]), count: ordered.length, ordered, prominent, minor };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** A midnight time is CTA's way of saying "the whole day", so it is left off. */
function formatMoment(date: Date): string {
  if (date.getHours() === 0 && date.getMinutes() === 0) {
    return formatDay(date);
  }
  const hour = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDay(date)}, ${hour}:${minutes} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** When the alert applies, in a few words: "Until Oct 9", "Since Sep 22", "Starts Oct 12, 10:00 PM". */
export function alertWindow(alert: ServiceAlert, now: Date): string {
  if (alert.start && alert.start.getTime() > now.getTime()) {
    return `Starts ${formatMoment(alert.start)}`;
  }
  if (alert.end && !alert.tbd) {
    return `Until ${formatMoment(alert.end)}`;
  }
  if (alert.start) {
    return `Since ${formatDay(alert.start)}`;
  }
  return 'Ongoing';
}

export function nextTickerIndex(index: number, count: number): number {
  // An index past the end means the list shrank under the ticker; start over rather than skip.
  return index + 1 < count ? index + 1 : 0;
}

/** Identifies a set of alerts regardless of order, so dismissing a Toast holds until one changes. */
export function toastKey(alerts: ServiceAlert[]): string {
  return alerts.map(a => a.id).sort().join(',');
}
