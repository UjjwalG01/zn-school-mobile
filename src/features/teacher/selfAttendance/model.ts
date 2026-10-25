// Pure helpers for My Attendance (teacher.selfAttendance). The backend decides everything: who the
// caller is, which day is today, whether a day is a school day. The app shows what it returns.
import { ApiError, errorAction } from '../../../api/errors';
import type { AttendanceStatus, StaffAttendanceRecord } from '../../../api/types/attendance';
import type { MessageKey } from '../../../i18n';

export const recordFor = (records: readonly StaffAttendanceRecord[], date: string) =>
  records.find((record) => record.attendanceDate === date);

/** Inserts or replaces one day's record and keeps the list in date order. */
export function upsertRecord(
  records: readonly StaffAttendanceRecord[],
  record: StaffAttendanceRecord,
): StaffAttendanceRecord[] {
  return [...records.filter((other) => other.attendanceDate !== record.attendanceDate), record].sort(
    (a, b) => a.attendanceDate.localeCompare(b.attendanceDate),
  );
}

/** "Absent 1 · Present 12": one count per status in the month, ordered by status so the line reads the same each month. */
export function statusSummary(
  records: readonly StaffAttendanceRecord[],
  label: (status: AttendanceStatus) => string,
): string {
  const counts = new Map<AttendanceStatus, number>();
  for (const { status } of records) counts.set(status, (counts.get(status) ?? 0) + 1);
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${label(status)} ${count}`)
    .join(' · ');
}

/** The order of the statuses in the dashboard chart; also the statuses it knows. */
export const CHART_STATUSES: readonly AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'excused'];

/**
 * One count per status for the loaded month (a count of the backend's records, no rule of its own) and how many days
 * have a record at all. A status the app does not know is counted in `recorded` only, so it is never silently a "present".
 */
export function monthTotals(records: readonly StaffAttendanceRecord[]): {
  recorded: number;
  counts: Record<AttendanceStatus, number>;
} {
  const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, half_day: 0, excused: 0 };
  for (const { status } of records) if (status in counts) counts[status] += 1;
  return { recorded: records.length, counts };
}

/** 404 on `/attendance/staff/self`: the account is not linked to a staff member. */
export const isNotLinked = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 404;

/** Why "Mark present" failed, as a message. Branches on status and `errorCode`, never on message text. */
export function markErrorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return 'selfAttendance.saveFailed';
  if (error.status === 404) return 'selfAttendance.notLinked';
  if (error.errorCode === 'ATTENDANCE_ALREADY_RECORDED') return 'selfAttendance.alreadyRecorded';
  switch (errorAction(error)) {
    case 'offline':
      return 'selfAttendance.offline';
    case 'conflict': // any other 409: the staff member is not active
      return 'selfAttendance.inactive';
    case 'validation': // 400: a holiday, a weekly off, or "present" switched off
      return 'selfAttendance.refused';
    default:
      return 'selfAttendance.saveFailed';
  }
}
