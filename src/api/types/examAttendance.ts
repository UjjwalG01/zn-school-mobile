// Hand-written from backend ENDPOINTS.md §7d (exam attendance) and §7e (`GET /portal/teacher/exam-attendance`).
// Exam attendance is separate from daily attendance and never changes marks or results.

export type ExamAttendanceStatus = 'present' | 'absent' | 'excused';

/** One paper the caller may record. */
export interface ExamAttendancePaper {
  examSubjectId: string;
  subjectName: string;
  /** AD `YYYY-MM-DD`, or null when the paper has no date. */
  examDate: string | null;
  /** The server's answer to "may this be saved yet?": the paper has no date, or its day has come. */
  recordable: boolean;
  /** The caller teaches this subject, so it is listed first. */
  taught: boolean;
}

/** A published exam with its active papers, as far as the caller's classes reach. */
export interface ExamAttendanceExam {
  examId: string;
  name: string;
  sessionName: string;
  classId: string;
  className: string;
  /** The section a section exam is fixed to; null for a whole-class exam. */
  sectionId: string | null;
  sectionName: string | null;
  /** The sections the roster can be narrowed to (empty for a section exam and for a class with none). */
  sections: { sectionId: string; sectionName: string }[];
  papers: ExamAttendancePaper[];
}

export interface ExamAttendanceRecord {
  status: ExamAttendanceStatus;
  remarks: string | null;
  /** The version the teacher saw; a row with no record is sent as 0. */
  version: number;
}

export interface ExamAttendanceRow {
  enrollmentId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string | null;
  record: ExamAttendanceRecord | null;
}

export interface ExamAttendanceRoster {
  exam: { id: string; name: string; status: string };
  examSubject: { id: string; subjectName: string; examDate: string | null };
  /** False for an exam that is a draft or locked: the rows are shown, a save is refused. */
  editable: boolean;
  rows: ExamAttendanceRow[];
}

export interface ExamAttendanceSaveRow {
  enrollmentId: string;
  status: ExamAttendanceStatus;
  remarks?: string;
  version: number;
}

export interface ExamAttendanceSaveRequest {
  examSubjectId: string;
  idempotencyKey: string;
  records: ExamAttendanceSaveRow[];
}

export interface ExamAttendanceRowResult {
  enrollmentId: string;
  id: string;
  version: number;
  outcome: 'created' | 'updated' | 'unchanged';
}

export interface ExamAttendanceRowFailure {
  identifier: { enrollmentId: string; row: number };
  /** English sentence, no error code: display only, never branch on it. */
  error: string;
}

/** A refused batch is a 2xx with `ok: false` and nothing written, not an ApiError. */
export type ExamAttendanceSaveResult =
  | { ok: true; replayed: boolean; results: ExamAttendanceRowResult[] }
  | { ok: false; failures: ExamAttendanceRowFailure[] };
