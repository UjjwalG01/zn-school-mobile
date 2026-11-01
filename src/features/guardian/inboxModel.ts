// Where a guardian's notification leads, from its type and reference (ENDPOINTS §7f). The backend decides who is told what; the app only
// opens a screen it has for the row. A row with no screen here is read and nothing opens: a result names an exam, not a child, so the
// app has no safe place to open it, and staff-only types never reach a guardian.
import type { AppNotification } from '../../api/types/notifications';

export type GuardianDestination =
  | { kind: 'attendance'; studentId: string }
  | { kind: 'calendar'; day: string | null }
  | { kind: 'notices' };

/**
 * `student_absent` opens the child's attendance only when that child is linked to this account (the reference is the student).
 * `school_event` and `holiday_changed` open the calendar on the item's first day when the backend gave one. `notice_published` opens
 * the notices list (there is no notice-by-id route).
 */
export function guardianDestination(
  notification: Pick<AppNotification, 'type' | 'referenceId' | 'referenceDate'>,
  linkedStudentIds: readonly string[],
): GuardianDestination | null {
  switch (notification.type) {
    case 'student_absent':
      return linkedStudentIds.includes(notification.referenceId)
        ? { kind: 'attendance', studentId: notification.referenceId }
        : null;
    case 'school_event':
    case 'holiday_changed':
      return { kind: 'calendar', day: notification.referenceDate ?? null };
    case 'notice_published':
      return { kind: 'notices' };
    default:
      return null;
  }
}
