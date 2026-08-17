// Shared arrival-time math for the bus and train arrival/follow views.
//
// The CTA APIs report local Chicago wall-clock strings with no timezone designator, so parsing
// one into an absolute instant is only correct when the device happens to be in Chicago.
// Everything here is built to avoid that: durations come from subtracting two identically-parsed
// strings (which cancels both the timezone offset and any device clock skew), and the result is
// anchored to the wall time the response landed to turn it back into a real instant.

/** Parses the bus API's `YYYYMMDD HH:MM[:SS]` into local epoch ms. NaN when malformed. */
export function parseBusTime(value: string): number {
  const parts = value?.split(' ');
  if (!parts || parts.length < 2) {
    return NaN;
  }
  const [date, time] = parts;
  return new Date(
    +date.slice(0, 4),
    +date.slice(4, 6) - 1,
    +date.slice(6, 8),
    +time.slice(0, 2),
    +time.slice(3, 5),
    +time.slice(6, 8) || 0
  ).getTime();
}

/**
 * Parses the train API's `YYYY-MM-DDTHH:mm:ss` into local epoch ms. NaN when malformed.
 * A date-time string without a timezone designator is parsed as local time, which is what the
 * CTA intends.
 */
export function parseTrainTime(value: string): number {
  return value ? new Date(value).getTime() : NaN;
}

/** Minutes between two bus timestamps. Used for delayed buses, whose `prdctdn` is unusable. */
export function busMinutesBetween(from: string, to: string): number {
  return (parseBusTime(to) - parseBusTime(from)) / 60_000;
}

/** Formats an instant as `h:mm AM/PM`, matching the shape TimeuntilPipe already emits. */
export function formatClockTime(epochMs: number): string {
  if (isNaN(epochMs)) {
    return '--:--';
  }
  const time = new Date(epochMs);
  const hours = time.getHours() % 12 || 12;
  const minutes = ('0' + time.getMinutes()).slice(-2);
  const period = time.getHours() >= 12 ? 'PM' : 'AM';
  return `${hours}:${minutes} ${period}`;
}

/**
 * Turns a remaining duration into the countdown label. Anything at or under a minute — including
 * a negative value, i.e. a vehicle that has already passed but whose poll has not landed yet —
 * reads DUE rather than a stale or negative number.
 */
export function countdownLabel(remainingMs: number): string {
  if (isNaN(remainingMs)) {
    return '--';
  }
  const minutes = Math.round(remainingMs / 60_000);
  return minutes > 1 ? String(minutes) : 'DUE';
}

/** The subset of a bus prediction the arrival math needs. */
interface BusPrediction {
  dly: boolean;
  tmstmp: string;
  prdtm: string;
  prdctdn: string;
}

/**
 * Decays a bus prediction against the current clock and formats the API's own arrival time.
 *
 * The countdown is based on `prdctdn` rather than a `prdtm - tmstmp` subtraction because on the
 * arrivals endpoint those two are minute-resolution, so subtracting them quantizes the result;
 * `prdctdn` is already the whole minutes remaining as of the snapshot. Delayed buses are the
 * exception — the API sends an unusable `prdctdn` for those, so they fall back to the subtraction.
 *
 * A non-numeric `prdctdn` (the literal `DUE`, or `DLY` on a delayed vehicle) is passed through
 * untouched so those statuses keep rendering as text.
 */
export function busArrivalTimes(
  prd: BusPrediction,
  receivedAt: number,
  now: number
): { prdctdn: string; apiArrivalTime: string } {
  const baseMinutes = prd.dly ? busMinutesBetween(prd.tmstmp, prd.prdtm) : parseInt(prd.prdctdn, 10);
  const arrivalEpochMs = receivedAt + baseMinutes * 60_000;
  return {
    prdctdn: isNaN(baseMinutes) ? prd.prdctdn : countdownLabel(arrivalEpochMs - now),
    apiArrivalTime: formatClockTime(parseBusTime(prd.prdtm))
  };
}
