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
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
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
 */
export function formatDistance(feet: number): string {
  if (feet === null || feet === undefined || isNaN(feet) || feet < 0) {
    return '';
  }
  if (feet < 1000) {
    return `${Math.round(feet / 10) * 10} ft`;
  }
  return `${(feet / FEET_PER_MILE).toFixed(1)} mi`;
}

/**
 * Distance from a train's GPS position to a station, for the arrival and follow views.
 *
 * Returns '' when either end is unknown — notably for schedule-based predictions
 * (`isSch="1"`), which the CTA documents as having empty lat/lon. The `~` prefix marks this as
 * straight-line, since unlike the bus API's along-route `dstp` a train can be much further away
 * by track than by air.
 */
export function trainDistanceLabel(
  station: { latitude: number; longitude: number } | null | undefined,
  lat: string | undefined,
  lon: string | undefined
): string {
  if (!station || !lat || !lon) {
    return '';
  }
  const label = formatDistance(haversineFeet(+lat, +lon, station.latitude, station.longitude));
  return label ? `~${label}` : '';
}
