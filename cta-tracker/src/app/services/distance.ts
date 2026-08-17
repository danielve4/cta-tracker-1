// Distance readouts for arrival rows.
//
// The two APIs are asymmetric: the bus API reports `dstp` directly (linear feet remaining along
// the route pattern), while the train API reports no distance at all — only the train's GPS
// position — so a train figure has to be computed against the station's coordinates and is
// straight-line rather than along-track. Callers mark the computed kind with a `~` prefix;
// formatDistance itself stays a pure formatter and adds nothing.

const EARTH_RADIUS_FEET = 20_902_231;
const FEET_PER_MILE = 5280;

/** Great-circle distance in feet. NaN if any coordinate is missing or unparseable. */
export function haversineFeet(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return NaN;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_FEET;
}

/**
 * Formats a distance in feet for display, or '' when there is nothing meaningful to show.
 * Short distances round to the nearest 10 ft rather than claiming foot-level precision.
 *
 * A value that rounds to zero renders as nothing at all. It tells the rider less than the
 * countdown already does, and for trains it is usually not even a real reading: when the CTA has
 * no position fix it reports the station's own coordinates, so several trains at one station come
 * back sitting on the platform to within a couple of feet.
 */
export function formatDistance(feet: number): string {
  if (!Number.isFinite(feet) || feet < 0) {
    return '';
  }
  if (feet < 1000) {
    const rounded = Math.round(feet / 10) * 10;
    return rounded === 0 ? '' : `${rounded} ft`;
  }
  return `${(feet / FEET_PER_MILE).toFixed(1)} mi`;
}

/**
 * Parses a CTA coordinate, treating "no fix" as absent.
 *
 * The CTA signals a missing position three different ways: the field is absent (documented for
 * schedule-based predictions), it is an empty string, or it is the literal "0". That last one is
 * the dangerous case — "0" is a truthy string, so an unguarded read puts the train at Null Island
 * and yields a confident ~6099 mi.
 */
function parseCoordinate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

/**
 * Distance from a train's GPS position to a station, for the arrival and follow views.
 *
 * Returns '' whenever the answer would not be meaningful: either end's position is unknown, or
 * the train reads as sitting on the platform. The `~` prefix marks this as straight-line, since
 * unlike the bus API's along-route `dstp` a train can be much further away by track than by air.
 */
export function trainDistanceLabel(
  station: { latitude: number; longitude: number } | null | undefined,
  lat: string | number | null | undefined,
  lon: string | number | null | undefined
): string {
  const trainLat = parseCoordinate(lat);
  const trainLon = parseCoordinate(lon);
  const stationLat = parseCoordinate(station?.latitude);
  const stationLon = parseCoordinate(station?.longitude);
  if (trainLat === null || trainLon === null || stationLat === null || stationLon === null) {
    return '';
  }
  const label = formatDistance(haversineFeet(trainLat, trainLon, stationLat, stationLon));
  return label ? `~${label}` : '';
}
