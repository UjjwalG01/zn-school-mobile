// Guardian stack routes. A child's id travels in the path; a result also carries its child, so the detail reads that child's list.

/** The child's profile (a stack screen, opened from Home). */
export const guardianStudentHref = (studentId: string) =>
  ({ pathname: '/guardian/students/[studentId]', params: { studentId } }) as const;

/** One released result of a child (a stack screen, opened from Results). */
export const guardianResultHref = (studentId: string, resultId: string) =>
  ({ pathname: '/guardian/results/[resultId]', params: { studentId, resultId } }) as const;

/** The notification inbox (opened by the header bell and by a notification row). */
export const GUARDIAN_INBOX_HREF = '/guardian/inbox' as const;

/** The notices list (opened from Home and from a notice notification). */
export const GUARDIAN_NOTICES_HREF = '/guardian/notices' as const;

/** The calendar, optionally on the month of one day (a notification's `referenceDate`). */
export const guardianCalendarHref = (day: string | null) =>
  day ? ({ pathname: '/guardian/calendar', params: { day } }) as const : ('/guardian/calendar' as const);
