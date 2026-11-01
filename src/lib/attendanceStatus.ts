// The one tone per attendance status, shared by the teacher and guardian attendance lists (moved out of the teacher feature so
// guardian code does not import teacher code; GUARDIAN_V1_PLAN §8).
import type { AttendanceStatus } from '../api/types/attendance';
import type { BadgeTone } from '../components/StatusBadge';

/** Fixed enum → tone. The text label is always shown beside it; colour is never the only signal. */
export const STATUS_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  half_day: 'warning',
  excused: 'neutral',
};
