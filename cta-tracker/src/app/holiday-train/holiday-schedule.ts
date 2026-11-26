// When CTA has the Holiday Train and Holiday Bus out, from its published Holiday Fleet schedule
// (transitchicago.com/holidayfleet). The app only watches Train Tracker and Bus Tracker inside
// these windows, and the seasonal card only shows on scheduled days.
//
// Angular-free so it can be unit-tested. The tables are for one season and need replacing each
// year: once the last day has passed, nothing shows until they are.

/** The season the tables below describe. */
export const HOLIDAY_SCHEDULE_YEAR = 2026;

/** One scheduled day. `date` and the times are Chicago wall-clock. */
export interface ScheduledRun {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`, 24-hour. For the train, its first departure; for the bus, CTA's approximate start. */
  start: string;
  /** For the train, its last departure; for the bus, CTA's approximate end. */
  end: string;
  /** Where and when Santa takes photos, in CTA's words, when it says. */
  photos?: string;
}

export interface TrainDay extends ScheduledRun {
  /** Train Tracker route codes (`Org`, `G`, …) in the order CTA lists them. */
  lines: string[];
  note?: string;
}

export interface BusDay extends ScheduledRun {
  routes: { route: string; name: string }[];
}

/** Times are CTA's first and last departures (all PM). */
export const HOLIDAY_TRAIN_SCHEDULE: readonly TrainDay[] = [
  { date: '2026-11-27', lines: ['Org', 'G'], start: '15:00', end: '17:17' },
  { date: '2026-11-28', lines: ['G'], start: '14:32', end: '17:30', photos: 'on board' },
  { date: '2026-12-01', lines: ['G', 'Org'], start: '15:50', end: '19:55' },
  { date: '2026-12-02', lines: ['Org', 'Brn'], start: '15:08', end: '16:41' },
  { date: '2026-12-03', lines: ['Org', 'Brn'], start: '15:53', end: '17:28' },
  { date: '2026-12-04', lines: ['Org', 'Brn'], start: '15:08', end: '16:41' },
  { date: '2026-12-05', lines: ['Org', 'Brn'], start: '13:13', end: '17:50', photos: 'on board' },
  { date: '2026-12-08', lines: ['Pink'], start: '14:46', end: '16:38' },
  { date: '2026-12-09', lines: ['Pink'], start: '15:06', end: '17:15' },
  { date: '2026-12-10', lines: ['Blue'], start: '15:17', end: '16:56' },
  { date: '2026-12-11', lines: ['Blue'], start: '16:17', end: '17:56' },
  { date: '2026-12-12', lines: ['Pink', 'Blue'], start: '14:08', end: '15:56', photos: 'on board' },
  { date: '2026-12-15', lines: ['Red'], start: '14:43', end: '16:19' },
  { date: '2026-12-16', lines: ['P'], start: '15:15', end: '18:00' },
  { date: '2026-12-17', lines: ['Red'], start: '15:13', end: '16:46' },
  { date: '2026-12-18', lines: ['P'], start: '15:45', end: '18:20' },
  { date: '2026-12-19', lines: ['Red', 'P'], start: '12:36', end: '18:21', photos: 'on board' },
  {
    date: '2026-12-22', lines: ['Y'], start: '15:08', end: '19:16',
    note: 'Every Yellow Line train runs as a two-car Holiday Train today.'
  }
];

export const HOLIDAY_BUS_SCHEDULE: readonly BusDay[] = [
  { date: '2026-11-24', routes: [{ route: '56', name: 'Milwaukee' }], start: '11:45', end: '17:00' },
  { date: '2026-11-25', routes: [{ route: '56', name: 'Milwaukee' }], start: '11:55', end: '16:00',
    photos: 'at Jefferson Park, 3:00 to 4:00 PM' },
  { date: '2026-11-27', routes: [{ route: '22', name: 'Clark' }], start: '12:45', end: '20:00' },
  { date: '2026-11-28', routes: [{ route: '22', name: 'Clark' }, { route: '97', name: 'Skokie' }],
    start: '12:30', end: '19:00', photos: 'at Old Orchard Mall, 1:30 to 2:30 PM' },
  { date: '2026-11-29', routes: [{ route: '91', name: 'Austin' }, { route: '81', name: 'Lawrence' }],
    start: '11:50', end: '18:40', photos: 'at Jefferson Park, 1:50 to 2:50 PM' },
  { date: '2026-12-01', routes: [{ route: '74', name: 'Fullerton' }], start: '12:15', end: '19:00' },
  { date: '2026-12-02', routes: [{ route: '53', name: 'Pulaski' }], start: '11:30', end: '18:45' },
  { date: '2026-12-03', routes: [{ route: '20', name: 'Madison' }], start: '11:40', end: '19:20',
    photos: 'at Randolph/Columbus, 3:50 to 4:50 PM' },
  { date: '2026-12-04', routes: [{ route: '126', name: 'Jackson' }], start: '12:30', end: '19:05',
    photos: 'at Jackson/Austin, 3:10 to 4:10 PM' },
  { date: '2026-12-05', routes: [{ route: '12', name: 'Roosevelt' }], start: '12:30', end: '18:00',
    photos: 'at Harrison/Central, 3:00 to 4:00 PM' },
  { date: '2026-12-08', routes: [{ route: '62', name: 'Archer' }], start: '12:15', end: '18:00',
    photos: 'at Midway, 1:50 to 2:50 PM' },
  { date: '2026-12-09', routes: [{ route: '49', name: 'Western' }, { route: 'X49', name: 'Western Express' }],
    start: '11:20', end: '18:00', photos: 'at 79th/Western, 3:10 to 4:10 PM' },
  { date: '2026-12-10', routes: [{ route: '79', name: '79th' }], start: '12:10', end: '18:00' },
  { date: '2026-12-11', routes: [{ route: '3', name: 'King Drive' }], start: '12:45', end: '19:00' },
  { date: '2026-12-12', routes: [{ route: '4', name: 'Cottage Grove' }], start: '11:25', end: '17:45',
    photos: 'at 115th/Cottage Grove, 2:55 to 3:55 PM' },
  { date: '2026-12-15', routes: [{ route: '28', name: 'Stony Island' }], start: '12:45', end: '19:30',
    photos: 'at Union Station, 4:20 to 5:20 PM' },
  { date: '2026-12-16', routes: [{ route: 'J14', name: 'Jeffrey Jump' }], start: '11:50', end: '19:30' },
  { date: '2026-12-17', routes: [{ route: '6', name: 'Jackson Park' }], start: '10:10', end: '16:30' },
  { date: '2026-12-18', routes: [{ route: '29', name: 'State' }], start: '15:15', end: '18:30' },
  { date: '2026-12-19', routes: [{ route: '29', name: 'State' }], start: '12:20', end: '19:30',
    photos: 'at Navy Pier, 1:50 to 2:50 PM' },
  { date: '2026-12-21', routes: [{ route: '34', name: 'South Michigan' }], start: '11:20', end: '18:30',
    photos: 'at the 95th Red Line station, 2:05 to 3:05 PM' }
];

/** Minutes either side of the scheduled times that the app still watches the live tracker. */
export interface WatchPadding { before: number; after: number; }
/** A train's last departure still has a whole trip to run. */
export const TRAIN_WATCH_PADDING: WatchPadding = { before: 30, after: 90 };
/** The bus's times are already its whole day, and only approximate. */
export const BUS_WATCH_PADDING: WatchPadding = { before: 30, after: 45 };

export const TRAIN_LINE_SHORT_NAMES: Record<string, string> = {
  Red: 'Red', Blue: 'Blue', Brn: 'Brown', G: 'Green', Org: 'Orange', P: 'Purple', Pink: 'Pink', Y: 'Yellow'
};

const CHICAGO = 'America/Chicago';

/** Chicago's offset from UTC, in minutes, at an instant. */
function chicagoOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric'
  }).formatToParts(new Date(utcMs));
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return Math.round((wallAsUtc - utcMs) / 60_000);
}

/** The instant of a Chicago wall-clock date and time, wherever the device is. */
export function chicagoEpoch(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  return guess - chicagoOffsetMinutes(guess) * 60_000;
}

/** The Chicago calendar date of an instant, as `YYYY-MM-DD`. */
export function chicagoDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms));
}

export interface ScheduleWindow<T extends ScheduledRun> {
  day: T;
  startMs: number;
  endMs: number;
  /** When the app starts and stops asking the live tracker. */
  watchFromMs: number;
  watchUntilMs: number;
}

export interface ScheduleView<T extends ScheduledRun> {
  /** Today's scheduled run (Chicago date), if there is one, whether or not it has started. */
  today: ScheduleWindow<T> | null;
  /** Inside today's watch window: the live tracker is worth asking. */
  watching: boolean;
  /** The next run that is not over yet, today's included; null once the season is over. */
  next: ScheduleWindow<T> | null;
}

export function scheduleWindow<T extends ScheduledRun>(day: T, padding: WatchPadding): ScheduleWindow<T> {
  const startMs = chicagoEpoch(day.date, day.start);
  const endMs = chicagoEpoch(day.date, day.end);
  return {
    day,
    startMs,
    endMs,
    watchFromMs: startMs - padding.before * 60_000,
    watchUntilMs: endMs + padding.after * 60_000
  };
}

export function scheduleView<T extends ScheduledRun>(
  schedule: readonly T[],
  nowMs: number,
  padding: WatchPadding
): ScheduleView<T> {
  const todayKey = chicagoDateKey(nowMs);
  const windows = schedule.map(day => scheduleWindow(day, padding)).sort((a, b) => a.startMs - b.startMs);
  const today = windows.find(w => w.day.date === todayKey) ?? null;
  const watching = !!today && nowMs >= today.watchFromMs && nowMs <= today.watchUntilMs;
  const next = windows.find(w => w.watchUntilMs >= nowMs) ?? null;
  return { today, watching, next };
}

/** Today's run is still ahead or under way, so the seasonal card has something to say. */
export function scheduledToday(view: ScheduleView<ScheduledRun>, nowMs: number): boolean {
  return !!view.today && nowMs <= view.today.watchUntilMs;
}

/** `3:00 PM`, in Chicago time. */
export function formatChicagoTime(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: CHICAGO, hour: 'numeric', minute: '2-digit' })
    .format(new Date(ms));
}

/** `3:00 to 5:17 PM`, or `11:45 AM to 5:00 PM` across noon. */
export function timeSpanLabel(startMs: number, endMs: number): string {
  const start = formatChicagoTime(startMs);
  const end = formatChicagoTime(endMs);
  return start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)} to ${end}` : `${start} to ${end}`;
}

/** `Today`, `Tomorrow` or `Tue, Dec 1`, by Chicago dates. */
export function scheduleDayLabel(ms: number, nowMs: number): string {
  const key = chicagoDateKey(ms);
  if (key === chicagoDateKey(nowMs)) {
    return 'Today';
  }
  if (key === chicagoDateKey(nowMs + 24 * 60 * 60_000)) {
    return 'Tomorrow';
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: CHICAGO, weekday: 'short', month: 'short', day: 'numeric' })
    .format(new Date(ms));
}

/** `Orange & Green Lines` / `Red Line`. */
export function trainLinesLabel(lines: readonly string[]): string {
  const names = lines.map(code => TRAIN_LINE_SHORT_NAMES[code] ?? code);
  return `${names.join(' & ')} Line${names.length > 1 ? 's' : ''}`;
}

/** `#22 Clark & #97 Skokie`. */
export function busRoutesLabel(routes: readonly { route: string; name: string }[]): string {
  return routes.map(r => `#${r.route} ${r.name}`).join(' & ');
}
