import { describe, expect, it } from 'vitest';
import {
  ALERT_STYLES, DEFAULT_ALERT_STYLE, alertWindow, nextTickerIndex, parseAlertStyle,
  summarizeAlerts, toastKey, toneOf
} from './alert-styles';
import { ServiceAlert } from './alert-model';

function alert(overrides: Partial<ServiceAlert>): ServiceAlert {
  return {
    id: '1', headline: 'Headline', shortDescription: '', fullHtml: '', url: null, impact: '',
    severity: 0, major: false, start: null, end: null, tbd: false, services: [],
    ...overrides
  };
}

describe('ALERT_STYLES', () => {
  it('offers six styles, the default first', () => {
    expect(ALERT_STYLES.map(s => s.id)).toEqual(['ticker', 'card', 'capsule', 'margin-note', 'counter', 'toast']);
    expect(ALERT_STYLES[0].id).toBe(DEFAULT_ALERT_STYLE);
  });

  it('gives every style a title and a blurb', () => {
    for (const style of ALERT_STYLES) {
      expect(style.title.length).toBeGreaterThan(0);
      expect(style.blurb.length).toBeGreaterThan(0);
    }
  });
});

describe('parseAlertStyle', () => {
  it('round-trips every style the picker offers', () => {
    for (const style of ALERT_STYLES) {
      expect(parseAlertStyle(style.id)).toBe(style.id);
    }
  });

  it('defaults to the ticker when nothing is stored', () => {
    expect(DEFAULT_ALERT_STYLE).toBe('ticker');
    expect(parseAlertStyle(null)).toBe('ticker');
    expect(parseAlertStyle(undefined)).toBe('ticker');
    expect(parseAlertStyle('')).toBe('ticker');
  });

  it('falls back on unknown or mis-cased values', () => {
    expect(parseAlertStyle('beacon')).toBe('ticker');
    expect(parseAlertStyle('Counter')).toBe('ticker');
  });
});

describe('toneOf', () => {
  it('is major for a major alert whatever its score', () => {
    expect(toneOf(alert({ major: true, severity: 5 }))).toBe('major');
  });

  it('is service from severity 20 up', () => {
    expect(toneOf(alert({ severity: 20 }))).toBe('service');
    expect(toneOf(alert({ severity: 55 }))).toBe('service');
  });

  it('is note below 20', () => {
    expect(toneOf(alert({ severity: 19 }))).toBe('note');
    expect(toneOf(alert({ severity: 0 }))).toBe('note');
  });
});

describe('summarizeAlerts', () => {
  it('is null when there is nothing to show', () => {
    expect(summarizeAlerts([])).toBeNull();
  });

  it('leads with the most severe alert and takes its tone', () => {
    const note = alert({ id: 'note', severity: 9 });
    const change = alert({ id: 'change', severity: 20 });
    const major = alert({ id: 'major', severity: 30, major: true });

    const summary = summarizeAlerts([note, change, major])!;
    expect(summary.lead.id).toBe('major');
    expect(summary.tone).toBe('major');
    expect(summary.count).toBe(3);
    expect(summary.prominent.map(a => a.id)).toEqual(['major', 'change']);
    expect(summary.minor.map(a => a.id)).toEqual(['note']);
    expect(summary.ordered.map(a => a.id)).toEqual(['major', 'change', 'note']);
  });

  it('is a note summary when only notes are active', () => {
    const summary = summarizeAlerts([alert({ id: 'a', severity: 5 }), alert({ id: 'b', severity: 12 })])!;
    expect(summary.tone).toBe('note');
    expect(summary.lead.id).toBe('b');
    expect(summary.prominent).toEqual([]);
  });
});

describe('alertWindow', () => {
  const now = new Date(2026, 9, 1, 12, 0);

  it('shows the end date, with the time when it is not midnight', () => {
    expect(alertWindow(alert({ end: new Date(2026, 9, 16, 4, 0) }), now)).toBe('Until Oct 16, 4:00 AM');
    expect(alertWindow(alert({ end: new Date(2026, 9, 9, 18, 30) }), now)).toBe('Until Oct 9, 6:30 PM');
  });

  it('drops a midnight end time', () => {
    expect(alertWindow(alert({ end: new Date(2026, 11, 29) }), now)).toBe('Until Dec 29');
  });

  it('shows the start date of an open-ended alert', () => {
    expect(alertWindow(alert({ start: new Date(2026, 8, 22, 8, 16), tbd: true }), now)).toBe('Since Sep 22');
  });

  it('ignores the end of an alert whose end is still to be determined', () => {
    expect(alertWindow(alert({ start: new Date(2026, 8, 22), end: new Date(2026, 9, 9), tbd: true }), now))
      .toBe('Since Sep 22');
  });

  it('says when a future alert starts', () => {
    expect(alertWindow(alert({ start: new Date(2026, 9, 12, 22, 0) }), now)).toBe('Starts Oct 12, 10:00 PM');
  });

  it('says "Ongoing" when CTA gives no dates', () => {
    expect(alertWindow(alert({}), now)).toBe('Ongoing');
  });

  it('writes noon and midnight-hour times in 12-hour form', () => {
    expect(alertWindow(alert({ end: new Date(2026, 9, 9, 12, 5) }), now)).toBe('Until Oct 9, 12:05 PM');
    expect(alertWindow(alert({ end: new Date(2026, 9, 9, 0, 45) }), now)).toBe('Until Oct 9, 12:45 AM');
  });
});

describe('nextTickerIndex', () => {
  it('advances and wraps', () => {
    expect(nextTickerIndex(0, 3)).toBe(1);
    expect(nextTickerIndex(2, 3)).toBe(0);
  });

  it('stays at 0 with one or no alerts, and recovers from an index past the end', () => {
    expect(nextTickerIndex(0, 1)).toBe(0);
    expect(nextTickerIndex(0, 0)).toBe(0);
    expect(nextTickerIndex(7, 3)).toBe(0);
  });
});

describe('toastKey', () => {
  it('is the same for the same set of alerts in any order', () => {
    expect(toastKey([alert({ id: 'b' }), alert({ id: 'a' })])).toBe(toastKey([alert({ id: 'a' }), alert({ id: 'b' })]));
  });

  it('changes when a new alert appears', () => {
    expect(toastKey([alert({ id: 'a' })])).not.toBe(toastKey([alert({ id: 'a' }), alert({ id: 'c' })]));
  });
});
