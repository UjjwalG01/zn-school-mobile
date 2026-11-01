import type { CalendarItem } from '../../../../api/types/calendar';
import { BS_MAX_YEAR, bsToAdIso, daysInBsMonth } from '../../../../lib/date';
import { lightColors } from '../../../../theme/tokens';
import { colorFor, itemsOn, layoutMonth, monthOf, shiftMonthRef, upcomingItems, weekdayOf } from '../../../calendar/calendarModel';

const item = (overrides: Partial<CalendarItem> & Pick<CalendarItem, 'id'>): CalendarItem => ({
  kind: 'event',
  title: overrides.id,
  typeLabel: 'Event',
  color: 'blue',
  startDate: '2026-10-10',
  endDate: '2026-10-10',
  description: null,
  ...overrides,
});

describe('monthOf', () => {
  it('names the month a day falls in, in the school’s calendar', () => {
    expect(monthOf('2026-04-14', 'gregorian')).toEqual({ year: 2026, month: 3 });
    // The first day of the Nepali year 2083.
    expect(monthOf('2026-04-14', 'nepali')).toEqual({ year: 2083, month: 0 });
    expect(monthOf('2026-04-13', 'nepali')).toEqual({ year: 2082, month: 11 });
  });

  it('falls back to the Gregorian month when the Nepali converter cannot place the date', () => {
    expect(monthOf('1800-01-15', 'nepali')).toEqual({ year: 1800, month: 0 });
  });
});

describe('layoutMonth', () => {
  it('draws a Gregorian month in weeks of seven, with blanks before the 1st and after the last day', () => {
    const layout = layoutMonth({ year: 2026, month: 9 }, 'gregorian');
    expect(layout.title).toBe('October 2026');
    expect([layout.first, layout.last]).toEqual(['2026-10-01', '2026-10-31']);
    expect(layout.weeks.every((week) => week.length === 7)).toBe(true);
    // 1 October 2026 is a Thursday: four blanks first.
    expect(layout.weeks[0]!.slice(0, 4)).toEqual([null, null, null, null]);
    expect(layout.weeks[0]![4]).toEqual({ day: 1, iso: '2026-10-01', weekday: 4 });
    const days = layout.weeks.flat().filter((cell) => cell !== null);
    expect(days).toHaveLength(31);
    expect(days.at(-1)).toMatchObject({ day: 31, iso: '2026-10-31' });
  });

  it('draws a leap-year February', () => {
    const layout = layoutMonth({ year: 2028, month: 1 }, 'gregorian');
    expect(layout.last).toBe('2028-02-29');
    expect(layout.weeks.flat().filter(Boolean)).toHaveLength(29);
  });

  it('draws a Bikram Sambat month with its own length, and asks the API for its AD window', () => {
    const layout = layoutMonth({ year: 2083, month: 6 }, 'nepali');
    expect(layout.title).toBe('Kartik 2083');
    expect(layout.first).toBe(bsToAdIso(2083, 6, 1));
    expect(layout.last).toBe(bsToAdIso(2083, 6, daysInBsMonth(2083, 6)));
    expect(layout.weeks.flat().filter(Boolean)).toHaveLength(daysInBsMonth(2083, 6));
    const firstCell = layout.weeks.flat().find(Boolean)!;
    expect(firstCell).toMatchObject({ day: 1, iso: layout.first, weekday: weekdayOf(layout.first) });
  });

  it('never loses a day: consecutive cells are consecutive dates', () => {
    for (const calendar of ['gregorian', 'nepali'] as const) {
      const cells = layoutMonth(monthOf('2026-10-23', calendar), calendar).weeks.flat().filter(Boolean);
      cells.slice(1).forEach((cell, index) => expect(cell!.day).toBe(cells[index]!.day + 1));
    }
  });
});

describe('shiftMonthRef', () => {
  it('crosses the year boundary in both directions', () => {
    expect(shiftMonthRef({ year: 2026, month: 11 }, 1, 'gregorian')).toEqual({ year: 2027, month: 0 });
    expect(shiftMonthRef({ year: 2026, month: 0 }, -1, 'gregorian')).toEqual({ year: 2025, month: 11 });
    expect(shiftMonthRef({ year: 2082, month: 11 }, 1, 'nepali')).toEqual({ year: 2083, month: 0 });
  });

  it('stops at the end of what the Nepali converter knows', () => {
    expect(shiftMonthRef({ year: BS_MAX_YEAR, month: 11 }, 1, 'nepali')).toBeNull();
  });
});

describe('items', () => {
  const items = [
    item({ id: 'holiday', kind: 'holiday', startDate: '2026-10-20', endDate: '2026-10-22' }),
    item({ id: 'trip', startDate: '2026-10-22', endDate: '2026-10-22' }),
    item({ id: 'leave', kind: 'leave', startDate: '2026-10-24', endDate: '2026-10-24' }),
    item({ id: 'old', startDate: '2026-09-01', endDate: '2026-09-02' }),
    item({ id: 'later', startDate: '2026-11-05', endDate: '2026-11-05' }),
  ];

  it('finds the items that cover a day, including a multi-day item on each of its days', () => {
    expect(itemsOn(items, '2026-10-21').map((entry) => entry.id)).toEqual(['holiday']);
    expect(itemsOn(items, '2026-10-22').map((entry) => entry.id)).toEqual(['holiday', 'trip']);
    expect(itemsOn(items, '2026-10-23')).toEqual([]);
  });

  it('lists upcoming events and holidays soonest first, without leave or what has ended', () => {
    expect(upcomingItems(items, '2026-10-21', 10).map((entry) => entry.id)).toEqual(['holiday', 'trip', 'later']);
    expect(upcomingItems(items, '2026-10-21', 2).map((entry) => entry.id)).toEqual(['holiday', 'trip']);
    expect(upcomingItems(items, '2026-12-01', 10)).toEqual([]);
  });
});

describe('colorFor', () => {
  it('maps the server’s colour tokens onto theme colours, and an unknown one onto the accent', () => {
    expect(colorFor('green', lightColors)).toBe(lightColors.success);
    expect(colorFor('amber', lightColors)).toBe(lightColors.warning);
    expect(colorFor('red', lightColors)).toBe(lightColors.destructive);
    expect(colorFor('purple', lightColors)).toBe(lightColors.brand);
    expect(colorFor('gray', lightColors)).toBe(lightColors.textMuted);
    expect(colorFor('blue', lightColors)).toBe(lightColors.accent);
    expect(colorFor('chartreuse', lightColors)).toBe(lightColors.accent);
  });
});
