// Typed requests for /portal/* (docs/api/API_CONTRACT.md §3; backend ENDPOINTS.md §7e).
// `tenantId` is attached by the client (selected school).
import { toCalendarFeed, type RawCalendar } from './calendar';
import { apiGet, apiGetBytes } from './client';
import type { CalendarFeed } from './types/calendar';
import type { TeacherExam, TeacherMyClasses, TeacherStudent } from './types/portal';

/** One student linked to the caller (`GET /portal/guardian/students`): every link, one row each. Placement is null without an enrollment. */
export interface GuardianStudent {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  relationship: string;
  isPrimary: boolean;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
}

/** `GET /portal/guardian/students` — the children linked to the signed-in guardian in the selected school. Needs `portal.student.read`. */
export const getGuardianStudents = () => apiGet<GuardianStudent[]>('/portal/guardian/students');

/** `GET /portal/guardian/students/:studentId` — the child's own record and placements. No other guardian's details. */
export interface GuardianStudentProfile {
  student: {
    id: string;
    admissionNumber: string;
    fullName: string;
    dateOfBirth: string | null;
    gender: string | null;
    status: string;
  };
  enrollments: {
    id: string;
    academicYearLabel: string;
    className: string;
    sectionName: string | null;
    status: string;
    rollNumber: string | null;
    enrolledAt: string;
    exitedAt: string | null;
  }[];
}

/** One day of a child's attendance in the requested range. `kind` tells a school day from a weekly off or a holiday. */
export interface GuardianAttendanceDay {
  date: string;
  status: string;
  kind: string;
}

export interface GuardianAttendanceEnrollment {
  enrollmentId: string;
  schoolDays: number;
  counts: Record<string, number>;
  notRecorded: number;
  percentage: string | null;
  days: GuardianAttendanceDay[];
}

/** `GET /portal/guardian/students/:studentId/attendance` (ADR-0081 D5): the school's own status labels, no thresholds. */
export interface GuardianAttendance {
  student: { id: string; fullName: string; admissionNumber: string };
  enrollments: GuardianAttendanceEnrollment[];
  statusLabels: Record<string, { label: string; shortCode: string }>;
}

export interface GuardianResultComponent {
  subjectName: string;
  componentName: string;
  obtainedMarks: string;
  maxMarks: string;
  passMarks: string | null;
}

/** One released result (`published` or `locked`). Amounts and percentages are the server's strings; the app does no arithmetic. */
export interface GuardianResult {
  resultId: string;
  examId: string;
  examName: string;
  sessionName: string;
  academicYearLabel: string;
  className: string;
  sectionName: string | null;
  status: string;
  totalObtained: string;
  totalMax: string;
  percentage: string;
  grade: string | null;
  passStatus: string;
  publishedAt: string | null;
  components: GuardianResultComponent[];
}

/**
 * `GET /portal/guardian/students/:studentId/fees` as the server returns it today. The app reads only the position's money
 * totals and the newest payment's date and amount; it never shows invoice rows or receipt numbers (owner requirement 2026-10-31).
 */
export interface GuardianFees {
  position: {
    studentId: string;
    receivable: string;
    advance: string;
    netOutstanding: string;
    totals: { invoiced: string; paid: string; refunded: string; openingBalance: string };
  };
  payments: {
    rows: { paymentDate: string; amount: string }[];
    total: number;
  };
}

/** `GET /portal/guardian/students/:studentId/attendance` for one month (dates are `YYYY-MM-DD`). */
export const getGuardianAttendance = (studentId: string, dateFrom: string, dateTo: string) =>
  apiGet<GuardianAttendance>(
    `/portal/guardian/students/${encodeURIComponent(studentId)}/attendance?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  );

/** `GET /portal/guardian/students/:studentId` — the child's profile. */
export const getGuardianStudent = (studentId: string) =>
  apiGet<GuardianStudentProfile>(`/portal/guardian/students/${encodeURIComponent(studentId)}`);

/** `GET /portal/guardian/students/:studentId/results` — released results, newest first. */
export const getGuardianResults = (studentId: string) =>
  apiGet<GuardianResult[]>(`/portal/guardian/students/${encodeURIComponent(studentId)}/results`);

/** `GET /portal/guardian/calendar?from&to` — events and holidays that touch the window (no internal notes, no leave). */
export const getGuardianCalendar = async (from: string, to: string): Promise<CalendarFeed> =>
  toCalendarFeed(
    await apiGet<RawCalendar>(`/portal/guardian/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  );

/** One row of `GET /portal/guardian/advance`: the caller's own advance as a guardian. `[]` when the login has no guardian record. */
export interface GuardianAdvance {
  guardianId: string;
  name: string;
  advance: string;
}

/** `GET /portal/guardian/advance` — shown on Home only when a row exists, never added to a child's figures. */
export const getGuardianAdvance = () => apiGet<GuardianAdvance[]>('/portal/guardian/advance');

/**
 * `GET /portal/guardian/results/:id/marksheet` — the released result's marksheet as PDF bytes. The server checks that the result
 * belongs to a child linked to this account: another family's result, a result not yet released and an unknown id all answer 403.
 * A released result whose marksheet was never issued answers 404 `DOCUMENT_NOT_ISSUED`. Ten a minute (rate bucket `pdf`).
 */
export const getGuardianMarksheet = (resultId: string) =>
  apiGetBytes(`/portal/guardian/results/${encodeURIComponent(resultId)}/marksheet`);

/** `GET /portal/guardian/students/:studentId/fees`. `pageSize=1` keeps the payments part to the newest payment. */
export const getGuardianFees = (studentId: string) =>
  apiGet<GuardianFees>(`/portal/guardian/students/${encodeURIComponent(studentId)}/fees?pageSize=1`);


/** `GET /portal/teacher/my-classes?date=` — class placements + subject assignments. `date` is `YYYY-MM-DD`. */
export const getTeacherMyClasses = (date: string) =>
  apiGet<TeacherMyClasses>(`/portal/teacher/my-classes?date=${encodeURIComponent(date)}`);

/**
 * `GET /portal/teacher/exams` — exams open for marks entry with the caller's subjects and submission
 * state. 403 for an account with no staff link and no `exam_result.save_any`.
 */
export const getTeacherExams = () => apiGet<TeacherExam[]>('/portal/teacher/exams');

/**
 * `GET /portal/teacher/students/:studentId` — one student of a class or section the caller teaches (or
 * any student with `attendance.mark_any`). 403 for any other student, an unlinked account and an id that
 * does not exist (the same answer); 404 only for a `mark_any` holder and a missing id.
 *
 * The response also carries each guardian's e-mail and the class and section ids; they are not kept
 * (STUDENT_INFO_PLAN SI-D2), so they can never reach a cache.
 */
export async function getTeacherStudent(studentId: string): Promise<TeacherStudent> {
  const body = await apiGet<TeacherStudent>(`/portal/teacher/students/${encodeURIComponent(studentId)}`);
  const { student } = body;
  return {
    student: {
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth ?? null,
      gender: student.gender ?? null,
      bloodGroup: student.bloodGroup ?? null,
      status: student.status,
    },
    guardians: body.guardians.map((guardian) => ({
      guardianId: guardian.guardianId,
      fullName: guardian.fullName,
      phone: guardian.phone ?? null,
      relationship: guardian.relationship,
      isPrimary: guardian.isPrimary,
    })),
    enrollments: body.enrollments.map((enrollment) => ({
      id: enrollment.id,
      academicYearLabel: enrollment.academicYearLabel,
      className: enrollment.className,
      sectionName: enrollment.sectionName ?? null,
      status: enrollment.status,
      rollNumber: enrollment.rollNumber ?? null,
    })),
  };
}
