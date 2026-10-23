import type {
  MarksSubmission,
  TeacherExam,
  TeacherExamSubject,
  TeacherSubjectAssignment,
} from '../../../../api/types/portal';
import { placementLabel } from '../../placement';
import {
  buildExamCards,
  capList,
  progressTone,
  progressTotals,
  returnedCount,
  subjectProgress,
  subjectsPerClass,
} from '../homeModel';

const submission = (status: MarksSubmission['status']): MarksSubmission => ({
  status,
  version: 1,
  returnedReason: null,
  submittedAt: null,
});

const subject = (
  id: string,
  name: string,
  status: MarksSubmission['status'] | null,
  sectionId: string | null = 's1',
): TeacherExamSubject => ({
  examSubjectId: id,
  subjectName: name,
  sectionId,
  sectionName: sectionId ? 'A' : null,
  components: [],
  submission: status ? submission(status) : null,
});

const exam = (overrides: Partial<TeacherExam> = {}): TeacherExam => ({
  examId: 'e1',
  name: 'Second Terminal',
  sessionName: '2083',
  classId: 'c-class-8',
  className: 'Class 8',
  sectionId: 's1',
  sectionName: 'A',
  subjects: [],
  ...overrides,
});

describe('subjectProgress', () => {
  it('maps a null submission to notStarted and otherwise passes the backend status through', () => {
    expect(subjectProgress(null)).toBe('notStarted');
    expect(subjectProgress(submission('draft'))).toBe('draft');
    expect(subjectProgress(submission('submitted'))).toBe('submitted');
    expect(subjectProgress(submission('returned'))).toBe('returned');
  });

  it('picks a badge tone per progress', () => {
    expect(progressTone('notStarted')).toBe('neutral');
    expect(progressTone('draft')).toBe('neutral');
    expect(progressTone('submitted')).toBe('success');
    expect(progressTone('returned')).toBe('warning');
  });
});

describe('placementLabel', () => {
  it('joins class and section, and drops the separator for a class with no sections', () => {
    expect(placementLabel({ className: 'Class 8', sectionName: 'A' })).toBe('Class 8 · A');
    expect(placementLabel({ className: 'Class 6', sectionName: null })).toBe('Class 6');
  });
});

describe('buildExamCards', () => {
  it('builds title, subtitle and per-subject progress', () => {
    const [card] = buildExamCards([
      exam({ subjects: [subject('x1', 'Mathematics', 'submitted'), subject('x2', 'Science', null)] }),
    ]);
    expect(card).toMatchObject({
      key: 'e1:s1',
      title: 'Second Terminal',
      subtitle: '2083 · Class 8 · A',
      hasReturned: false,
      openCount: 1,
    });
    expect(card!.subjects).toEqual([
      { key: 'x2:s1', name: 'Science', progress: 'notStarted' },
      { key: 'x1:s1', name: 'Mathematics', progress: 'submitted' },
    ]);
  });

  it('orders subjects returned → still to do → submitted, keeping backend order within a group', () => {
    const [card] = buildExamCards([
      exam({
        subjects: [
          subject('a', 'English', 'submitted'),
          subject('b', 'Science', null),
          subject('c', 'Maths', 'returned'),
          subject('d', 'Nepali', 'draft'),
        ],
      }),
    ]);
    expect(card!.subjects.map((s) => s.name)).toEqual(['Maths', 'Science', 'Nepali', 'English']);
    expect(card!.openCount).toBe(3);
    expect(card!.hasReturned).toBe(true);
  });

  it('keys by section, with "none" for a class without sections, and labels it without a section', () => {
    const [card] = buildExamCards([
      exam({
        sectionId: null,
        sectionName: null,
        className: 'Class 6',
        subjects: [subject('x1', 'Art', null, null)],
      }),
    ]);
    expect(card!.key).toBe('e1:none');
    expect(card!.subtitle).toBe('2083 · Class 6');
    expect(card!.subjects[0]!.key).toBe('x1:none');
  });

  it('keeps two sections of the same exam as separate cards', () => {
    const cards = buildExamCards([
      exam({ sectionId: 's1', sectionName: 'A' }),
      exam({ sectionId: 's2', sectionName: 'B' }),
    ]);
    expect(new Set(cards.map((c) => c.key)).size).toBe(2);
  });

  it('sorts cards: returned first, then most open subjects, then title', () => {
    const cards = buildExamCards([
      exam({ examId: 'done', name: 'Zeta', subjects: [subject('1', 'M', 'submitted')] }),
      exam({ examId: 'few', name: 'Beta', subjects: [subject('2', 'M', null)] }),
      exam({ examId: 'many', name: 'Alpha', subjects: [subject('3', 'M', null), subject('4', 'S', 'draft')] }),
      exam({ examId: 'ret', name: 'Omega', subjects: [subject('5', 'M', 'returned')] }),
      exam({ examId: 'tie', name: 'Aaa', subjects: [subject('6', 'M', null)] }),
    ]);
    expect(cards.map((c) => c.title)).toEqual(['Omega', 'Alpha', 'Aaa', 'Beta', 'Zeta']);
  });

  it('handles no exams and an exam with no subjects', () => {
    expect(buildExamCards([])).toEqual([]);
    expect(buildExamCards([exam()])[0]).toMatchObject({ subjects: [], openCount: 0, hasReturned: false });
  });
});

describe('returnedCount', () => {
  it('counts returned subjects across cards', () => {
    const cards = buildExamCards([
      exam({ examId: 'e1', subjects: [subject('a', 'M', 'returned'), subject('b', 'S', 'returned')] }),
      exam({ examId: 'e2', subjects: [subject('c', 'M', 'returned'), subject('d', 'S', 'draft')] }),
    ]);
    expect(returnedCount(cards)).toBe(3);
    expect(returnedCount([])).toBe(0);
  });
});

describe('progressTotals', () => {
  it('counts subjects per state across every card', () => {
    const cards = buildExamCards([
      exam({ examId: 'e1', subjects: [subject('a', 'M', 'submitted'), subject('b', 'S', null), subject('c', 'E', 'draft')] }),
      exam({ examId: 'e2', subjects: [subject('d', 'M', 'submitted'), subject('e', 'S', 'returned')] }),
    ]);
    expect(progressTotals(cards)).toEqual({
      total: 5,
      counts: { notStarted: 1, draft: 1, submitted: 2, returned: 1 },
    });
  });

  it('is empty for no cards or cards without subjects', () => {
    const zero = { total: 0, counts: { notStarted: 0, draft: 0, submitted: 0, returned: 0 } };
    expect(progressTotals([])).toEqual(zero);
    expect(progressTotals(buildExamCards([exam()]))).toEqual(zero);
  });
});

describe('subjectsPerClass', () => {
  const assignment = (offering: string, classId: string, className: string, sectionId: string | null): TeacherSubjectAssignment => ({
    subjectOfferingId: offering,
    subjectName: `Subject ${offering}`,
    classId,
    className,
    sectionId,
    sectionName: sectionId ? sectionId.toUpperCase() : null,
  });

  it('counts per class and section, most first, ties by label', () => {
    const rows = subjectsPerClass([
      assignment('1', 'c8', 'Class 8', 'a'),
      assignment('2', 'c8', 'Class 8', 'b'),
      assignment('3', 'c8', 'Class 8', 'a'),
      assignment('4', 'c6', 'Class 6', null),
      assignment('5', 'c9', 'Class 9', 'a'),
    ]);
    expect(rows).toEqual([
      { key: 'c8:a', label: 'Class 8 · A', value: 2 },
      { key: 'c6:none', label: 'Class 6', value: 1 },
      { key: 'c8:b', label: 'Class 8 · B', value: 1 },
      { key: 'c9:a', label: 'Class 9 · A', value: 1 },
    ]);
  });

  it('is empty without assignments', () => {
    expect(subjectsPerClass([])).toEqual([]);
  });
});

describe('capList', () => {
  it('caps at 5 by default and reports how many were left out', () => {
    expect(capList([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4, 5], more: 2 });
  });

  it('shows everything when at or under the cap, and copes with empty input', () => {
    expect(capList([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3, 4, 5], more: 0 });
    expect(capList([])).toEqual({ shown: [], more: 0 });
  });

  it('accepts a custom cap', () => {
    expect(capList(['a', 'b', 'c'], 1)).toEqual({ shown: ['a'], more: 2 });
  });
});
