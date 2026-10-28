// CTA Bus Tracker for the eLBus keychain, answered in the same shapes as the train endpoints so
// the device parses buses and trains with the same code:
//
//   /buses?stop=1836&rt=49  → DeviceTrains: one "station" (the stop), groups by route and
//                             destination, `line` = "#49", `runs` = vehicle ids
//   /busfollow?vid=1234     → DeviceFollow: the bus's next stops on its current trip, `run` = vid

import type { DeviceFollow, DeviceTrains, Station, TrainGroup, Upstream } from './index';

export interface BusEnv {
  CTA_BUS_KEY: string;
}

const CTA_PREDICTIONS_URL = 'https://www.ctabustracker.com/bustime/api/v3/getpredictions';
const CACHE_SECONDS = 20;
const BUSES_PER_GROUP = 3;
const FOLLOW_STOPS = 12;

export const BUS_STOP_PATTERN = /^\d{1,6}$/;
// Routes like 49, X9, J14, 62H, 55A.
export const BUS_ROUTE_PATTERN = /^[A-Za-z0-9]{1,4}$/;
export const VEHICLE_PATTERN = /^\d{1,6}$/;

// Bus Tracker answers "nothing coming" as an error. These mean "no buses right now", not a fault.
const NO_PREDICTIONS = /no arrival times|no service scheduled|no data found/i;

export interface CtaPrediction {
  tmstmp: string;   // "20261027 21:44" (or with :SS)
  typ?: string;     // "A" arrival, "D" departure
  stpnm: string;
  stpid: string;
  vid: string;
  rt: string;
  des: string;
  prdtm: string;
  prdctdn?: string; // "DUE", "DLY" or minutes
  tatripid?: string;
}

interface BustimeResponse {
  'bustime-response'?: {
    prd?: CtaPrediction[];
    error?: { msg?: string }[];
  };
}

export type BusAnswer = { predictions: CtaPrediction[] } | { failure: string } | { unreachable: true };

export async function callBusTracker(
  params: Record<string, string>, env: BusEnv, upstream: Upstream
): Promise<BusAnswer> {
  const url = new URL(CTA_PREDICTIONS_URL);
  url.searchParams.set('key', env.CTA_BUS_KEY);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set('format', 'json');

  let body: BustimeResponse;
  try {
    const response = await upstream(url.toString(), {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    } as RequestInit);
    if (!response.ok) {
      return { unreachable: true };
    }
    body = await response.json();
  } catch {
    return { unreachable: true };
  }

  const bustime = body['bustime-response'];
  if (!bustime) {
    return { failure: 'Unexpected CTA response.' };
  }
  if (bustime.prd?.length) {
    return { predictions: bustime.prd };
  }
  const message = bustime.error?.[0]?.msg ?? '';
  if (NO_PREDICTIONS.test(message) || !bustime.error?.length) {
    return { predictions: [] };
  }
  return { failure: message };
}

// The stop's buses grouped by route and destination, soonest first, as one "station".
export function compactBuses(stop: string, predictions: CtaPrediction[], now: Date = new Date()): DeviceTrains {
  const here = predictions.filter(p => p.stpid === stop && p.typ !== 'D');
  const groups = new Map<string, { line: string; to: string; buses: { min: number; vid: number }[] }>();
  for (const p of here) {
    const line = `#${p.rt}`;
    const key = `${line}|${p.des}`;
    const group = groups.get(key) ?? { line, to: p.des, buses: [] };
    group.buses.push({ min: minutesUntil(p), vid: Number(p.vid) || 0 });
    groups.set(key, group);
  }
  const trains = [...groups.values()]
    .map((g): TrainGroup => {
      const soonest = g.buses.sort((a, b) => a.min - b.min).slice(0, BUSES_PER_GROUP);
      return { line: g.line, to: g.to, min: soonest.map(b => b.min), runs: soonest.map(b => b.vid) };
    })
    .sort((a, b) => a.min[0] - b.min[0] || a.to.localeCompare(b.to));

  const station: Station = { id: stop, name: here[0]?.stpnm.trim() ?? '', trains };
  return { updated: updatedAt(predictions, now), stations: [station] };
}

// The bus's next stops on the trip it's on now (its first prediction's trip), soonest first.
// Empty once Bus Tracker has nothing for it: out of service, or between trips.
export function compactBusFollow(vid: string, predictions: CtaPrediction[], now: Date = new Date()): DeviceFollow {
  const sorted = predictions.slice().sort((a, b) => busTime(a.prdtm) - busTime(b.prdtm));
  const trip = sorted[0]?.tatripid;
  const seen = new Set<string>();
  const stops = sorted
    .filter(p => trip === undefined || p.tatripid === trip)
    .filter(p => !seen.has(p.stpid) && seen.add(p.stpid))
    .slice(0, FOLLOW_STOPS)
    .map(p => ({ id: p.stpid, name: p.stpnm.trim(), min: minutesUntil(p) }));
  return {
    updated: updatedAt(predictions, now),
    run: vid,
    line: sorted[0] ? `#${sorted[0].rt}` : '',
    to: sorted[0]?.des ?? '',
    stops
  };
}

function minutesUntil(p: CtaPrediction): number {
  const countdown = p.prdctdn?.trim().toUpperCase();
  if (countdown === 'DUE') {
    return 0;
  }
  if (countdown && /^\d+$/.test(countdown)) {
    return Number(countdown);
  }
  // "DLY" (delayed) or missing: from the two timestamps.
  return Math.max(0, Math.floor((busTime(p.prdtm) - busTime(p.tmstmp)) / 60000));
}

// "20261027 21:44" or "20261027 21:44:05", Chicago wall-clock, read as UTC (only differences
// matter).
function busTime(value: string): number {
  const match = /^(\d{4})(\d{2})(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value ?? '');
  if (!match) {
    return NaN;
  }
  const [, y, mo, d, h, mi, s] = match;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
}

// CTA's timestamp as Chicago HH:MM, or the Chicago clock when there are no predictions.
function updatedAt(predictions: CtaPrediction[], now: Date): string {
  const stamp = predictions[0]?.tmstmp;
  if (stamp && /^\d{8} \d{2}:\d{2}/.test(stamp)) {
    return stamp.slice(9, 14);
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(now);
}
