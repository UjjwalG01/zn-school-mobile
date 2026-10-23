// Pure model for recording exam attendance (docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md). Presentation of backend
// state plus bookkeeping of what the teacher changed; no eligibility, scope or date rule lives in the app. The server
// decides which exams, papers and students the teacher may touch, and answers for every row it is sent.
//
// Why this is not `attendanceModel.ts`: that model is keyed by `studentId`, reads the school's own status list and day-off
// info, and sends a class/section/date. Exam attendance is keyed by `enrollmentId`, has the three fixed statuses the API
// accepts, and is saved per paper. The idempotency bookkeeping (`lib/idempotency.ts`) and the status buttons
// (`StatusPicker`) are shared; the draft rules below are the same shape on purpose, so the two screens behave alike.
import type { AttendanceStatusSetting } from '../../../api/types/attendance';
import type {
  ExamAttendanceRoster,
  ExamAttendanceRow,
  ExamAttendanceRowFailure,
  ExamAttendanceRowResult,
  ExamAttendanceSaveRequest,
  ExamAttendanceSaveRow,
  ExamAttendanceStatus,
} from '../../../api/types/examAttendance';
import { t } from '../../../i18n';

/** One save carries at most this many rows (backend `ArrayMaxSize(500)`): a transport limit, not a business rule. */
export const MAX_SAVE_ROWS = 500;

/** The three statuses the API accepts, in the order they are offered. */
export const EXAM_STATUSES: readonly ExamAttendanceStatus[] = ['present', 'absent', 'excused'];

/** What the teacher changed for one student. `baseVersion` is the version of the saved record they SAW (0 = none). */
export interface DraftEntry {
  status: ExamAttendanceStatus;
  remarks: string;
  baseVersion: number;
}
/** Keyed by enrollmentId. Memory only: it is never persisted. */
export type Draft = Readonly<Record<string, DraftEntry>>;
export const EMPTY_DRAFT: Draft = {};

const savedVersion = (row: ExamAttendanceRow): number => row.record?.version ?? 0;
const trimmed = (remarks: string | null | undefined): string => (remarks ?? '').trim();

export function effectiveEntry(
  row: ExamAttendanceRow,
  entry: DraftEntry | undefined,
): { status: ExamAttendanceStatus | null; remarks: string } {
  if (entry) return { status: entry.status, remarks: entry.remarks };
  return { status: row.record?.status ?? null, remarks: row.record?.remarks ?? '' };
}
export const effective = (row: ExamAttendanceRow, draft: Draft) => effectiveEntry(row, draft[row.enrollmentId]);

/** An edit counts only if it differs from what is saved (status, or remark ignoring whitespace). */
export function isChanged(entry: DraftEntry, row: ExamAttendanceRow): boolean {
  return entry.status !== row.record?.status || trimmed(entry.remarks) !== trimmed(row.record?.remarks);
}

/** Stores the entry, or drops it when it equals the saved record (no phantom changes). */
function withEntry(draft: Draft, row: ExamAttendanceRow, entry: DraftEntry): Draft {
  const { [row.enrollmentId]: _previous, ...rest } = draft;
  return isChanged(entry, row) ? { ...rest, [row.enrollmentId]: entry } : rest;
}

export function setStatus(draft: Draft, row: ExamAttendanceRow, status: ExamAttendanceStatus): Draft {
  const previous = draft[row.enrollmentId];
  return withEntry(draft, row, {
    status,
    remarks: previous?.remarks ?? row.record?.remarks ?? '',
    // The version the teacher first saw; later edits keep it, so a conflict stays visible.
    baseVersion: previous?.baseVersion ?? savedVersion(row),
  });
}

/** A remark needs a status; for a student with neither saved nor chosen, it is ignored. */
export function setRemarks(draft: Draft, row: ExamAttendanceRow, remarks: string): Draft {
  const previous = draft[row.enrollmentId];
  const status = previous?.status ?? row.record?.status;
  if (!status) return draft;
  return withEntry(draft, row, { status, remarks, baseVersion: previous?.baseVersion ?? savedVersion(row) });
}

const isUnmarked = (row: ExamAttendanceRow, draft: Draft) =>
  row.record === null && draft[row.enrollmentId] === undefined;

/** Sets `present` on rows with no saved record and no edit; never overwrites a saved or edited row. */
export function markRemainingPresent(draft: Draft, rows: readonly ExamAttendanceRow[]): Draft {
  const next: Record<string, DraftEntry> = { ...draft };
  for (const row of rows) {
    if (isUnmarked(row, draft)) next[row.enrollmentId] = { status: 'present', remarks: '', baseVersion: 0 };
  }
  return next;
}

export const canMarkRemainingPresent = (rows: readonly ExamAttendanceRow[], draft: Draft): boolean =>
  rows.some((row) => isUnmarked(row, draft));

/**
 * Students whose saved record moved since the teacher edited them (someone else saved, or a refresh brought newer data).
 * They must be resolved before saving: the app never overwrites silently.
 */
export function conflictIds(rows: readonly ExamAttendanceRow[], draft: Draft): string[] {
  return rows
    .filter((row) => {
      const entry = draft[row.enrollmentId];
      return entry !== undefined && isChanged(entry, row) && entry.baseVersion !== savedVersion(row);
    })
    .map((row) => row.enrollmentId);
}

/** "Keep mine": rebase the edit onto the version now saved. It may now equal the saved record, then it disappears. */
export function keepMine(draft: Draft, row: ExamAttendanceRow): Draft {
  const entry = draft[row.enrollmentId];
  return entry ? withEntry(draft, row, { ...entry, baseVersion: savedVersion(row) }) : draft;
}

/** "Use theirs": drop the edit and show what is saved. */
export function discardEdit(draft: Draft, enrollmentId: string): Draft {
  const { [enrollmentId]: _dropped, ...rest } = draft;
  return rest;
}

export function changedCount(rows: readonly ExamAttendanceRow[], draft: Draft): number {
  return rows.filter((row) => {
    const entry = draft[row.enrollmentId];
    return entry !== undefined && isChanged(entry, row);
  }).length;
}

/** Only changed rows, in roster order, each with the version the teacher saw (0 = none). */
export function buildSaveRows(rows: readonly ExamAttendanceRow[], draft: Draft): ExamAttendanceSaveRow[] {
  return rows.flatMap((row) => {
    const entry = draft[row.enrollmentId];
    if (!entry || !isChanged(entry, row)) return [];
    const remarks = trimmed(entry.remarks);
    return [
      {
        enrollmentId: row.enrollmentId,
        status: entry.status,
        ...(remarks ? { remarks } : {}),
        version: entry.baseVersion,
      },
    ];
  });
}

/**
 * Canonical text of everything the backend fingerprints for an idempotent replay (the paper, each row's enrollment, status,
 * remarks, version), WITHOUT the key. Order-insensitive.
 */
export function payloadSignature(payload: Omit<ExamAttendanceSaveRequest, 'idempotencyKey'>): string {
  const records = payload.records
    .map((row) => [row.enrollmentId, row.status, row.remarks ?? null, row.version] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([payload.examSubjectId, records]);
}

export { attemptFor, keepKeyAfter, type PendingAttempt } from '../../../lib/idempotency';

/** enrollmentId → the backend's reason, shown as returned (never interpreted). First reason wins. */
export function failuresByEnrollment(failures: readonly ExamAttendanceRowFailure[]): Record<string, string> {
  const byEnrollment: Record<string, string> = {};
  for (const failure of failures) {
    byEnrollment[failure.identifier.enrollmentId] ??= failure.error;
  }
  return byEnrollment;
}

/** The three statuses as `StatusPicker` options: the API's fixed enum, with labels from the message catalogue. */
export function statusOptions(): AttendanceStatusSetting[] {
  return EXAM_STATUSES.map((status, sortOrder) => ({
    status,
    label: t(`examAttendance.status.${status}`),
    shortCode: t(`examAttendance.code.${status}`),
    sortOrder,
    active: true,
  }));
}

/** "Present 32 · Absent 3 · Excused 1 · Not marked 4": counts of the roster as the teacher currently sees it. */
export function summaryText(rows: readonly ExamAttendanceRow[], draft: Draft): string {
  const counts: Record<ExamAttendanceStatus, number> = { present: 0, absent: 0, excused: 0 };
  let notMarked = 0;
  for (const row of rows) {
    const { status } = effective(row, draft);
    if (status === null) notMarked += 1;
    else counts[status] += 1;
  }
  return [
    ...EXAM_STATUSES.map((status) => `${t(`examAttendance.status.${status}`)} ${counts[status]}`),
    `${t('examAttendance.notMarked')} ${notMarked}`,
  ].join(' · ');
}

/**
 * Uses the write response instead of a refetch (api-and-data §7): each saved row now holds the teacher's status and remark
 * with the version the backend returned.
 */
export function applySaved(
  roster: ExamAttendanceRoster,
  draft: Draft,
  results: readonly ExamAttendanceRowResult[],
): ExamAttendanceRoster {
  const byEnrollment = new Map(results.map((result) => [result.enrollmentId, result]));
  return {
    ...roster,
    rows: roster.rows.map((row) => {
      const result = byEnrollment.get(row.enrollmentId);
      const entry = draft[row.enrollmentId];
      if (!result || !entry) return row;
      return {
        ...row,
        record: { status: entry.status, remarks: trimmed(entry.remarks) || null, version: result.version },
      };
    }),
  };
}
