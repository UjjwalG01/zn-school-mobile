// `GET /portal/notifications` (backend ENDPOINTS.md §7f, ADR-0069). The inbox is a pointer to something that lives elsewhere
// (an event, a notice, a leave request): the app owns none of it, and the owning module is the source of truth.

/** What `referenceId` points at. The backend may add types; an unknown one still lists, with no destination. */
export type NotificationType =
  | 'student_absent'
  | 'results_published'
  | 'notice_published'
  | 'school_event'
  | 'leave_submitted'
  | 'leave_decided';

export interface AppNotification {
  id: string;
  /** Kept as the backend sent it; compare with `NotificationType`. */
  type: string;
  referenceId: string;
  title: string;
  /** ISO timestamp, or null while unread. */
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  rows: AppNotification[];
  /** All rows of this person in this school, not only this page. */
  total: number;
  /** All unread rows, whatever the page: the badge. */
  unread: number;
}
