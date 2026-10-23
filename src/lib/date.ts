// The ONE date module (.claude/rules/mobile-frontend.md §5). Port of the web adapters in
// apps/web/src/lib/calendar.ts over the same `nepali-date-converter` package the backend uses.
// Canonical value everywhere is AD `YYYY-MM-DD`; BS is only ever a display/entry concern at the edge.
// Never format a date inline in a screen — go through here.
import NepaliDate, { dateConfigMap } from 'nepali-date-converter';

/** Tenant setting value (`gregorian` | `nepali`) — read from the API, never hardcoded. */
export type CalendarPreference = 'gregorian' | 'nepali';

export const BS_MONTHS = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Aswin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export const AD_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const BS_YEARS = Object.keys(dateConfigMap)
  .map(Number)
  .sort((a, b) => a - b);

/** Supported BS range comes from the converter (BS 2000–2090) — read it here, never hardcode. */
export const BS_MIN_YEAR = BS_YEARS[0]!;
export const BS_MAX_YEAR = BS_YEARS[BS_YEARS.length - 1]!;

/** Local date parts, not `toISOString` (UTC would shift the day west of UTC). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Calendar-agnostic triple; `month` is 0-indexed in both calendars. */
export interface CalendarDate {
  year: number;
  month: number;
  date: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  return ISO_RE.test(value);
}

/**
 * An AD ISO date moved by whole days (negative = earlier), via local date parts so DST and the
 * device timezone cannot shift it. A malformed input comes back unchanged. Screens never do date
 * arithmetic themselves.
 */
export function shiftIsoDate(iso: string, days: number): string {
  const match = ISO_RE.exec(iso);
  if (!match) return iso;
  return toIsoDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** An AD `YYYY-MM` moved by whole months (negative = earlier). A malformed input comes back unchanged. */
export function shiftMonth(month: string, months: number): string {
  const match = MONTH_RE.exec(month);
  if (!match) return month;
  const moved = new Date(Number(match[1]), Number(match[2]) - 1 + months, 1);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
}

/** "October 2026" for an AD `YYYY-MM` (the month the backend filtered by); the input if malformed. */
export function formatMonth(month: string): string {
  const match = MONTH_RE.exec(month);
  const name = match ? AD_MONTHS[Number(match[2]) - 1] : undefined;
  return match && name ? `${name} ${match[1]}` : month;
}

/** BS parts → canonical AD ISO. */
export function bsToAdIso(year: number, month: number, day: number): string {
  return toIsoDate(new NepaliDate(year, month, day).toJsDate());
}

/** Days in a BS month, from the library's own table (month lengths vary by year). */
export function daysInBsMonth(year: number, month: number): number {
  const key = BS_MONTHS[month] as keyof (typeof dateConfigMap)[number];
  return dateConfigMap[year]?.[key] ?? 30;
}

/**
 * AD range the converter's tables cover (BS 2000-01-01 … last day of BS 2090). The library does NOT
 * throw outside it — it returns a wrong date — so we guard on these bounds ourselves.
 */
export const BS_MIN_AD_ISO = bsToAdIso(BS_MIN_YEAR, 0, 1);
export const BS_MAX_AD_ISO = bsToAdIso(BS_MAX_YEAR, 11, daysInBsMonth(BS_MAX_YEAR, 11));

/** AD ISO → BS parts, or null when the date is malformed or outside the converter's BS range. */
export function adIsoToBs(iso: string): CalendarDate | null {
  if (!isIsoDate(iso) || iso < BS_MIN_AD_ISO || iso > BS_MAX_AD_ISO) return null;
  try {
    const bs = NepaliDate.fromAD(new Date(`${iso}T00:00:00`)).getBS();
    return { year: bs.year, month: bs.month, date: bs.date };
  } catch {
    return null;
  }
}

function formatParts({ year, month, date }: CalendarDate): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

/**
 * Display text for a canonical AD ISO date in the tenant's calendar: `YYYY-MM-DD` in either calendar.
 * Falls back to the AD text when BS is requested but the date is outside the converter's range.
 */
export function formatDate(iso: string, calendar: CalendarPreference): string {
  if (calendar === 'nepali') {
    const bs = adIsoToBs(iso);
    if (bs) return formatParts(bs);
  }
  return iso;
}

/**
 * The day of the month and the first three letters of the month name, in the tenant's calendar: the two lines of a
 * date badge ("01" over "Mar"). Falls back to AD when BS is requested but the date is outside the converter's range.
 */
export function formatDayMonth(iso: string, calendar: CalendarPreference): { day: string; month: string } {
  const bs = calendar === 'nepali' ? adIsoToBs(iso) : null;
  const ad = ISO_RE.exec(iso);
  if (!bs && !ad) return { day: iso, month: '' };
  const monthIndex = bs ? bs.month : Number(ad![2]) - 1;
  const day = bs ? bs.date : Number(ad![3]);
  const names: readonly string[] = bs ? BS_MONTHS : AD_MONTHS;
  return { day: String(day).padStart(2, '0'), month: names[monthIndex]!.slice(0, 3) };
}

/** The other calendar's text, for the long-press / secondary line; null if not representable. */
export function formatAlternateDate(iso: string, calendar: CalendarPreference): string | null {
  if (calendar === 'nepali') return isIsoDate(iso) ? iso : null;
  const bs = adIsoToBs(iso);
  return bs ? formatParts(bs) : null;
}

/**
 * Device-local "09:42" for today, "2026-10-19 09:42" (tenant calendar) for any other day — the
 * "updated / saved at" text. Time display must not be formatted inline in a screen.
 */
export function formatTimestamp(ms: number, calendar: CalendarPreference): string {
  const moment = new Date(ms);
  const time = `${String(moment.getHours()).padStart(2, '0')}:${String(moment.getMinutes()).padStart(2, '0')}`;
  const iso = toIsoDate(moment);
  return iso === todayIso() ? time : `${formatDate(iso, calendar)} ${time}`;
}
