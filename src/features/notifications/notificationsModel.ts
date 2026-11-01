// Pure helpers for the notification inbox. The backend decides who is told what; the app lists the rows it is given,
// marks one read, and opens the screen a row points at when the app has one.
import type { AppNotification, NotificationPage } from '../../api/types/notifications';
import type { MessageKey } from '../../i18n';

/** Where a tap can go. `calendar` is the Academic Calendar, which lists the events coming up and the latest notices. */
export type NotificationDestination = 'calendar';

const TYPE_KEY: Record<string, MessageKey> = {
  school_event: 'notifications.type.school_event',
  notice_published: 'notifications.type.notice_published',
  leave_submitted: 'notifications.type.leave_submitted',
  leave_decided: 'notifications.type.leave_decided',
  student_absent: 'notifications.type.student_absent',
  results_published: 'notifications.type.results_published',
  holiday_changed: 'notifications.type.holiday_changed',
  invoice_issued: 'notifications.type.invoice_issued',
  payment_recorded: 'notifications.type.payment_recorded',
};

export const typeLabelKey = (type: string): MessageKey => TYPE_KEY[type] ?? 'notifications.type.other';

/**
 * The screen a notification opens, or null when the app has none for it. An event or a notice is shown by the Calendar
 * screen (a notice has no screen of its own, and the notification carries no date to open a day with). A leave request,
 * an absence or a result belongs to a screen this app does not have for staff: the row is read, nothing opens.
 * `calendarVisible` is the usual UX hint (the backend still answers for the calendar read).
 */
export function destinationFor(
  notification: Pick<AppNotification, 'type'>,
  { calendarVisible }: { calendarVisible: boolean },
): NotificationDestination | null {
  const isCalendarItem = notification.type === 'school_event' || notification.type === 'notice_published';
  return isCalendarItem && calendarVisible ? 'calendar' : null;
}

/** The cached page after the server confirmed a read: that row gets its time and the badge drops by one. Idempotent. */
export function applyRead(page: NotificationPage, id: string, readAt: string): NotificationPage {
  const row = page.rows.find((candidate) => candidate.id === id);
  if (!row || row.readAt !== null) return page;
  return {
    ...page,
    rows: page.rows.map((candidate) => (candidate.id === id ? { ...candidate, readAt } : candidate)),
    unread: Math.max(page.unread - 1, 0),
  };
}

/** The badge text: nothing for zero, "99+" past two digits so it never outgrows the bell. */
export const badgeText = (unread: number): string => (unread <= 0 ? '' : unread > 99 ? '99+' : String(unread));
