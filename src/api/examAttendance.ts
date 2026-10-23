// Typed requests for exam attendance (backend ENDPOINTS.md §7d, §7e). `tenantId` is attached by the client
// (selected school) as a query param on every call, including the PUT: the DTO has no `tenantId` field.
import { apiGet, apiPut } from './client';
import type {
  ExamAttendanceExam,
  ExamAttendanceRoster,
  ExamAttendanceRow,
  ExamAttendanceSaveRequest,
  ExamAttendanceSaveResult,
} from './types/examAttendance';

export interface ExamAttendanceRosterQuery {
  examId: string;
  examSubjectId: string;
  /** null = no narrowing (the whole roster the caller may record). */
  sectionId: string | null;
}

/**
 * `GET /portal/teacher/exam-attendance` — the published exams, with their active papers, that the caller may
 * record: every one for `exam_attendance.mark_any`, otherwise those that overlap a class or section they are
 * assigned to. The server decides which; the roster and the save check the scope again on every request.
 * `exam_attendance.mark` is required (403 otherwise).
 */
export const getExamAttendanceExams = () => apiGet<ExamAttendanceExam[]>('/portal/teacher/exam-attendance');

// The roster also carries each student's daily-attendance status (a web-only reference) and ids the screen does not
// read. Only the names and the exam record are kept (query data is persisted on the device).
const toRow = (row: ExamAttendanceRow): ExamAttendanceRow => ({
  enrollmentId: row.enrollmentId,
  fullName: row.fullName,
  admissionNumber: row.admissionNumber,
  rollNumber: row.rollNumber ?? null,
  record: row.record
    ? { status: row.record.status, remarks: row.record.remarks ?? null, version: row.record.version }
    : null,
});

/**
 * `GET /academic/exams/:examId/attendance?examSubjectId=&sectionId=` — the students the caller may record for
 * this paper, in roll order. `sectionId` only narrows the roster; it can never widen what the server allows.
 */
export async function getExamAttendanceRoster({
  examId,
  examSubjectId,
  sectionId,
}: ExamAttendanceRosterQuery): Promise<ExamAttendanceRoster> {
  const parts = [`examSubjectId=${encodeURIComponent(examSubjectId)}`];
  if (sectionId) parts.push(`sectionId=${encodeURIComponent(sectionId)}`);
  const roster = await apiGet<ExamAttendanceRoster>(
    `/academic/exams/${encodeURIComponent(examId)}/attendance?${parts.join('&')}`,
  );
  return {
    exam: { id: roster.exam.id, name: roster.exam.name, status: roster.exam.status },
    examSubject: roster.examSubject,
    editable: roster.editable,
    rows: roster.rows.map(toRow),
  };
}

/**
 * `PUT /academic/exams/:examId/attendance` — one paper, all-or-nothing, 1–500 rows. A refused batch resolves
 * as `{ ok: false, failures }` (it is not an ApiError): the caller must branch on `ok`. A student outside the
 * caller's classes makes the whole request 403.
 */
export const putExamAttendance = (examId: string, body: ExamAttendanceSaveRequest) =>
  apiPut<ExamAttendanceSaveResult>(`/academic/exams/${encodeURIComponent(examId)}/attendance`, body);
