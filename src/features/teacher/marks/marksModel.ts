// Pure model for entering the marks of ONE subject in ONE section (docs/project/MARKS_PLAN.md §4-§5).
// Everything here is presentation of backend state plus bookkeeping of what the teacher typed; no
// grading, eligibility or scope rule lives in the app. The backend decides what may be saved and
// answers for every student. Range and decimals are UX hints only.
import type {
  BulkMarksFailure,
  BulkMarksItem,
  BulkMarksRequest,
  ExamResult,
  ExamRosterRow,
  MarksSubmissionRow,
} from '../../../api/types/academic';
import type {
  ExamComponent,
  ExamComponentType,
  MarksSubmission,
  TeacherExam,
  TeacherExamSubject,
} from '../../../api/types/portal';

/** One save carries at most this many students: a transport limit (as attendance), not a business rule. */
export const MAX_BULK_ITEMS = 200;

/**
 * What the teacher typed for one student: the text of each component they touched, and the result
 * version they SAW (M-D1: sent with the save; 0 = no result yet).
 */
export interface DraftStudent {
  values: Readonly<Record<string, string>>;
  baseVersion: number;
}
/** Keyed by enrollmentId. Memory only (M-D2): it is never persisted. */
export type Draft = Readonly<Record<string, DraftStudent>>;
export const EMPTY_DRAFT: Draft = {};

export type ResultsByEnrollment = ReadonlyMap<string, ExamResult>;

export const indexResults = (results: readonly ExamResult[]): ResultsByEnrollment =>
  new Map(results.map((result) => [result.enrollmentId, result]));

const savedVersion = (result: ExamResult | undefined): number => result?.version ?? 0;

// --- Numbers ----------------------------------------------------------------------------------

const NUMERIC = /^(\d+\.?\d*|\.\d+)$/;

/** "75.00" → "75", "12,5" → "12.5"; text that is not a plain number is kept as typed. */
function canonical(text: string): string {
  const clean = text.trim().replace(',', '.');
  return NUMERIC.test(clean) ? String(Number(clean)) : clean;
}

/** The backend sends decimal strings ("75.00", "100.00"); show them without trailing zeros. */
export const formatMarks = (value: string | undefined): string => (value === undefined ? '' : canonical(value));

export type MarkProblem = 'number' | 'decimals' | 'range';
export type MarkParse = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'invalid'; problem: MarkProblem };

/** A UX hint: the backend's refusal is authoritative. Accepts a decimal comma (some keypads). */
export function parseMark(text: string, maxMarks: string): MarkParse {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return { kind: 'empty' };
  if (!NUMERIC.test(clean)) return { kind: 'invalid', problem: 'number' };
  if ((clean.split('.')[1]?.length ?? 0) > 2) return { kind: 'invalid', problem: 'decimals' };
  const value = Number(clean);
  return value > Number(maxMarks) ? { kind: 'invalid', problem: 'range' } : { kind: 'ok', value };
}

export const savedText = (result: ExamResult | undefined, componentId: string): string =>
  formatMarks(result?.components.find((component) => component.examComponentId === componentId)?.obtainedMarks);

/** The text to show in a field: what the teacher typed, else what is saved. */
export const shownText = (entry: DraftStudent | undefined, result: ExamResult | undefined, componentId: string): string =>
  entry?.values[componentId] ?? savedText(result, componentId);

/** An edit counts only if some typed value differs from what is saved (no phantom changes). */
export const isChanged = (entry: DraftStudent, result: ExamResult | undefined): boolean =>
  Object.entries(entry.values).some(([componentId, text]) => canonical(text) !== savedText(result, componentId));

// --- One student ------------------------------------------------------------------------------

export interface StudentMarks {
  /** Per component, in the subject's order. */
  fields: { component: ExamComponent; text: string; problem: MarkProblem | null }[];
  /** Fields with any text. */
  entered: number;
  /** Every component holds a valid number (saved or typed): the student can be saved or submitted. */
  complete: boolean;
  changed: boolean;
  /** A valid number per component, only when `complete`. */
  numbers: number[] | null;
}

export function studentMarks(
  components: readonly ExamComponent[],
  entry: DraftStudent | undefined,
  result: ExamResult | undefined,
): StudentMarks {
  const fields = components.map((component) => {
    const text = shownText(entry, result, component.id);
    const parsed = parseMark(text, component.maxMarks);
    return { component, text, parsed };
  });
  const complete = fields.length > 0 && fields.every((field) => field.parsed.kind === 'ok');
  return {
    fields: fields.map(({ component, text, parsed }) => ({
      component,
      text,
      problem: parsed.kind === 'invalid' ? parsed.problem : null,
    })),
    entered: fields.filter((field) => field.text.trim() !== '').length,
    complete,
    changed: entry !== undefined && isChanged(entry, result),
    numbers: complete ? fields.map((field) => (field.parsed.kind === 'ok' ? field.parsed.value : 0)) : null,
  };
}

// --- The table's columns ----------------------------------------------------------------------

/** One column of the marks table. `component` is null for a column this subject does not have: the cell is disabled. */
export interface MarkColumn {
  key: string;
  title: string;
  component: ExamComponent | null;
}

const TYPE_ORDER: readonly ExamComponentType[] = ['theory', 'practical', 'cas', 'internal', 'project', 'viva', 'other'];

/**
 * The columns for a subject's components. Applicability is what the backend sent, nothing inferred:
 * - while the components carry no `componentType` (the API does not send it yet) each one is a column under its own name;
 * - with types, Theory then Practical come first and always exist, so a subject that has no practical component shows a
 *   disabled Practical cell (`component: null`) and nothing is ever sent for it; other types follow in the web's order.
 * A type that has several components keeps their own names, so two theory papers are not both called "Theory".
 */
export function markColumns(
  components: readonly ExamComponent[],
  typeTitle: (type: ExamComponentType) => string,
): MarkColumn[] {
  if (components.length === 0 || components.some((component) => component.componentType === undefined)) {
    return components.map((component) => ({ key: component.id, title: component.name, component }));
  }
  const ofType = (type: ExamComponentType): MarkColumn[] => {
    const same = components.filter((component) => component.componentType === type);
    return same.map((component) => ({
      key: component.id,
      title: same.length > 1 ? component.name : typeTitle(type),
      component,
    }));
  };
  const lead = (type: 'theory' | 'practical'): MarkColumn[] => {
    const columns = ofType(type);
    return columns.length > 0 ? columns : [{ key: type, title: typeTitle(type), component: null }];
  };
  return [...lead('theory'), ...lead('practical'), ...TYPE_ORDER.slice(2).flatMap(ofType)];
}

// --- The draft --------------------------------------------------------------------------------

/** Stores the entry, or drops it when it equals what is saved. */
function withEntry(draft: Draft, enrollmentId: string, result: ExamResult | undefined, entry: DraftStudent): Draft {
  const { [enrollmentId]: _previous, ...rest } = draft;
  return isChanged(entry, result) ? { ...rest, [enrollmentId]: entry } : rest;
}

export function setValue(
  draft: Draft,
  enrollmentId: string,
  result: ExamResult | undefined,
  componentId: string,
  text: string,
): Draft {
  const previous = draft[enrollmentId];
  return withEntry(draft, enrollmentId, result, {
    values: { ...previous?.values, [componentId]: text },
    // The version the teacher first saw; later edits keep it, so a conflict stays visible.
    baseVersion: previous?.baseVersion ?? savedVersion(result),
  });
}

/** Students the teacher changed whose saved result moved on since: resolve before saving, never overwrite silently. */
export function conflictIds(
  rows: readonly ExamRosterRow[],
  results: ResultsByEnrollment,
  draft: Draft,
): string[] {
  return rows
    .filter((row) => {
      const entry = draft[row.enrollmentId];
      const result = results.get(row.enrollmentId);
      return entry !== undefined && isChanged(entry, result) && entry.baseVersion !== savedVersion(result);
    })
    .map((row) => row.enrollmentId);
}

/** "Keep mine": rebase the edit onto the version now saved. It may now equal the saved result, then it disappears. */
export function keepMine(draft: Draft, enrollmentId: string, result: ExamResult | undefined): Draft {
  const entry = draft[enrollmentId];
  return entry ? withEntry(draft, enrollmentId, result, { ...entry, baseVersion: savedVersion(result) }) : draft;
}

/** "Use theirs", and what a successful save does for the students it saved. */
export function dropEntries(draft: Draft, enrollmentIds: readonly string[]): Draft {
  const drop = new Set(enrollmentIds);
  return Object.fromEntries(Object.entries(draft).filter(([id]) => !drop.has(id)));
}

// --- What a save sends ------------------------------------------------------------------------

export interface SaveCounts {
  /** Changed and complete: sent by Save. */
  ready: number;
  /** Changed but not complete (a mark missing or invalid): stays an edit, not sent. */
  incomplete: number;
}

export function saveCounts(
  rows: readonly ExamRosterRow[],
  results: ResultsByEnrollment,
  components: readonly ExamComponent[],
  draft: Draft,
): SaveCounts {
  let ready = 0;
  let incomplete = 0;
  for (const row of rows) {
    const entry = draft[row.enrollmentId];
    if (!entry) continue;
    const state = studentMarks(components, entry, results.get(row.enrollmentId));
    if (!state.changed) continue;
    if (state.complete) ready += 1;
    else incomplete += 1;
  }
  return { ready, incomplete };
}

/** Changed, complete students in roster order, each with every component of the subject (all-or-none) and the version seen. */
export function buildItems(
  rows: readonly ExamRosterRow[],
  results: ResultsByEnrollment,
  components: readonly ExamComponent[],
  draft: Draft,
): BulkMarksItem[] {
  return rows.flatMap((row) => {
    const entry = draft[row.enrollmentId];
    if (!entry) return [];
    const state = studentMarks(components, entry, results.get(row.enrollmentId));
    if (!state.changed || !state.numbers) return [];
    const numbers = state.numbers;
    return [
      {
        enrollmentId: row.enrollmentId,
        components: components.map((component, index) => ({
          examComponentId: component.id,
          obtainedMarks: numbers[index]!,
        })),
        version: entry.baseVersion,
      },
    ];
  });
}

/** Students whose marks are all entered and valid as the teacher currently sees them (saved + edits). */
export function completeCount(
  rows: readonly ExamRosterRow[],
  results: ResultsByEnrollment,
  components: readonly ExamComponent[],
  draft: Draft,
): number {
  return rows.filter((row) => studentMarks(components, draft[row.enrollmentId], results.get(row.enrollmentId)).complete)
    .length;
}

/** Number of students with an unsaved change, complete or not (the leave guard and the Submit gate). */
export function changedCount(
  rows: readonly ExamRosterRow[],
  results: ResultsByEnrollment,
  draft: Draft,
): number {
  return rows.filter((row) => {
    const entry = draft[row.enrollmentId];
    return entry !== undefined && isChanged(entry, results.get(row.enrollmentId));
  }).length;
}

/**
 * Canonical text of everything the backend fingerprints for an idempotent replay (exam, each
 * student's version and marks), WITHOUT the key. Order-insensitive.
 */
export function payloadSignature(payload: Omit<BulkMarksRequest, 'idempotencyKey'>): string {
  const items = payload.items
    .map((item) => [
      item.enrollmentId,
      item.version,
      [...item.components].map((c) => [c.examComponentId, c.obtainedMarks] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ])
    .sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
  return JSON.stringify([payload.examId, items]);
}

/** enrollmentId → the backend's reason, shown as returned (never interpreted). First reason wins. */
export function failuresByEnrollment(failures: readonly BulkMarksFailure[]): Record<string, string> {
  const byStudent: Record<string, string> = {};
  for (const failure of failures) byStudent[failure.identifier.enrollmentId] ??= failure.error;
  return byStudent;
}

/** The write response replaces each saved student's result (new version, every subject's components). */
export function mergeResults(results: readonly ExamResult[], saved: readonly ExamResult[]): ExamResult[] {
  const byEnrollment = new Map(saved.map((result) => [result.enrollmentId, result]));
  const merged = results.map((result) => byEnrollment.get(result.enrollmentId) ?? result);
  const known = new Set(results.map((result) => result.enrollmentId));
  return [...merged, ...saved.filter((result) => !known.has(result.enrollmentId))];
}

// --- The roster and the subject slot -----------------------------------------------------------

/** Roll numbers sort the way people read them (2 before 10); a missing roll goes last, then by name. */
export function sortRoster(rows: readonly ExamRosterRow[]): ExamRosterRow[] {
  return [...rows].sort((a, b) =>
    a.rollNumber === null || b.rollNumber === null
      ? Number(a.rollNumber === null) - Number(b.rollNumber === null) || a.fullName.localeCompare(b.fullName)
      : a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }) || a.fullName.localeCompare(b.fullName),
  );
}

export interface SlotRef {
  examId: string;
  examSubjectId: string;
  /** null = the exam's own section, or a class with no sections. */
  sectionId: string | null;
}

/** One subject of one section inside the exams the backend says are open; null when it is no longer there. */
export function findSlot(
  exams: readonly TeacherExam[],
  { examId, examSubjectId, sectionId }: SlotRef,
): { exam: TeacherExam; subject: TeacherExamSubject } | null {
  const exam = exams.find((candidate) => candidate.examId === examId);
  const subject = exam?.subjects.find(
    (candidate) => candidate.examSubjectId === examSubjectId && (candidate.sectionId ?? null) === sectionId,
  );
  return exam && subject ? { exam, subject } : null;
}

/** A submit response replaces that subject's submission in the cached exam list (no refetch). */
export function withSubmission(
  exams: readonly TeacherExam[],
  slot: SlotRef,
  row: MarksSubmissionRow,
): TeacherExam[] {
  const submission: MarksSubmission = {
    status: row.status,
    version: row.version,
    returnedReason: row.returnedReason,
    submittedAt: row.submittedAt,
  };
  return exams.map((exam) =>
    exam.examId !== slot.examId
      ? exam
      : {
          ...exam,
          subjects: exam.subjects.map((subject) =>
            subject.examSubjectId === slot.examSubjectId && (subject.sectionId ?? null) === slot.sectionId
              ? { ...subject, submission }
              : subject,
          ),
        },
  );
}
