// Canonical stop identity and the round trip back to a router URL.
//
// The app addresses the same stop three different ways depending on where you look (route params,
// Favorite records, CTA payloads), so this is the one place that decides what "the same stop" means.

import { StopKey, StopKind, StopViewEvent } from './stop-view-event';

export function stopKeyOf(kind: StopKind, stopId: string | number): StopKey {
  return `${kind}:${stopId}`;
}

export function parseStopKey(key: StopKey): { kind: StopKind; stopId: string } {
  const separator = key.indexOf(':');
  return {
    kind: key.slice(0, separator) as StopKind,
    stopId: key.slice(separator + 1)
  };
}

/**
 * Mirrors the `replaceSlash` helper duplicated in StopsComponent and TrainStopsComponent: a stop
 * name goes into the URL as a path segment, so a '/' in it would split the segment.
 *
 * This makes the name in the URL lossy, which is why nothing here ever keys on the name.
 */
function urlSafeName(name: string): string {
  return name.replace(/\//g, '-');
}

/** The deep link that reopens a logged stop, matching the two arrivals routes in app.routes.ts. */
export function stopViewUrl(event: Pick<StopViewEvent, 'kind' | 'stopId' | 'stopName' | 'route' | 'direction'>): string {
  const name = urlSafeName(event.stopName);
  return event.kind === 'train'
    ? `/train-arrivals/${event.route}/${event.stopId}/${name}`
    : `/arrivals/${event.route}/${event.direction}/${event.stopId}/${name}`;
}
