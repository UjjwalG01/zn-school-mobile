// Pure model for the Academic Calendar (docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md). The app draws the month
// the school's own calendar (Gregorian or Bikram Sambat) calls a month; every date it stores or sends is the
// canonical AD `YYYY-MM-DD`, and `lib/date.ts` does all the conversion. Which items a person sees is decided by the
// server (audience, staff type, class assignment); nothing here filters by role.
import type { CalendarItem } from '../../../api/types/calendar';
import type { ColorTokens } from '../../../theme/tokens';
import {
  AD_MONTHS,
  adIsoToBs,
  BS_MAX_YEAR,
  BS_MIN_YEAR,
  BS_MONTHS,
  bsToAdIso,
  type CalendarPreference,
  daysInBsMonth,
  shiftIsoDate,
  toIsoDate,
} from '../../../lib/date';

/** A month of the school's calendar; `month` is 0-indexed in both calendars. */
export interface MonthRef {
  year: number;
  month: number;
}

export interface DayCell {
  day: number;
  /** AD `YYYY-MM-DD`. */
  iso: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

export interface MonthLayout {
  title: string;
  /** First and last day of the month as AD `YYYY-MM-DD`: the window `GET /calendar` is asked for. */
  first: string;
  last: string;
  /** Rows of seven; a null is a blank before the 1st or after the last day. */
  weeks: (DayCell | null)[][];
}

const AD_MIN_YEAR = 1900;
const AD_MAX_YEAR = 2100;

const parts = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return { y, m, d };
};
/** 0 = Sunday … 6 = Saturday, from the ISO date's own parts (the device timezone cannot move it). */
export const weekdayOf = (iso: string): number => {
  const { y, m, d } = parts(iso);
  return new Date(y, m - 1, d).getDay();
};

/**
 * The month `iso` falls in, in the school's calendar. A Bikram Sambat school whose date the converter cannot
 * place (outside BS 2000-2090) falls back to the Gregorian month, as `formatDate` does.
 */
export function monthOf(iso: string, calendar: CalendarPreference): MonthRef {
  if (calendar === 'nepali') {
    const bs = adIsoToBs(iso);
    if (bs) return { year: bs.year, month: bs.month };
  }
  const { y, m } = parts(iso);
  return { year: y, month: m - 1 };
}

/** Which calendar actually draws this month (a BS month is only drawable inside the converter's range). */
const usesBs = (calendar: CalendarPreference, ref: MonthRef) =>
  calendar === 'nepali' && ref.year >= BS_MIN_YEAR && ref.year <= BS_MAX_YEAR;

/** `ref` moved by whole months, or null when that is outside what the calendar can draw (the arrows then disable). */
export function shiftMonthRef(ref: MonthRef, delta: number, calendar: CalendarPreference): MonthRef | null {
  const total = ref.year * 12 + ref.month + delta;
  const next = { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  const [min, max] = calendar === 'nepali' ? [BS_MIN_YEAR, BS_MAX_YEAR] : [AD_MIN_YEAR, AD_MAX_YEAR];
  return next.year < min || next.year > max ? null : next;
}

export function layoutMonth(ref: MonthRef, calendar: CalendarPreference): MonthLayout {
  const bs = usesBs(calendar, ref);
  const first = bs ? bsToAdIso(ref.year, ref.month, 1) : toIsoDate(new Date(ref.year, ref.month, 1));
  const length = bs ? daysInBsMonth(ref.year, ref.month) : new Date(ref.year, ref.month + 1, 0).getDate();
  const lead = weekdayOf(first);
  const days: (DayCell | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, index): DayCell => {
      const iso = shiftIsoDate(first, index);
      return { day: index + 1, iso, weekday: weekdayOf(iso) };
    }),
  ];
  while (days.length % 7 !== 0) days.push(null);
  return {
    title: `${(bs ? BS_MONTHS : AD_MONTHS)[ref.month]} ${ref.year}`,
    first,
    last: shiftIsoDate(first, length - 1),
    weeks: Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7)),
  };
}

/** Items (holidays first, as the API client orders them) that cover `iso`. Dates are ISO, so string order is date order. */
export const itemsOn = (items: readonly CalendarItem[], iso: string): CalendarItem[] =>
  items.filter((item) => item.startDate <= iso && iso <= item.endDate);

/**
 * Upcoming events and holidays, soonest first: those that have not ended by `today`. Approved leave is a personal note
 * on the day it falls, not an "upcoming event", so it stays out of this list.
 */
export function upcomingItems(items: readonly CalendarItem[], today: string, limit: number): CalendarItem[] {
  return items
    .filter((item) => item.kind !== 'leave' && item.endDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.title.localeCompare(b.title)))
    .slice(0, limit);
}

/** The server's colour token → a theme colour. The item always names its type in words, so colour is never the only signal. */
export function colorFor(token: string, colors: ColorTokens): string {
  switch (token) {
    case 'green':
      return colors.success;
    case 'amber':
      return colors.warning;
    case 'red':
      return colors.destructive;
    case 'purple':
      return colors.brand;
    case 'gray':
      return colors.textMuted;
    default:
      return colors.accent; // blue and any token the app does not know
  }
}
