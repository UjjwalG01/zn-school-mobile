// Pure model for marking attendance (docs/project/ATTENDANCE_PLAN.md §3.5). Everything here is
// presentation of backend state plus bookkeeping of what the teacher changed; no eligibility or
// calendar rule lives in the app. The backend decides what may be saved and answers for every row.
import type {
  AttendanceRoster,
  AttendanceSettings,
  AttendanceStatus,
  AttendanceStatusSetting,
  BulkAttendanceRequest,
  BulkAttendanceRow,
  BulkRowFailure,
  BulkRowResult,
  RosterRow,
} from '../../../api/types/attendance';
import type { BadgeTone } from '../../../components/StatusBadge';
import { shiftIsoDate } from '../../../lib/date';

/** One save carries at most this many rows (backend `MAX_ATTENDANCE_BULK_ROWS`): a transport limit, not a business rule. */
export const MAX_BULK_ROWS = 200;

/** What the teacher changed for one student. `baseVersion` is the version of the saved record they SAW. */
export interface DraftEntry {
  status: AttendanceStatus;
  remarks: string;
  baseVersion: number;
}
/** Keyed by studentId. Memory only: it is never persisted. */
export type Draft = Readonly<Record<string, DraftEntry>>;

export const EMPTY_DRAFT: Draft = {};

const savedVersion = (row: RosterRow): number => row.record?.version ?? 0;
const trimmed = (remarks: string | null | undefined): string => (remarks ?? '').trim();

/** The status and remark to show for a row, given the teacher's edit for it (if any), else what is saved. */
export function effectiveEntry(
  row: RosterRow,
  entry: DraftEntry | undefined,
): { status: AttendanceStatus | null; remarks: string } {
  if (entry) return { status: entry.status, remarks: entry.remarks };
  return { status: row.record?.status ?? null, remarks: row.record?.remarks ?? '' };
}

export const effective = (row: RosterRow, draft: Draft) => effectiveEntry(row, draft[row.studentId]);

/** An edit counts only if it differs from what is saved (status, or remark ignoring whitespace). */
export function isChanged(entry: DraftEntry, row: RosterRow): boolean {
  return entry.status !== row.record?.status || trimmed(entry.remarks) !== trimmed(row.record?.remarks);
}

/** Stores the entry, or drops it when it equals the saved record (no phantom changes). */
function withEntry(draft: Draft, row: RosterRow, entry: DraftEntry): Draft {
  const { [row.studentId]: _previous, ...rest } = draft;
  return isChanged(entry, row) ? { ...rest, [row.studentId]: entry } : rest;
}

export function setStatus(draft: Draft, row: RosterRow, status: AttendanceStatus): Draft {
  const previous = draft[row.studentId];
  return withEntry(draft, row, {
    status,
    remarks: previous?.remarks ?? row.record?.remarks ?? '',
    // The version the teacher first saw; later edits keep it, so a conflict stays visible.
    baseVersion: previous?.baseVersion ?? savedVersion(row),
  });
}

/** A remark needs a status; for a student with neither saved nor chosen, it is ignored. */
export function setRemarks(draft: Draft, row: RosterRow, remarks: string): Draft {
  const previous = draft[row.studentId];
  const status = previous?.status ?? row.record?.status;
  if (!status) return draft;
  return withEntry(draft, row, { status, remarks, baseVersion: previous?.baseVersion ?? savedVersion(row) });
}

const isUnmarked = (row: RosterRow, draft: Draft) => row.record === null && draft[row.studentId] === undefined;

/** Sets `present` on rows with no saved record and no edit; never overwrites a saved or edited row. */
export function markRemainingPresent(draft: Draft, rows: readonly RosterRow[]): Draft {
  const next: Record<string, DraftEntry> = { ...draft };
  for (const row of rows) {
    if (isUnmarked(row, draft)) next[row.studentId] = { status: 'present', remarks: '', baseVersion: 0 };
  }
  return next;
}

/** The "Mark remaining present" button: `present` must be in use at the school and something left to mark. */
export function canMarkRemainingPresent(
  settings: AttendanceSettings,
  rows: readonly RosterRow[],
  draft: Draft,
): boolean {
  return statusOptions(settings).some((option) => option.status === 'present') && rows.some((row) => isUnmarked(row, draft));
}

/**
 * Students whose saved record moved since the teacher edited them (someone else saved, or a refresh
 * brought newer data). They must be resolved before saving: the app never overwrites silently.
 */
export function conflictIds(rows: readonly RosterRow[], draft: Draft): string[] {
  return rows
    .filter((row) => {
      const entry = draft[row.studentId];
      return entry !== undefined && isChanged(entry, row) && entry.baseVersion !== savedVersion(row);
    })
    .map((row) => row.studentId);
}

/** "Keep mine": rebase the edit onto the version now saved. It may now equal the saved record, then it disappears. */
export function keepMine(draft: Draft, row: RosterRow): Draft {
  const entry = draft[row.studentId];
  return entry ? withEntry(draft, row, { ...entry, baseVersion: savedVersion(row) }) : draft;
}

/** "Use theirs": drop the edit and show what is saved. */
export function discardEdit(draft: Draft, studentId: string): Draft {
  const { [studentId]: _dropped, ...rest } = draft;
  return rest;
}

export function changedCount(rows: readonly RosterRow[], draft: Draft): number {
  return rows.filter((row) => {
    const entry = draft[row.studentId];
    return entry !== undefined && isChanged(entry, row);
  }).length;
}

/** Only changed rows, in roster order, each with the version the teacher saw (0 = none). */
export function buildBulkRows(rows: readonly RosterRow[], draft: Draft): BulkAttendanceRow[] {
  return rows.flatMap((row) => {
    const entry = draft[row.studentId];
    if (!entry || !isChanged(entry, row)) return [];
    const remarks = trimmed(entry.remarks);
    return [
      {
        studentId: row.studentId,
        status: entry.status,
        ...(remarks ? { remarks } : {}),
        version: entry.baseVersion,
      },
    ];
  });
}

/**
 * Canonical text of everything the backend fingerprints for an idempotent replay (date, class,
 * section, each row's student, status, remarks, version), WITHOUT the key. Order-insensitive.
 */
export function payloadSignature(payload: Omit<BulkAttendanceRequest, 'idempotencyKey'>): string {
  const records = payload.records
    .map((row) => [row.studentId, row.status, row.remarks ?? null, row.version] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([payload.attendanceDate, payload.classId, payload.sectionId ?? null, records]);
}

// The key bookkeeping moved to `src/lib/idempotency.ts` when marks became the second bulk save.
export { attemptFor, keepKeyAfter, type PendingAttempt } from '../../../lib/idempotency';

/** studentId → the backend's reason, shown as returned (never interpreted). First reason wins. */
export function failuresByStudent(failures: readonly BulkRowFailure[]): Record<string, string> {
  const byStudent: Record<string, string> = {};
  for (const failure of failures) {
    byStudent[failure.identifier.studentId] ??= failure.error;
  }
  return byStudent;
}

/** The statuses a teacher may newly pick: active ones, in the school's order. */
export function statusOptions(settings: AttendanceSettings): AttendanceStatusSetting[] {
  return settings.statuses.filter((status) => status.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The school's label, including for a status that has since been switched off. */
export function labelFor(settings: AttendanceSettings, status: AttendanceStatus): string {
  return settings.statuses.find((candidate) => candidate.status === status)?.label ?? status;
}

export interface Counts {
  byStatus: Partial<Record<AttendanceStatus, number>>;
  notMarked: number;
}

/** Counts of the roster as the teacher currently sees it (saved + edits). Counts, not rules. */
export function summarize(rows: readonly RosterRow[], draft: Draft): Counts {
  const byStatus: Partial<Record<AttendanceStatus, number>> = {};
  let notMarked = 0;
  for (const row of rows) {
    const { status } = effective(row, draft);
    if (status === null) notMarked += 1;
    else byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return { byStatus, notMarked };
}

/**
 * "Here 32 · Absent 3 · Not marked 4": the school's own labels, in its order. Statuses the school
 * switched off appear only while someone still has them (an old record), so the line stays short.
 */
export function summaryText(settings: AttendanceSettings, counts: Counts, notMarkedLabel: string): string {
  const parts = [...settings.statuses]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((status) => status.active || (counts.byStatus[status.status] ?? 0) > 0)
    .map((status) => `${status.label} ${counts.byStatus[status.status] ?? 0}`);
  return [...parts, `${notMarkedLabel} ${counts.notMarked}`].join(' · ');
}

/**
 * Uses the write response instead of a refetch (api-and-data §7): each saved row now holds the
 * teacher's status and remark with the version the backend returned.
 */
export function applySaved(
  roster: AttendanceRoster,
  draft: Draft,
  results: readonly BulkRowResult[],
): AttendanceRoster {
  const byStudent = new Map(results.map((result) => [result.studentId, result]));
  return {
    ...roster,
    rows: roster.rows.map((row) => {
      const result = byStudent.get(row.studentId);
      const entry = draft[row.studentId];
      if (!result || !entry) return row;
      return {
        ...row,
        record: {
          id: result.id,
          status: entry.status,
          remarks: trimmed(entry.remarks) || null,
          version: result.version,
        },
      };
    }),
  };
}

/** The dates the stepper offers: not after today, not before the school's backdate window (a UX hint). */
export function dateBounds(today: string, settings: AttendanceSettings): { min: string; max: string } {
  return { min: shiftIsoDate(today, -settings.backdateWindowDays), max: today };
}

/** Fixed enum → tone. The text label is always shown beside it; colour is never the only signal. */
export const STATUS_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  half_day: 'warning',
  excused: 'neutral',
};
