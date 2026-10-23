// Hand-written from backend ENDPOINTS.md §6a (exam results, submissions) and the Academic roster
// (A6). Only fields the marks screens use. docs/project/MARKS_PLAN.md §3.
//
// The backend returns every marks figure as a DECIMAL STRING ("75.00"); the bulk save takes JSON
// NUMBERS (at most 2 decimals). Both confirmed on a live test stack, 2026-10-22 (MARKS_PLAN E-M2).
// The live rows hold more than these types name; `src/api/academic.ts` keeps only these fields.
import type { SubmissionStatus } from './portal';

/** `GET /academic/students?examId=` — the exam's own population; the screen needs only these fields. */
export interface ExamRosterRow {
  enrollmentId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string | null;
}

export interface ExamRosterPage {
  rows: ExamRosterRow[];
  total: number;
}

export interface ExamResultComponent {
  examComponentId: string;
  /** Decimal string. */
  obtainedMarks: string;
}

/**
 * One student's stored result. It carries EVERY subject's components (the read is not scoped by
 * assignment: MARKS_PLAN §4.5); the screen reads only the open subject's component ids.
 */
export interface ExamResult {
  id: string;
  enrollmentId: string;
  /** Bumped by every marks save of this student, in any subject. A student with no row is absent; send 0. */
  version: number;
  components: ExamResultComponent[];
}

export interface BulkMarksItem {
  enrollmentId: string;
  components: { examComponentId: string; obtainedMarks: number }[];
  /** The result version the teacher saw; 0 = no result yet. */
  version: number;
}

export interface BulkMarksRequest {
  examId: string;
  idempotencyKey: string;
  items: BulkMarksItem[];
}

export interface BulkMarksFailure {
  identifier: { enrollmentId: string };
  /** English sentence, no error code: display only, never branch on it. */
  error: string;
}

/** A refused batch is a 2xx `{ ok: false }`, not an ApiError: the caller must branch on `ok`. */
export type BulkMarksResult =
  | { ok: true; replayed?: boolean; results: ExamResult[] }
  | { ok: false; failures: BulkMarksFailure[] };

export interface SubmitMarksRequest {
  /** Omitted for the exam's own section or a class with no sections. */
  sectionId?: string;
  /** The submission version last read; 0 = none yet. */
  version: number;
}

/** The submission row after `submit`. */
export interface MarksSubmissionRow {
  id: string;
  examSubjectId: string;
  sectionId: string | null;
  status: SubmissionStatus;
  returnedReason: string | null;
  submittedAt: string | null;
  version: number;
}
