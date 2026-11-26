import { describe, expect, it } from 'vitest';
import {
  BUS_WATCH_PADDING,
  HOLIDAY_BUS_SCHEDULE,
  HOLIDAY_TRAIN_SCHEDULE,
  TRAIN_WATCH_PADDING,
  busRoutesLabel,
  chicagoDateKey,
  chicagoEpoch,
  formatChicagoTime,
  scheduleDayLabel,
  scheduleView,
  scheduledToday,
  timeSpanLabel,
  trainLinesLabel
} from './holiday-schedule';

/** Intl may put a narrow no-break space before AM/PM. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('chicagoEpoch', () => {
  it('reads Chicago wall-clock time whatever the device zone', () => {
    // 3:00 PM CST is 21:00 UTC.
    expect(chicagoEpoch('2026-11-27', '15:00')).toBe(Date.UTC(2026, 10, 27, 21, 0));
    // Summer, CDT: 3:00 PM is 20:00 UTC.
    expect(chicagoEpoch('2026-07-01', '15:00')).toBe(Date.UTC(2026, 6, 1, 20, 0));
  });

  it('takes the date in Chicago, not UTC', () => {
    // 11:30 PM in Chicago on the 27th is already the 28th in UTC.
    expect(chicagoDateKey(Date.UTC(2026, 10, 28, 5, 30))).toBe('2026-11-27');
  });
});

describe('scheduleView', () => {
  const at = (date: string, time: string) => chicagoEpoch(date, time);

  it('sees a run later today without watching it yet', () => {
    const view = scheduleView(HOLIDAY_TRAIN_SCHEDULE, at('2026-11-27', '12:00'), TRAIN_WATCH_PADDING);
    expect(view.today?.day.lines).toEqual(['Org', 'G']);
    expect(view.watching).toBe(false);
    expect(view.next?.day.date).toBe('2026-11-27');
    expect(scheduledToday(view, at('2026-11-27', '12:00'))).toBe(true);
  });

  it('watches from half an hour before the first departure to 90 min after the last', () => {
    expect(scheduleView(HOLIDAY_TRAIN_SCHEDULE, at('2026-11-27', '14:30'), TRAIN_WATCH_PADDING).watching).toBe(true);
    expect(scheduleView(HOLIDAY_TRAIN_SCHEDULE, at('2026-11-27', '18:47'), TRAIN_WATCH_PADDING).watching).toBe(true);
    expect(scheduleView(HOLIDAY_TRAIN_SCHEDULE, at('2026-11-27', '18:48'), TRAIN_WATCH_PADDING).watching).toBe(false);
  });

  it('moves on to the next scheduled day once today is over', () => {
    const now = at('2026-11-27', '19:00');
    const view = scheduleView(HOLIDAY_TRAIN_SCHEDULE, now, TRAIN_WATCH_PADDING);
    expect(view.next?.day.date).toBe('2026-11-28');
    expect(scheduledToday(view, now)).toBe(false);
  });

  it('has no run on an unscheduled day and none after the season', () => {
    const monday = scheduleView(HOLIDAY_TRAIN_SCHEDULE, at('2026-11-30', '15:00'), TRAIN_WATCH_PADDING);
    expect(monday.today).toBeNull();
    expect(monday.next?.day.date).toBe('2026-12-01');
    const after = scheduleView(HOLIDAY_BUS_SCHEDULE, at('2026-12-23', '12:00'), BUS_WATCH_PADDING);
    expect(after.today).toBeNull();
    expect(after.next).toBeNull();
  });

  it('keeps the bus and train schedules apart', () => {
    // Sunday the 29th: the bus runs, the train does not.
    const now = at('2026-11-29', '13:00');
    expect(scheduleView(HOLIDAY_BUS_SCHEDULE, now, BUS_WATCH_PADDING).watching).toBe(true);
    expect(scheduleView(HOLIDAY_TRAIN_SCHEDULE, now, TRAIN_WATCH_PADDING).today).toBeNull();
  });
});

describe('labels', () => {
  it('names days and times the way the schedule reads', () => {
    const now = chicagoEpoch('2026-11-27', '09:00');
    expect(scheduleDayLabel(chicagoEpoch('2026-11-27', '15:00'), now)).toBe('Today');
    expect(scheduleDayLabel(chicagoEpoch('2026-11-28', '14:32'), now)).toBe('Tomorrow');
    expect(scheduleDayLabel(chicagoEpoch('2026-12-01', '15:50'), now)).toBe('Tue, Dec 1');
    expect(plain(formatChicagoTime(chicagoEpoch('2026-11-27', '15:00')))).toBe('3:00 PM');
    expect(plain(timeSpanLabel(chicagoEpoch('2026-11-27', '15:00'), chicagoEpoch('2026-11-27', '17:17'))))
      .toBe('3:00 to 5:17 PM');
    expect(plain(timeSpanLabel(chicagoEpoch('2026-11-24', '11:45'), chicagoEpoch('2026-11-24', '17:00'))))
      .toBe('11:45 AM to 5:00 PM');
  });

  it('names lines and routes', () => {
    expect(trainLinesLabel(['Org', 'G'])).toBe('Orange & Green Lines');
    expect(trainLinesLabel(['Red'])).toBe('Red Line');
    expect(busRoutesLabel([{ route: '22', name: 'Clark' }, { route: '97', name: 'Skokie' }]))
      .toBe('#22 Clark & #97 Skokie');
  });
});
