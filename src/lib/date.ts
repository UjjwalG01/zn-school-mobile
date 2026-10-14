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

/** The other calendar's text, for the long-press / secondary line; null if not representable. */
export function formatAlternateDate(iso: string, calendar: CalendarPreference): string | null {
  if (calendar === 'nepali') return isIsoDate(iso) ? iso : null;
  const bs = adIsoToBs(iso);
  return bs ? formatParts(bs) : null;
}
