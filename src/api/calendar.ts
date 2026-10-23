// Typed requests for the school calendar and notices (docs/api/API_CONTRACT.md §5; backend ENDPOINTS.md §7g, §7f).
// `tenantId` is attached by the client (selected school). Reads only: the app owns no event, holiday or notice.
import { apiGet } from './client';
import type { CalendarFeed, CalendarItem, NoticePage } from './types/calendar';

// The live response is wider than the screens need: an `event.manage` holder also gets `internalNotes` and
// the audience flags, and a leave item names the staff member. Query data is persisted on the device for
// days, so only what the screens read is kept.
interface RawEvent {
  kind: 'event';
  id: string;
  title: string;
  type: { label: string; color: string };
  startDate: string;
  endDate: string;
  description: string | null;
}
interface RawHoliday {
  kind: 'holiday';
  id: string;
  name: string;
  type: { name: string; color: string };
  startDate: string;
  endDate: string;
  description: string | null;
}
interface RawLeave {
  kind: 'leave';
  id: string;
  staffName: string;
  type: { name: string; color: string };
  startDate: string;
  endDate: string;
}
interface RawCalendar {
  from: string;
  to: string;
  events: RawEvent[];
  holidays: RawHoliday[];
  leave: RawLeave[];
  weeklyOff: number[];
}

const fromEvent = (e: RawEvent): CalendarItem => ({
  kind: 'event',
  id: e.id,
  title: e.title,
  typeLabel: e.type.label,
  color: e.type.color,
  startDate: e.startDate,
  endDate: e.endDate,
  description: e.description ?? null,
});
const fromHoliday = (h: RawHoliday): CalendarItem => ({
  kind: 'holiday',
  id: h.id,
  title: h.name,
  typeLabel: h.type.name,
  color: h.type.color,
  startDate: h.startDate,
  endDate: h.endDate,
  description: h.description ?? null,
});
const fromLeave = (l: RawLeave): CalendarItem => ({
  kind: 'leave',
  id: l.id,
  title: `${l.staffName}: ${l.type.name}`,
  typeLabel: l.type.name,
  color: l.type.color,
  startDate: l.startDate,
  endDate: l.endDate,
  description: null,
});

/**
 * `GET /calendar?from=&to=` — events, holidays and approved leave that overlap the window, already filtered
 * for this reader. `from`/`to` are AD `YYYY-MM-DD`, at most 400 days apart (the server answers 400 otherwise).
 * Needs `calendar.read`; a plain 403 is "no access", not an empty calendar. Holidays come first on a day, then
 * events, then leave (the order the web calendar uses).
 */
export async function getCalendar(from: string, to: string): Promise<CalendarFeed> {
  const raw = await apiGet<RawCalendar>(`/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  return {
    from: raw.from,
    to: raw.to,
    items: [...raw.holidays.map(fromHoliday), ...raw.events.map(fromEvent), ...raw.leave.map(fromLeave)],
    weeklyOff: raw.weeklyOff,
  };
}

/**
 * `GET /portal/notices?page=&pageSize=` — published, active notices this person may read, newest first. The
 * server applies the audience (staff and all) and any class or section scope; the app filters nothing.
 */
export async function getNotices(pageSize: number): Promise<NoticePage> {
  const page = await apiGet<{
    rows: { id: string; title: string; body: string; publishedAt: string }[];
    total: number;
  }>(`/portal/notices?page=1&pageSize=${pageSize}`);
  return {
    rows: page.rows.map(({ id, title, body, publishedAt }) => ({ id, title, body, publishedAt })),
    total: page.total,
  };
}
