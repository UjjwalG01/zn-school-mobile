// The filter step shared by every exam workflow on the phone (Marks entry, Exam attendance): exam session → class →
// section → subject or paper, the same chain the web's `useExamPicker` walks. Pure: it narrows the lists the server
// returned and never decides who may see what. The server has already limited the exams to the teacher's classes; a
// choice made here is only ever sent back to endpoints that check it again.

/** One thing that can be opened for an exam: a subject (marks) or a paper (exam attendance). */
export interface PickItem {
  /** Unique within its exam (a subject taught to several sections appears once per section). */
  key: string;
  examSubjectId: string;
  label: string;
  /** A state or a date shown under the label ("Submitted", "Opens on …"). */
  hint: string | null;
  /** The section the item belongs to; null = not tied to one section. */
  sectionId: string | null;
  /** Shown but not openable yet. */
  blocked: boolean;
  /** A sentence shown once the item is chosen (the reason marks were returned); null for none. */
  note: string | null;
}

export interface PickExam {
  examId: string;
  sessionName: string;
  classId: string;
  className: string;
  /** The section a section exam is fixed to; null for a whole-class exam. */
  sectionId: string | null;
  sectionName: string | null;
  /** For a whole-class exam: the sections the list can be narrowed to (empty for a class with none). */
  sections: { id: string; name: string }[];
  items: PickItem[];
}

export interface Selection {
  session: string | null;
  classId: string | null;
  sectionId: string | null;
  itemKey: string | null;
}
export const EMPTY_SELECTION: Selection = { session: null, classId: null, sectionId: null, itemKey: null };

export interface Resolved {
  sessions: string[];
  session: string | null;
  classes: { id: string; name: string }[];
  classId: string | null;
  /** The sections that can be chosen; empty when there is nothing to choose (a section exam, a class with none). */
  sectionOptions: { id: string; name: string }[];
  /** A section must be chosen before an exam is known: the class has a separate exam per section. */
  sectionRequired: boolean;
  sectionId: string | null;
  exam: PickExam | null;
  items: PickItem[];
  item: PickItem | null;
}

const unique = <T>(values: readonly T[], key: (value: T) => string): T[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/**
 * What each filter offers for the choices so far. A lone option is chosen for the teacher (one session, one class), so a
 * school with a single open exam needs one tap, not four. A choice that no longer applies after an upstream change falls away.
 */
export function resolve(exams: readonly PickExam[], selection: Selection): Resolved {
  const sessions = unique(
    exams.map((exam) => exam.sessionName),
    (name) => name,
  );
  const session =
    selection.session && sessions.includes(selection.session) ? selection.session : sessions.length === 1 ? (sessions[0] ?? null) : null;

  const inSession = exams.filter((exam) => exam.sessionName === session);
  const classes = unique(
    inSession.map((exam) => ({ id: exam.classId, name: exam.className })),
    (entry) => entry.id,
  );
  const classId =
    selection.classId && classes.some((entry) => entry.id === selection.classId)
      ? selection.classId
      : classes.length === 1
        ? (classes[0]?.id ?? null)
        : null;

  const candidates = inSession.filter((exam) => exam.classId === classId);
  const whole = candidates.find((exam) => exam.sectionId === null);

  let exam: PickExam | null = null;
  let sectionOptions: { id: string; name: string }[] = [];
  let sectionRequired = false;
  let sectionId: string | null = null;
  if (whole) {
    exam = whole;
    sectionOptions = whole.sections;
    sectionId = sectionOptions.some((entry) => entry.id === selection.sectionId) ? selection.sectionId : null;
  } else if (candidates.length === 1) {
    exam = candidates[0] ?? null;
    sectionId = exam?.sectionId ?? null;
  } else if (candidates.length > 1) {
    sectionOptions = candidates.map((candidate) => ({ id: candidate.sectionId ?? '', name: candidate.sectionName ?? '' }));
    exam = candidates.find((candidate) => candidate.sectionId === selection.sectionId) ?? null;
    sectionRequired = exam === null;
    sectionId = exam?.sectionId ?? null;
  }

  const items = !exam
    ? []
    : whole && sectionId
      ? exam.items.filter((entry) => entry.sectionId === null || entry.sectionId === sectionId)
      : exam.items;
  const item = items.find((entry) => entry.key === selection.itemKey) ?? null;
  return { sessions, session, classes, classId, sectionOptions, sectionRequired, sectionId, exam, items, item };
}

/** A new choice at one level drops the choices below it. */
export function choose(selection: Selection, level: keyof Selection, value: string | null): Selection {
  switch (level) {
    case 'session':
      return { session: value, classId: null, sectionId: null, itemKey: null };
    case 'classId':
      return { ...selection, classId: value, sectionId: null, itemKey: null };
    case 'sectionId':
      return { ...selection, sectionId: value, itemKey: null };
    case 'itemKey':
      return { ...selection, itemKey: value };
  }
}
