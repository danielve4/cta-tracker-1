// The CTA Holiday Train and Holiday Bus, read out of Train Tracker and Bus Tracker.
//
// CTA runs the Holiday Train as run #1225 (for December 25) on whichever line it is visiting that
// day, so it is found by following that run number rather than by scanning every line. The follow
// endpoint already exists (`/trainfollow`), which means nothing on the node proxy changes.
//
// Everything here is Angular-free so it is unit-tested alongside the other pure modules.

import { CTAComprehensiveData, TrainApiResponse, TrainEta, TRAIN_ROUTE_ID_TO_LINE_NAME } from '../trainResponse';
import { BustimeResponse, Prd } from '../busResponse';
import { Favorite } from '../services/Favorite';
import { trainRouteCode } from '../services/follow-stop-link';
import { parseBusTime, parseTrainTime } from '../services/arrival-time';
import { shortStationName } from '../train-arrivals/destination-eta';

export const HOLIDAY_TRAIN_RUN = '1225';
/** The Holiday Bus is one decorated articulated bus, so it is followed by its vehicle number. */
export const HOLIDAY_BUS_VEHICLE = '4374';
/** How far ahead a favorite stop counts as "near" for the seasonal card's badge. */
export const NEAR_STOP_MINUTES = 30;

/** Train Tracker's follow-API code for "no train with that run number is in service". */
const RUN_NOT_FOUND = '501';
/** In service, but Train Tracker cannot say where it goes next (laying over at a terminal, say). */
const NO_UPCOMING_STOPS = new Set(['502', '503']);

export interface HolidayStop {
  staId: string;
  name: string;
  /** Absolute arrival instant, anchored to when the response landed. NaN when unreadable. */
  arrivalEpochMs: number;
  approaching: boolean;
  delayed: boolean;
  /** The raw prediction, for building the station's arrivals link. */
  eta: TrainEta;
}

export interface StationRef {
  staId: string;
  name: string;
}

export type HolidayTrainStatus =
  | {
      state: 'running';
      routeCode: string;
      lineName: string;
      destination: string;
      stops: HolidayStop[];
      /** The station it most recently left, when the line's stop order can tell us. */
      lastStation: StationRef | null;
    }
  /** On the tracks, but between trips: Train Tracker lists no upcoming stops. */
  | { state: 'resting'; routeCode: string; lineName: string }
  | { state: 'not-running' }
  /** Train Tracker answered with an error that says nothing about the train (bad key, quota). */
  | { state: 'unknown'; message: string };

/**
 * Reads a `/trainfollow?vehicleId=1225` response.
 *
 * `receivedAtMs` is when the response landed; arrival instants are that plus the API's own
 * `arrT - tmst`, the same device-clock-proof math the follow screen uses.
 */
export function readHolidayTrain(
  response: TrainApiResponse,
  receivedAtMs: number,
  data: CTAComprehensiveData | null
): HolidayTrainStatus {
  const ctatt = response?.ctatt;
  if (!ctatt) {
    return { state: 'unknown', message: 'Train Tracker sent an empty answer.' };
  }
  const errCd = String(ctatt.errCd ?? '0');
  if (errCd === RUN_NOT_FOUND) {
    return { state: 'not-running' };
  }
  const etas = (ctatt.eta ?? []).filter(eta => eta && eta.staId);
  const firstRt = etas[0]?.rt ?? '';
  const routeCode = trainRouteCode(firstRt);
  const lineName = TRAIN_ROUTE_ID_TO_LINE_NAME[routeCode] ?? firstRt;

  if (NO_UPCOMING_STOPS.has(errCd) || (errCd === '0' && etas.length === 0)) {
    return { state: 'resting', routeCode, lineName };
  }
  if (errCd !== '0') {
    return { state: 'unknown', message: ctatt.errNm || `Train Tracker error ${errCd}.` };
  }

  const responseTime = parseTrainTime(ctatt.tmst);
  const stops = etas.map<HolidayStop>(eta => {
    const apiNow = isNaN(responseTime) ? parseTrainTime(eta.prdt) : responseTime;
    return {
      staId: eta.staId,
      name: shortStationName(eta.staNm),
      arrivalEpochMs: receivedAtMs + (parseTrainTime(eta.arrT) - apiNow),
      approaching: eta.isApp === '1',
      delayed: eta.isDly === '1',
      eta
    };
  });

  return {
    state: 'running',
    routeCode,
    lineName,
    destination: shortStationName(etas[0].destNm ?? ''),
    stops,
    lastStation: previousStation(data, routeCode, stops.map(stop => stop.staId))
  };
}

/**
 * The station before the next stop, in the direction of travel. The direction comes from the
 * first two upcoming stops: whichever way they run along the line's stop order is the way the
 * train is going. A Loop line lists some stations twice, so every place the pair appears is tried.
 * With a single upcoming stop the direction is unknowable and this returns null.
 */
export function previousStation(
  data: CTAComprehensiveData | null,
  routeCode: string,
  upcoming: string[]
): StationRef | null {
  const sequence = data?.stopSequences?.[TRAIN_ROUTE_ID_TO_LINE_NAME[routeCode]]?.stops;
  if (!data || !sequence || upcoming.length < 2) {
    return null;
  }
  const [next, after] = upcoming;
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] !== next) {
      continue;
    }
    let previousId: string | undefined;
    if (sequence[i + 1] === after) {
      previousId = sequence[i - 1];
    } else if (sequence[i - 1] === after) {
      previousId = sequence[i + 1];
    } else {
      continue;
    }
    const station = previousId ? data.stations[previousId] : undefined;
    return station && previousId ? { staId: previousId, name: shortStationName(station.name) } : null;
  }
  return null;
}

export interface HolidayBusStop {
  stpid: string;
  name: string;
  arrivalEpochMs: number;
  delayed: boolean;
  /** The raw prediction, for building the stop's arrivals link. */
  prd: Prd;
}

export type HolidayBusStatus =
  | { state: 'running'; route: string; direction: string; destination: string; stops: HolidayBusStop[] }
  | { state: 'not-running' }
  | { state: 'unknown'; message: string };

/**
 * Bus Tracker's answer when a vehicle has no predictions: it is off the road, or between trips.
 * Either way, for the Holiday Bus, there is nothing to show.
 */
const BUS_NOTHING_FOUND = /no (data|arrival times|service)/i;

/**
 * Reads a `/busfollow?vehicleId=4374` response (Bus Tracker v3 `getpredictions?vid=`, seconds
 * resolution). Arrival instants are `prdtm - tmstmp` anchored to when the response landed, which
 * also holds for a delayed bus, whose `prdctdn` is unusable.
 */
export function readHolidayBus(response: BustimeResponse, receivedAtMs: number): HolidayBusStatus {
  if (!response) {
    return { state: 'unknown', message: 'Bus Tracker sent an empty answer.' };
  }
  const predictions = (response.prd ?? []).filter(prd => prd && prd.stpid);
  if (predictions.length === 0) {
    const message = response.error?.[0]?.msg ?? '';
    return !message || BUS_NOTHING_FOUND.test(message)
      ? { state: 'not-running' }
      : { state: 'unknown', message };
  }
  const stops = predictions.map<HolidayBusStop>(prd => {
    let minutes = (parseBusTime(prd.prdtm) - parseBusTime(prd.tmstmp)) / 60_000;
    if (isNaN(minutes)) {
      minutes = prd.prdctdn === 'DUE' ? 0 : parseInt(prd.prdctdn, 10);
    }
    return {
      stpid: String(prd.stpid),
      name: prd.stpnm,
      arrivalEpochMs: receivedAtMs + minutes * 60_000,
      delayed: !!prd.dly,
      prd
    };
  });
  const first = predictions[0];
  return { state: 'running', route: first.rt, direction: first.rtdir, destination: first.des, stops };
}

export interface FavoriteHit {
  kind: 'train' | 'bus';
  stopName: string;
  arrivalEpochMs: number;
}

/**
 * The favorites the Holiday Train or Bus is on its way to within `NEAR_STOP_MINUTES`, soonest
 * first and one per vehicle: what the seasonal card's badge reads. A train favorite stores the
 * station's mapid as `stopId`, which is the follow API's `staId`; a bus favorite (no `type`, or
 * `'bus'`) stores the stop id, which is `stpid`.
 */
export function holidayHitsForFavorites(
  favorites: Favorite[],
  train: HolidayTrainStatus | null,
  bus: HolidayBusStatus | null,
  nowMs: number
): FavoriteHit[] {
  const horizon = nowMs + NEAR_STOP_MINUTES * 60_000;
  const trainIds = new Set(favorites.filter(f => f.type === 'train').map(f => String(f.stopId)));
  const busIds = new Set(favorites.filter(f => (f.type ?? 'bus') === 'bus').map(f => String(f.stopId)));
  const hits: FavoriteHit[] = [];

  const trainStop = train?.state === 'running'
    ? train.stops.find(stop => trainIds.has(stop.staId) && stop.arrivalEpochMs <= horizon)
    : undefined;
  if (trainStop) {
    hits.push({ kind: 'train', stopName: trainStop.name, arrivalEpochMs: trainStop.arrivalEpochMs });
  }
  const busStop = bus?.state === 'running'
    ? bus.stops.find(stop => busIds.has(stop.stpid) && stop.arrivalEpochMs <= horizon)
    : undefined;
  if (busStop) {
    hits.push({ kind: 'bus', stopName: busStop.name, arrivalEpochMs: busStop.arrivalEpochMs });
  }
  return hits.sort((a, b) => a.arrivalEpochMs - b.arrivalEpochMs);
}

/** `Holiday Train at Belmont in 6 min` / `Holiday Bus at Michigan & Ohio now`. */
export function favoriteHitLabel(hit: FavoriteHit, nowMs: number): string {
  const vehicle = hit.kind === 'train' ? 'Holiday Train' : 'Holiday Bus';
  const minutes = Math.round((hit.arrivalEpochMs - nowMs) / 60_000);
  return `${vehicle} at ${hit.stopName} ${minutes > 1 ? `in ${minutes} min` : 'now'}`;
}

/**
 * Mid-November through New Year's Eve: when the seasonal card shows on Routes and Favorites.
 * The train's first run is usually Black Friday, so this opens a little early on purpose.
 */
export function isHolidaySeason(date: Date): boolean {
  const month = date.getMonth();
  return (month === 10 && date.getDate() >= 15) || month === 11;
}

/** Whole days until Christmas Day, 0 on the day itself, null once it has passed this year. */
export function daysUntilChristmas(date: Date): number | null {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const christmas = new Date(date.getFullYear(), 11, 25);
  const days = Math.round((christmas.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

/** `29 days until Christmas`, `1 day until Christmas`, `Merry Christmas`, or '' after the 25th. */
export function christmasCountdownLabel(date: Date): string {
  const days = daysUntilChristmas(date);
  if (days === null) {
    return '';
  }
  if (days === 0) {
    return 'Merry Christmas';
  }
  return `${days} ${days === 1 ? 'day' : 'days'} until Christmas`;
}

/** Minutes for the big countdown: `4`, or 'Due' at a minute or less (or once it has passed). */
export function holidayCountdown(arrivalEpochMs: number, nowMs: number, approaching: boolean): string {
  if (approaching) {
    return 'Due';
  }
  if (isNaN(arrivalEpochMs)) {
    return '--';
  }
  const minutes = Math.round((arrivalEpochMs - nowMs) / 60_000);
  return minutes > 1 ? String(minutes) : 'Due';
}
