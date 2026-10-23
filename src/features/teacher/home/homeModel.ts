// Pure view-model for the teacher Home screen. Everything here is presentation of backend state
// (a count, a sort order, a label); no marks or attendance rule lives in the app.
import type {
  SubmissionStatus,
  TeacherExam,
  TeacherExamSubject,
  TeacherSubjectAssignment,
} from '../../../api/types/portal';
import type { BadgeTone } from '../../../components/StatusBadge';
import { placementLabel } from '../placement';

export type SubjectProgress = 'notStarted' | SubmissionStatus;

/** `submission === null` means the teacher has saved nothing yet for that subject. */
export const subjectProgress = (submission: TeacherExamSubject['submission']): SubjectProgress =>
  submission === null ? 'notStarted' : submission.status;

const PROGRESS_TONE: Record<SubjectProgress, BadgeTone> = {
  notStarted: 'neutral',
  draft: 'neutral',
  submitted: 'success',
  returned: 'warning',
};

export const progressTone = (progress: SubjectProgress): BadgeTone => PROGRESS_TONE[progress];

export interface ExamCardSubject {
  key: string;
  name: string;
  progress: SubjectProgress;
}

export interface ExamCard {
  key: string;
  title: string;
  /** `Session · Class · Section`. */
  subtitle: string;
  subjects: ExamCardSubject[];
  hasReturned: boolean;
  /** Subjects still needing the teacher: not started, draft or returned. */
  openCount: number;
}

const idPart = (id: string | null) => id ?? 'none';

// Returned first, then work still to do, then submitted. Array.sort is stable, so the backend order
// is kept within a group.
const SUBJECT_RANK: Record<SubjectProgress, number> = { returned: 0, notStarted: 1, draft: 1, submitted: 2 };

export function buildExamCards(exams: readonly TeacherExam[]): ExamCard[] {
  return exams
    .map((exam): ExamCard => {
      const subjects = exam.subjects
        .map((subject) => ({
          key: `${subject.examSubjectId}:${idPart(subject.sectionId)}`,
          name: subject.subjectName,
          progress: subjectProgress(subject.submission),
        }))
        .sort((a, b) => SUBJECT_RANK[a.progress] - SUBJECT_RANK[b.progress]);
      return {
        key: `${exam.examId}:${idPart(exam.sectionId)}`,
        title: exam.name,
        subtitle: `${exam.sessionName} · ${placementLabel(exam)}`,
        subjects,
        hasReturned: subjects.some((subject) => subject.progress === 'returned'),
        openCount: subjects.filter((subject) => subject.progress !== 'submitted').length,
      };
    })
    .sort(
      (a, b) =>
        Number(b.hasReturned) - Number(a.hasReturned) ||
        b.openCount - a.openCount ||
        a.title.localeCompare(b.title),
    );
}

/** Subjects returned for correction across all cards (the warning banner count). */
export const returnedCount = (cards: readonly ExamCard[]) =>
  cards.reduce((sum, card) => sum + card.subjects.filter((s) => s.progress === 'returned').length, 0);

/** How many subjects (across every exam card) are in each state, for the marks progress chart. */
export function progressTotals(cards: readonly ExamCard[]): { total: number; counts: Record<SubjectProgress, number> } {
  const counts: Record<SubjectProgress, number> = { notStarted: 0, draft: 0, submitted: 0, returned: 0 };
  for (const card of cards) for (const subject of card.subjects) counts[subject.progress] += 1;
  return { total: counts.notStarted + counts.draft + counts.submitted + counts.returned, counts };
}

/** The teacher's subject assignments counted per class and section, most first, for the teaching load chart. */
export function subjectsPerClass(
  subjects: readonly TeacherSubjectAssignment[],
): { key: string; label: string; value: number }[] {
  const rows = new Map<string, { key: string; label: string; value: number }>();
  for (const subject of subjects) {
    const key = `${subject.classId}:${idPart(subject.sectionId)}`;
    const row = rows.get(key) ?? { key, label: placementLabel(subject), value: 0 };
    row.value += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** First `max` items plus how many were left out ("+N more"). */
export function capList<T>(items: readonly T[], max = 5) {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) };
}
