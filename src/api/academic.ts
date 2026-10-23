// Typed requests for marks entry (docs/project/MARKS_PLAN.md §3; backend ENDPOINTS.md §6a).
// `tenantId` is attached by the client (selected school) as a query param on every call, including
// the POSTs: neither DTO has a `tenantId` field, so it must not be put in a body.
import { apiGet, apiPost } from './client';
import type {
  BulkMarksRequest,
  BulkMarksResult,
  ExamResult,
  ExamRosterPage,
  ExamRosterRow,
  MarksSubmissionRow,
  SubmitMarksRequest,
} from './types/academic';

export interface ExamRosterQuery {
  examId: string;
  /** null = the exam's own section, or a class with no sections: the param is left out. */
  sectionId: string | null;
}

/** The backend's maximum page size for the roster (a larger request is answered with 200, not refused). */
const ROSTER_PAGE_SIZE = 200;
/** A safety stop (10,000 students); a class never comes near it. */
const MAX_ROSTER_PAGES = 50;

// The live responses carry far more than the screens use: the roster adds the guardian's name and id,
// the student id and custom fields; a result adds grades, percentages and tenantId. Query data is
// persisted on the device for days, so only the fields the marks screens read are kept
// (MARKS_PLAN §3.1, evidence E-M2).
const toRosterRow = (row: ExamRosterRow): ExamRosterRow => ({
  enrollmentId: row.enrollmentId,
  fullName: row.fullName,
  admissionNumber: row.admissionNumber,
  rollNumber: row.rollNumber ?? null,
});

const toResult = (result: ExamResult): ExamResult => ({
  id: result.id,
  enrollmentId: result.enrollmentId,
  version: result.version,
  components: result.components.map(({ examComponentId, obtainedMarks }) => ({ examComponentId, obtainedMarks })),
});

/**
 * `GET /academic/students?examId=` — the students who need a result for this exam, every page, so a
 * class of more than 200 is never silently cut off. Membership-only on the backend (not scoped by
 * assignment): the caller shows names and roll numbers only.
 */
export async function getExamRoster({ examId, sectionId }: ExamRosterQuery): Promise<ExamRosterRow[]> {
  const base = [`examId=${encodeURIComponent(examId)}`];
  if (sectionId) base.push(`sectionId=${encodeURIComponent(sectionId)}`);
  const rows: ExamRosterRow[] = [];
  for (let page = 1; page <= MAX_ROSTER_PAGES; page += 1) {
    const result = await apiGet<ExamRosterPage>(
      `/academic/students?${[...base, `page=${page}`, `pageSize=${ROSTER_PAGE_SIZE}`].join('&')}`,
    );
    rows.push(...result.rows.map(toRosterRow));
    if (result.rows.length === 0 || rows.length >= result.total) break;
  }
  return rows;
}

/** `GET /academic/exam-results?examId=` — every stored result of the exam (a plain array, all subjects). */
export const getExamResults = async (examId: string) =>
  (await apiGet<ExamResult[]>(`/academic/exam-results?examId=${encodeURIComponent(examId)}`)).map(toResult);

/**
 * `POST /academic/exam-results/bulk-entry` — all-or-nothing, 1–500 items. A refused batch resolves
 * as `{ ok: false, failures }` (it is not an ApiError): the caller must branch on `ok`.
 */
export async function postBulkMarks(body: BulkMarksRequest): Promise<BulkMarksResult> {
  const response = await apiPost<BulkMarksResult>('/academic/exam-results/bulk-entry', body);
  return response.ok ? { ...response, results: response.results.map(toResult) } : response;
}

/**
 * `POST /academic/exams/:examId/submissions/:examSubjectId/submit` — hands one subject in. Already
 * submitted answers the same row (a retry is harmless).
 */
export const submitSubjectMarks = (examId: string, examSubjectId: string, body: SubmitMarksRequest) =>
  apiPost<MarksSubmissionRow>(
    `/academic/exams/${encodeURIComponent(examId)}/submissions/${encodeURIComponent(examSubjectId)}/submit`,
    body,
  );
