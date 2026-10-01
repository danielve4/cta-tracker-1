import { describe, expect, it } from 'vitest';
import {
  AlertsError, CtaAlertsResponse, RawAlert, ServiceAlert, alertsForMode, alertsForTrainStation,
  matchesSearch, normalizeAlerts, partitionBySeverity, sortBySeverity
} from './alert-model';

// Trimmed from live responses captured 2026-09-30.
const ELEVATOR_69TH: RawAlert = {
  AlertId: '117610',
  Headline: 'Elevator at 69th Temporarily Out-of-Service',
  ShortDescription: 'The elevator at 69th (Red Line) is temporarily out-of-service.',
  FullDescription: { '#cdata-section': '<p>The elevator at 69th (Red Line) is temporarily out-of-service.</p>\r\n' },
  SeverityScore: '5',
  SeverityColor: '000000',
  SeverityCSS: 'special-note',
  Impact: 'Elevator Status',
  EventStart: '2026-09-22T08:16:00',
  EventEnd: null,
  TBD: '1',
  MajorAlert: '0',
  AlertURL: { '#cdata-section': 'http://www.transitchicago.com/travel_information/alert_detail.aspx?AlertId=117610' },
  ImpactedService: {
    Service: [
      { ServiceType: 'T', ServiceTypeDescription: 'Train Station', ServiceName: '69th', ServiceId: '40990',
        ServiceBackColor: 'c60c30', ServiceTextColor: 'ffffff' },
      { ServiceType: 'R', ServiceTypeDescription: 'Train Route', ServiceName: 'Red Line', ServiceId: 'Red',
        ServiceBackColor: 'c60c30', ServiceTextColor: 'ffffff' }
    ]
  }
};

// A single impacted service arrives as an object, not a one-element array.
const BUS_73_REROUTE: RawAlert = {
  AlertId: '110280',
  Headline: 'Temporary Reroute',
  ShortDescription: '#73 Armitage buses are temporarily rerouted.',
  FullDescription: { '#cdata-section': '<p>Reroute.</p>' },
  SeverityScore: '37',
  Impact: 'Planned Reroute',
  EventStart: '2026-09-01T05:00:00',
  EventEnd: '2026-10-15T23:59:00',
  TBD: '0',
  MajorAlert: '0',
  AlertURL: { '#cdata-section': 'http://www.transitchicago.com/travel_information/alert_detail.aspx?AlertId=110280' },
  ImpactedService: {
    Service: { ServiceType: 'B', ServiceTypeDescription: 'Bus Route', ServiceName: 'Armitage', ServiceId: '73',
      ServiceBackColor: '565a5c', ServiceTextColor: 'ffffff' }
  }
};

// Line-wide: names several routes and no station. EventStart is date-only.
const STATE_LAKE_CLOSURE: RawAlert = {
  AlertId: '112148',
  Headline: 'State/Lake Elevated Station Temporary Closure',
  ShortDescription: 'The State/Lake Loop Elevated station is closed for reconstruction into 2029.',
  FullDescription: { '#cdata-section': '<p>Closed.</p>' },
  SeverityScore: '12',
  Impact: 'Special Note',
  EventStart: '2026-01-05',
  EventEnd: null,
  TBD: '1',
  MajorAlert: '0',
  AlertURL: { '#cdata-section': 'http://www.transitchicago.com/travel_information/alert_detail.aspx?AlertId=112148' },
  ImpactedService: {
    Service: [
      { ServiceType: 'R', ServiceName: 'Brown Line', ServiceId: 'Brn', ServiceBackColor: '62361b', ServiceTextColor: 'ffffff' },
      { ServiceType: 'R', ServiceName: 'Green Line', ServiceId: 'G', ServiceBackColor: '009b3a', ServiceTextColor: 'FFFFFF' }
    ]
  }
};

function response(alerts: RawAlert[] | RawAlert | undefined, errorCode = '0', errorMessage: string | null = null): CtaAlertsResponse {
  return {
    CTAAlerts: {
      TimeStamp: '2026-09-30T21:44:44',
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
      ...(alerts === undefined ? {} : { Alert: alerts })
    }
  };
}

function alert(overrides: Partial<ServiceAlert>): ServiceAlert {
  return {
    id: '1', headline: 'Headline', shortDescription: '', fullHtml: '', url: null, impact: '',
    severity: 0, major: false, start: null, end: null, tbd: false, services: [],
    ...overrides
  };
}

describe('normalizeAlerts', () => {
  it('maps every field of a CTA alert', () => {
    const [result] = normalizeAlerts(response([ELEVATOR_69TH]));

    expect(result).toEqual({
      id: '117610',
      headline: 'Elevator at 69th Temporarily Out-of-Service',
      shortDescription: 'The elevator at 69th (Red Line) is temporarily out-of-service.',
      fullHtml: '<p>The elevator at 69th (Red Line) is temporarily out-of-service.</p>\r\n',
      url: 'https://www.transitchicago.com/travel_information/alert_detail.aspx?AlertId=117610',
      impact: 'Elevator Status',
      severity: 5,
      major: false,
      start: new Date(2026, 8, 22, 8, 16, 0),
      end: null,
      tbd: true,
      services: [
        { type: 'T', id: '40990', name: '69th', backColor: '#c60c30', textColor: '#ffffff' },
        { type: 'R', id: 'Red', name: 'Red Line', backColor: '#c60c30', textColor: '#ffffff' }
      ]
    });
  });

  it('treats ErrorCode 50 ("no active alerts") as an empty list, not an error', () => {
    const raw = response(undefined, '50', 'There are no active alerts based on your filter criteria');
    expect(normalizeAlerts(raw)).toEqual([]);
  });

  it('treats a missing Alert key with ErrorCode 0 as an empty list', () => {
    expect(normalizeAlerts(response(undefined))).toEqual([]);
  });

  it('throws an AlertsError carrying CTA\'s message for any other error code', () => {
    const raw = response(undefined, '106', "Invalid option: 'routeid' and 'stationid' parameters cannot be used together");
    expect(() => normalizeAlerts(raw)).toThrow(AlertsError);
    expect(() => normalizeAlerts(raw)).toThrow(/cannot be used together/);
  });

  it('throws when the payload is not a CTA alerts response', () => {
    expect(() => normalizeAlerts({ error: 'Unable to reach CTA services.' } as never)).toThrow(AlertsError);
    expect(() => normalizeAlerts(null as never)).toThrow(AlertsError);
  });

  it('accepts a single Alert object instead of an array', () => {
    expect(normalizeAlerts(response(ELEVATOR_69TH)).map(a => a.id)).toEqual(['117610']);
  });

  it('accepts a single Service object instead of an array', () => {
    const [result] = normalizeAlerts(response([BUS_73_REROUTE]));
    expect(result.services).toEqual([
      { type: 'B', id: '73', name: 'Armitage', backColor: '#565a5c', textColor: '#ffffff' }
    ]);
  });

  it('tolerates an alert with no impacted services', () => {
    const [result] = normalizeAlerts(response([{ ...BUS_73_REROUTE, ImpactedService: undefined }]));
    expect(result.services).toEqual([]);
  });

  it('parses end dates, and date-only starts as local midnight', () => {
    const [reroute, closure] = normalizeAlerts(response([BUS_73_REROUTE, STATE_LAKE_CLOSURE]));
    expect(reroute.end).toEqual(new Date(2026, 9, 15, 23, 59, 0));
    expect(closure.start).toEqual(new Date(2026, 0, 5));
  });

  it('turns an unparseable date into null instead of Invalid Date', () => {
    const [result] = normalizeAlerts(response([{ ...BUS_73_REROUTE, EventStart: 'soon', EventEnd: '' }]));
    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });

  it('reads MajorAlert "1" as major and a missing score as 0', () => {
    const [result] = normalizeAlerts(response([{ ...BUS_73_REROUTE, MajorAlert: '1', SeverityScore: undefined }]));
    expect(result.major).toBe(true);
    expect(result.severity).toBe(0);
  });

  it('accepts a plain-string description and URL as well as the #cdata-section wrapper', () => {
    const [result] = normalizeAlerts(response([{
      ...BUS_73_REROUTE, FullDescription: '<p>plain</p>', AlertURL: 'https://example.com/a'
    }]));
    expect(result.fullHtml).toBe('<p>plain</p>');
    expect(result.url).toBe('https://example.com/a');
  });

  it('leaves the URL null when CTA gives none', () => {
    const [result] = normalizeAlerts(response([{ ...BUS_73_REROUTE, AlertURL: undefined }]));
    expect(result.url).toBeNull();
  });

  it('falls back to neutral colours when a service has none', () => {
    const [result] = normalizeAlerts(response([{
      ...BUS_73_REROUTE,
      ImpactedService: { Service: { ServiceType: 'X', ServiceName: 'Systemwide', ServiceId: 'X' } }
    }]));
    expect(result.services[0]).toEqual({ type: 'X', id: 'X', name: 'Systemwide', backColor: null, textColor: null });
  });
});

describe('alertsForTrainStation', () => {
  const [elevator, closure] = normalizeAlerts(response([ELEVATOR_69TH, STATE_LAKE_CLOSURE]));
  const busOnly = alert({ id: 'bus', services: [{ type: 'B', id: '22', name: 'Clark', backColor: null, textColor: null }] });

  it('keeps a station alert at that station', () => {
    expect(alertsForTrainStation([elevator], 'Red', '40990')).toEqual([elevator]);
  });

  it('drops a station alert at a different station on the same line', () => {
    expect(alertsForTrainStation([elevator], 'Red', '40900')).toEqual([]);
  });

  it('keeps a line-wide alert at every station on that line', () => {
    expect(alertsForTrainStation([closure], 'Brn', '41290')).toEqual([closure]);
    expect(alertsForTrainStation([closure], 'G', '40020')).toEqual([closure]);
  });

  it('drops a line-wide alert for a different line', () => {
    expect(alertsForTrainStation([closure], 'Red', '40900')).toEqual([]);
  });

  it('drops alerts that only concern buses', () => {
    expect(alertsForTrainStation([busOnly], 'Red', '40900')).toEqual([]);
  });

  it('keeps a station alert at that station even if it names no line', () => {
    const stationOnly = alert({ services: [{ type: 'T', id: '40990', name: '69th', backColor: null, textColor: null }] });
    expect(alertsForTrainStation([stationOnly], 'Red', '40990')).toEqual([stationOnly]);
  });

  it('matches route ids case-insensitively', () => {
    expect(alertsForTrainStation([closure], 'brn', '41290')).toEqual([closure]);
  });
});

describe('sortBySeverity', () => {
  it('puts major alerts first, then higher severity, then the newest start', () => {
    const minor = alert({ id: 'minor', severity: 5 });
    const high = alert({ id: 'high', severity: 55 });
    const major = alert({ id: 'major', severity: 20, major: true });
    const older = alert({ id: 'older', severity: 37, start: new Date(2026, 0, 1) });
    const newer = alert({ id: 'newer', severity: 37, start: new Date(2026, 8, 1) });
    const undated = alert({ id: 'undated', severity: 37 });

    expect(sortBySeverity([minor, older, undated, high, newer, major]).map(a => a.id))
      .toEqual(['major', 'high', 'newer', 'older', 'undated', 'minor']);
  });

  it('does not mutate its input', () => {
    const input = [alert({ id: 'a', severity: 1 }), alert({ id: 'b', severity: 2 })];
    sortBySeverity(input);
    expect(input.map(a => a.id)).toEqual(['a', 'b']);
  });
});

describe('partitionBySeverity', () => {
  it('collapses alerts below severity 20 unless they are major', () => {
    const serviceChange = alert({ id: 'change', severity: 20 });
    const stopNote = alert({ id: 'note', severity: 19 });
    const majorNote = alert({ id: 'major', severity: 5, major: true });

    const { prominent, minor } = partitionBySeverity([serviceChange, stopNote, majorNote]);
    expect(prominent.map(a => a.id)).toEqual(['change', 'major']);
    expect(minor.map(a => a.id)).toEqual(['note']);
  });
});

describe('alertsForMode', () => {
  const train = alert({ id: 'train', services: [{ type: 'R', id: 'Red', name: 'Red Line', backColor: null, textColor: null }] });
  const station = alert({ id: 'station', services: [{ type: 'T', id: '40990', name: '69th', backColor: null, textColor: null }] });
  const bus = alert({ id: 'bus', services: [{ type: 'B', id: '22', name: 'Clark', backColor: null, textColor: null }] });
  const both = alert({ id: 'both', services: [...train.services, ...bus.services] });

  it('splits train (route or station) and bus alerts, listing mixed ones in both', () => {
    expect(alertsForMode([train, station, bus, both], 'train').map(a => a.id)).toEqual(['train', 'station', 'both']);
    expect(alertsForMode([train, station, bus, both], 'bus').map(a => a.id)).toEqual(['bus', 'both']);
  });
});

describe('matchesSearch', () => {
  const [reroute] = normalizeAlerts(response([BUS_73_REROUTE]));

  it('matches everything on an empty or blank query', () => {
    expect(matchesSearch(reroute, '')).toBe(true);
    expect(matchesSearch(reroute, '   ')).toBe(true);
  });

  it('matches a route id exactly', () => {
    expect(matchesSearch(reroute, '73')).toBe(true);
    expect(matchesSearch(reroute, '7')).toBe(false);
  });

  it('matches route names, headline and description case-insensitively', () => {
    expect(matchesSearch(reroute, 'armitage')).toBe(true);
    expect(matchesSearch(reroute, 'REROUTE')).toBe(true);
    expect(matchesSearch(reroute, 'rerouted')).toBe(true);
    expect(matchesSearch(reroute, 'elevator')).toBe(false);
  });

  it('strips a leading # from a bus route number', () => {
    expect(matchesSearch(reroute, '#73')).toBe(true);
  });
});
