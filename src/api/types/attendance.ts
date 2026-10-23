// Hand-written from backend ENDPOINTS.md §7 and attendance.service.ts (A6). Only fields the app uses.

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'excused';

export interface AttendanceStatusSetting {
  status: AttendanceStatus;
  /** School-defined; never hardcode a label. */
  label: string;
  /** 1–5 characters, for the compact status buttons. */
  shortCode: string;
  sortOrder: number;
  /** false = the school switched it off: it may still be shown on an old record, but not newly picked. */
  active: boolean;
}

export interface AttendanceSettings {
  backdateWindowDays: number;
  statuses: AttendanceStatusSetting[];
}

export interface DayInfo {
  schoolDay: boolean;
  reason: 'weekly_off' | 'holiday' | null;
  holidayName: string | null;
}

export interface RosterRecord {
  id: string;
  status: AttendanceStatus;
  remarks: string | null;
  version: number;
}

export interface RosterRow {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string | null;
  /** The section a save for this row must name (null for a class without sections). */
  sectionId: string | null;
  /** null = nothing saved that day → send `version: 0`. */
  record: RosterRecord | null;
}

export interface AttendanceRoster {
  date: string;
  dayInfo: DayInfo;
  rows: RosterRow[];
}

export interface BulkAttendanceRow {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
  /** The version of the saved record the teacher saw; 0 = none. */
  version: number;
}

export interface BulkAttendanceRequest {
  idempotencyKey: string;
  attendanceDate: string;
  classId: string;
  /** Omitted for a class without sections. There is NO `tenantId` in the body (query only). */
  sectionId?: string;
  records: BulkAttendanceRow[];
}

export interface BulkRowResult {
  studentId: string;
  id: string;
  version: number;
  outcome: 'created' | 'updated' | 'unchanged';
}

export interface BulkRowFailure {
  identifier: { studentId: string; row: number };
  /** English sentence, no error code: display only, never branch on it. */
  error: string;
}

/** A refused batch is a 2xx `{ ok: false }` with nothing written, not an HTTP error. */
export type BulkAttendanceResult =
  | { ok: true; replayed: boolean; results: BulkRowResult[] }
  | { ok: false; failures: BulkRowFailure[] };

// Teacher self attendance (`/attendance/staff/self`, backend ENDPOINTS.md §7b). Confirm the record
// fields on a live response before the screen relies on more than `attendanceDate` and `status`.

/** One day of the caller's own attendance. `source` is `self` for "Mark present", `admin` when a school corrected it. */
export interface StaffAttendanceRecord {
  id: string;
  /** AD `YYYY-MM-DD`. */
  attendanceDate: string;
  status: AttendanceStatus;
  remarks: string | null;
  source: 'self' | 'admin';
  version: number;
}

/** `GET /attendance/staff/self?month=` — the caller's own month and today's state. */
export interface MyAttendance {
  staff: { id: string; staffCode: string; fullName: string; employmentStatus: string };
  /** The school's own today (tenant timezone), AD `YYYY-MM-DD`. */
  today: string;
  todayDay: DayInfo;
  /** AD `YYYY-MM` the records belong to. */
  month: string;
  records: StaffAttendanceRecord[];
}

/** `POST /attendance/staff/self` — a second tap answers `unchanged`. */
export interface MarkPresentResult {
  outcome: 'created' | 'unchanged';
  record: StaffAttendanceRecord;
  day: DayInfo;
}
