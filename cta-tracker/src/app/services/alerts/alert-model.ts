// CTA Customer Alerts: the raw API shape, and the clean model the app renders.
//
// The API is an XML feed converted to JSON, which leaks into the payload: a single Alert or Service
// is an object rather than a one-element array, text arrives wrapped as { "#cdata-section": … },
// every number and flag is a string, and "nothing matched" is ErrorCode 50 rather than an empty list.
// All of that is absorbed here so nothing else has to know.

type Cdata = string | { '#cdata-section'?: string } | null | undefined;
type OneOrMany<T> = T | T[] | null | undefined;

export interface RawService {
  ServiceType?: string;
  ServiceTypeDescription?: string;
  ServiceName?: string;
  ServiceId?: string;
  ServiceBackColor?: string;
  ServiceTextColor?: string;
}

export interface RawAlert {
  AlertId: string;
  Headline?: string;
  ShortDescription?: string;
  FullDescription?: Cdata;
  SeverityScore?: string;
  SeverityColor?: string;
  SeverityCSS?: string;
  Impact?: string;
  EventStart?: string | null;
  EventEnd?: string | null;
  TBD?: string;
  MajorAlert?: string;
  AlertURL?: Cdata;
  ImpactedService?: { Service?: OneOrMany<RawService> } | null;
}

export interface CtaAlertsResponse {
  CTAAlerts: {
    TimeStamp?: string;
    ErrorCode?: string;
    ErrorMessage?: string | null;
    Alert?: OneOrMany<RawAlert>;
  };
}

export interface AlertService {
  /** 'R' train route, 'T' train station, 'B' bus route; CTA uses others for systemwide notices. */
  type: string;
  id: string;
  name: string;
  backColor: string | null;
  textColor: string | null;
}

export interface ServiceAlert {
  id: string;
  headline: string;
  shortDescription: string;
  /** CTA's own HTML. Bind it with [innerHTML] so Angular's sanitizer runs over it. */
  fullHtml: string;
  url: string | null;
  impact: string;
  severity: number;
  major: boolean;
  start: Date | null;
  end: Date | null;
  tbd: boolean;
  services: AlertService[];
}

export type TransitMode = 'train' | 'bus';

/** Below this, an alert is a note (elevators, stop relocations) rather than a service problem. */
export const MINOR_SEVERITY = 20;

const NO_ACTIVE_ALERTS = '50';

export class AlertsError extends Error {}

export function normalizeAlerts(raw: CtaAlertsResponse): ServiceAlert[] {
  const body = raw?.CTAAlerts;
  if (!body) {
    throw new AlertsError('Unexpected response from CTA alerts.');
  }
  const code = body.ErrorCode ?? '0';
  if (code === NO_ACTIVE_ALERTS) {
    return [];
  }
  if (code !== '0') {
    throw new AlertsError(body.ErrorMessage || `CTA alerts error ${code}.`);
  }
  return asArray(body.Alert).map(normalizeAlert);
}

function normalizeAlert(raw: RawAlert): ServiceAlert {
  return {
    id: raw.AlertId,
    headline: raw.Headline ?? '',
    shortDescription: raw.ShortDescription ?? '',
    fullHtml: cdata(raw.FullDescription) ?? '',
    url: secureUrl(cdata(raw.AlertURL)),
    impact: raw.Impact ?? '',
    severity: Number(raw.SeverityScore) || 0,
    major: raw.MajorAlert === '1',
    start: parseCtaDate(raw.EventStart),
    end: parseCtaDate(raw.EventEnd),
    tbd: raw.TBD === '1',
    services: asArray(raw.ImpactedService?.Service).map(service => ({
      type: service.ServiceType ?? '',
      id: service.ServiceId ?? '',
      name: service.ServiceName ?? '',
      backColor: hexColor(service.ServiceBackColor),
      textColor: hexColor(service.ServiceTextColor)
    }))
  };
}

function asArray<T>(value: OneOrMany<T>): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function cdata(value: Cdata): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return value?.['#cdata-section'] ?? null;
}

// CTA still hands out http:// links to its own https site.
function secureUrl(url: string | null): string | null {
  return url ? url.replace(/^http:\/\//i, 'https://') : null;
}

function hexColor(value: string | undefined): string | null {
  return value && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : null;
}

// CTA times are Chicago wall-clock with no offset ('2026-09-22T08:16:00'), or a bare date. Built
// from parts so a date-only value is local midnight rather than UTC midnight.
function parseCtaDate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    return null;
  }
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

/**
 * Narrows a `routeid=` response to one station. CTA's route filter also returns station-level
 * alerts anywhere on the line (an elevator at 69th shows up for every Red Line stop), so a station
 * alert is kept only at its own station, and a line alert only when it names no station at all.
 */
export function alertsForTrainStation(alerts: ServiceAlert[], routeId: string, stationId: string): ServiceAlert[] {
  const route = routeId.toLowerCase();
  return alerts.filter(alert => {
    const stations = alert.services.filter(s => s.type === 'T');
    if (stations.length > 0) {
      return stations.some(s => s.id === stationId);
    }
    return alert.services.some(s => s.type === 'R' && s.id.toLowerCase() === route);
  });
}

/** Major first, then CTA's severity score, then the most recently started. */
export function sortBySeverity(alerts: ServiceAlert[]): ServiceAlert[] {
  return [...alerts].sort((a, b) =>
    Number(b.major) - Number(a.major) ||
    b.severity - a.severity ||
    (b.start?.getTime() ?? -Infinity) - (a.start?.getTime() ?? -Infinity));
}

export function partitionBySeverity(alerts: ServiceAlert[]): { prominent: ServiceAlert[]; minor: ServiceAlert[] } {
  const prominent: ServiceAlert[] = [];
  const minor: ServiceAlert[] = [];
  for (const alert of alerts) {
    (alert.major || alert.severity >= MINOR_SEVERITY ? prominent : minor).push(alert);
  }
  return { prominent, minor };
}

/** An alert touching both trains and buses is listed under each. */
export function alertsForMode(alerts: ServiceAlert[], mode: TransitMode): ServiceAlert[] {
  const types = mode === 'train' ? ['R', 'T'] : ['B'];
  return alerts.filter(alert => alert.services.some(s => types.includes(s.type)));
}

/**
 * A number is a bus route and matches route ids exactly, so '7' finds neither '73' nor a "#73" in
 * the text. Anything else is a substring match over route names, headline and description.
 */
export function matchesSearch(alert: ServiceAlert, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) {
    return true;
  }
  if (/^\d+$/.test(q)) {
    return alert.services.some(s => s.id === q);
  }
  return alert.services.some(s => s.id.toLowerCase() === q || s.name.toLowerCase().includes(q)) ||
    alert.headline.toLowerCase().includes(q) ||
    alert.shortDescription.toLowerCase().includes(q);
}
