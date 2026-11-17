// Where a stop row on the two follow screens goes when tapped: that stop's own arrivals screen.
//
// Returned as router commands rather than a URL string so a stop name with a '?', '#' or '(' in it
// is encoded as one path segment instead of being parsed as part of the URL.

import { Prd } from '../busResponse';
import { TrainEta } from '../trainResponse';
import { urlSafeName } from './prediction/stop-key';

/**
 * The follow endpoint names the line in full ("Blue Line") where every other endpoint, and so the
 * train-arrivals route, uses the short code ("Blue"). The arrivals screen filters on the code, so
 * linking with the full name would open a screen that shows nothing.
 */
const TRAIN_ROUTE_CODES: Record<string, string> = {
  red: 'Red', blue: 'Blue', brown: 'Brn', brn: 'Brn', green: 'G', g: 'G', orange: 'Org', org: 'Org',
  purple: 'P', p: 'P', pink: 'Pink', yellow: 'Y', y: 'Y'
};

/** The short route code for whatever the API called the line, or '' when it is not one we know. */
export function trainRouteCode(rt: string | null | undefined): string {
  const [line] = (rt ?? '').trim().toLowerCase().split(/\s+/);
  return TRAIN_ROUTE_CODES[line] ?? '';
}

/** Commands for a bus stop's arrivals screen, or null when the prediction lacks what the route needs. */
export function busStopCommands(prediction: Pick<Prd, 'rt' | 'rtdir' | 'stpid' | 'stpnm'>): string[] | null {
  const { rt, rtdir, stpid, stpnm } = prediction;
  if (!rt || !rtdir || !stpid || !stpnm) {
    return null;
  }
  return ['/arrivals', rt, rtdir, String(stpid), urlSafeName(stpnm)];
}

/**
 * Commands for a train station's arrivals screen. `routeCode` is the code the follow screen was
 * opened with, which is preferred because it is the line the user was already looking at; the
 * prediction's own `rt` is the fallback for a follow screen reached without one.
 */
export function trainStationCommands(
  prediction: Pick<TrainEta, 'rt' | 'staId' | 'staNm'>,
  routeCode: string
): string[] | null {
  const code = trainRouteCode(routeCode) || trainRouteCode(prediction.rt);
  if (!code || !prediction.staId || !prediction.staNm) {
    return null;
  }
  return ['/train-arrivals', code, prediction.staId, urlSafeName(prediction.staNm)];
}
