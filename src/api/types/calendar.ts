// Hand-written from backend ENDPOINTS.md §7g (`GET /calendar`) and §7f (`GET /portal/notices`). Only the fields the
// screens read: `internalNotes`, `audience` and ids that name other people never reach the device cache.

export type CalendarItemKind = 'event' | 'holiday' | 'leave';

/** One event, holiday or approved leave, already filtered for this reader by the server (audience, staff type, class). */
export interface CalendarItem {
  kind: CalendarItemKind;
  id: string;
  /** Event title, holiday name, or "<staff>: <leave type>". */
  title: string;
  /** The event type, holiday type or "Leave": a second line and the colour's text twin. */
  typeLabel: string;
  /** Token name (`blue`, `green`, `amber`, `red`, `purple`, `gray`): mapped to a theme colour by the screen. */
  color: string;
  /** AD `YYYY-MM-DD`; the real dates, never clipped to the month asked for. */
  startDate: string;
  endDate: string;
  description: string | null;
}

export interface CalendarFeed {
  from: string;
  to: string;
  items: CalendarItem[];
  /** Weekdays (0 = Sunday … 6 = Saturday) the school has switched off. */
  weeklyOff: number[];
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp of publication. */
  publishedAt: string;
}

export interface NoticePage {
  rows: Notice[];
  total: number;
}
