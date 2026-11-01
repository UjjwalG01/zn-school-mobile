import type { CalendarItem } from '../../api/types/calendar';

/** The AD `YYYY-MM` month a notification's day falls in, or the current month when there is no day. */
export const monthFor = (day: string | undefined, now: string): string =>
  day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.slice(0, 7) : now.slice(0, 7);

/** Events and holidays sorted by their first day; items on one day keep the server's order. */
export const byStartDate = (items: readonly CalendarItem[]): CalendarItem[] =>
  [...items].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
