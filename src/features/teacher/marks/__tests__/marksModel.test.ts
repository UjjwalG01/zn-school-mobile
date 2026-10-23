import type { ExamResult, ExamRosterRow, MarksSubmissionRow } from '../../../../api/types/academic';
import type { ExamComponent, TeacherExam } from '../../../../api/types/portal';
import {
  buildItems,
  changedCount,
  completeCount,
  conflictIds,
  type Draft,
  dropEntries,
  EMPTY_DRAFT,
  failuresByEnrollment,
  findSlot,
  indexResults,
  isChanged,
  keepMine,
  mergeResults,
  parseMark,
  payloadSignature,
  saveCounts,
  savedText,
  setValue,
  shownText,
  sortRoster,
  studentMarks,
  withSubmission,
} from '../marksModel';

const THEORY: ExamComponent = { id: 'c-theory', name: 'Theory', maxMarks: '80.00' };
const PRACTICAL: ExamComponent = { id: 'c-prac', name: 'Practical', maxMarks: '20.00' };
const COMPONENTS = [THEORY, PRACTICAL];

const student = (id: string, rollNumber: string | null = null): ExamRosterRow => ({
  enrollmentId: `e-${id}`,
  fullName: `Student ${id}`,
  admissionNumber: id,
  rollNumber,
});
const ANIL = student('anil', '1');
const BINA = student('bina', '2');
const ROWS = [ANIL, BINA];

const result = (id: string, version: number, marks: Record<string, string>): ExamResult => ({
  id: `r-${id}`,
  enrollmentId: `e-${id}`,
  version,
  components: Object.entries(marks).map(([examComponentId, obtainedMarks]) => ({ examComponentId, obtainedMarks })),
});
// Bina has both marks saved; Anil has no result yet.
const BINA_RESULT = result('bina', 3, { [THEORY.id]: '75.00', [PRACTICAL.id]: '18.50' });
const RESULTS = indexResults([BINA_RESULT]);

const type = (draft: Draft, row: ExamRosterRow, componentId: string, text: string): Draft =>
  setValue(draft, row.enrollmentId, RESULTS.get(row.enrollmentId), componentId, text);

describe('parseMark', () => {
  it('reads empty, a number, a decimal comma and the edges', () => {
    expect(parseMark('  ', '80.00')).toEqual({ kind: 'empty' });
    expect(parseMark('72', '80.00')).toEqual({ kind: 'ok', value: 72 });
    expect(parseMark('72.5', '80.00')).toEqual({ kind: 'ok', value: 72.5 });
    expect(parseMark('72,5', '80.00')).toEqual({ kind: 'ok', value: 72.5 });
    expect(parseMark('.5', '80.00')).toEqual({ kind: 'ok', value: 0.5 });
    expect(parseMark('12.', '80.00')).toEqual({ kind: 'ok', value: 12 });
    expect(parseMark('80', '80.00')).toEqual({ kind: 'ok', value: 80 }); // the maximum itself is valid
    expect(parseMark('0', '80.00')).toEqual({ kind: 'ok', value: 0 });
  });

  it('flags text that is not a plain number, too many decimals and a mark above the maximum', () => {
    for (const bad of ['abc', '-5', '1e3', '0x10', '1.2.3', '७२']) {
      expect(parseMark(bad, '80.00')).toEqual({ kind: 'invalid', problem: 'number' });
    }
    expect(parseMark('1.234', '80.00')).toEqual({ kind: 'invalid', problem: 'decimals' });
    expect(parseMark('80.01', '80.00')).toEqual({ kind: 'invalid', problem: 'range' });
    expect(parseMark('21', '20.00')).toEqual({ kind: 'invalid', problem: 'range' });
  });
});

describe('saved and shown text', () => {
  it('shows the backend decimal strings without trailing zeros and prefers what was typed', () => {
    expect(savedText(BINA_RESULT, THEORY.id)).toBe('75');
    expect(savedText(BINA_RESULT, PRACTICAL.id)).toBe('18.5');
    expect(savedText(undefined, THEORY.id)).toBe('');
    expect(savedText(BINA_RESULT, 'other-subject')).toBe('');
    const draft = type(EMPTY_DRAFT, BINA, THEORY.id, '60');
    expect(shownText(draft[BINA.enrollmentId], BINA_RESULT, THEORY.id)).toBe('60');
    expect(shownText(draft[BINA.enrollmentId], BINA_RESULT, PRACTICAL.id)).toBe('18.5');
  });
});

describe('setValue', () => {
  it('remembers the version first seen and keeps it across later edits', () => {
    const first = type(EMPTY_DRAFT, BINA, THEORY.id, '60');
    expect(first[BINA.enrollmentId]).toEqual({ values: { [THEORY.id]: '60' }, baseVersion: 3 });
    const second = type(first, BINA, PRACTICAL.id, '15');
    expect(second[BINA.enrollmentId]).toEqual({
      values: { [THEORY.id]: '60', [PRACTICAL.id]: '15' },
      baseVersion: 3,
    });
  });

  it('uses version 0 for a student with no result yet', () => {
    expect(type(EMPTY_DRAFT, ANIL, THEORY.id, '70')[ANIL.enrollmentId]!.baseVersion).toBe(0);
  });

  it('drops the edit when every typed value equals what is saved (no phantom change)', () => {
    const changed = type(EMPTY_DRAFT, BINA, THEORY.id, '60');
    expect(type(changed, BINA, THEORY.id, '75.0')).toEqual({});
    expect(type(EMPTY_DRAFT, ANIL, THEORY.id, '')).toEqual({}); // nothing saved, nothing typed
  });

  it('keeps an invalid entry as a change, so it is shown and never sent', () => {
    const draft = type(EMPTY_DRAFT, BINA, THEORY.id, 'abc');
    expect(isChanged(draft[BINA.enrollmentId]!, BINA_RESULT)).toBe(true);
  });
});

describe('studentMarks', () => {
  it('is complete only when every component holds a valid number, saved or typed', () => {
    expect(studentMarks(COMPONENTS, undefined, BINA_RESULT)).toMatchObject({ complete: true, changed: false, entered: 2 });
    expect(studentMarks(COMPONENTS, undefined, undefined)).toMatchObject({ complete: false, entered: 0 });

    const partial = type(EMPTY_DRAFT, ANIL, THEORY.id, '70')[ANIL.enrollmentId];
    expect(studentMarks(COMPONENTS, partial, undefined)).toMatchObject({ complete: false, entered: 1, changed: true, numbers: null });

    const whole = type(type(EMPTY_DRAFT, ANIL, THEORY.id, '70'), ANIL, PRACTICAL.id, '15')[ANIL.enrollmentId];
    expect(studentMarks(COMPONENTS, whole, undefined)).toMatchObject({ complete: true, changed: true, numbers: [70, 15] });
  });

  it('names the problem per field and is not complete with one', () => {
    const draft = type(type(EMPTY_DRAFT, ANIL, THEORY.id, '95'), ANIL, PRACTICAL.id, '15')[ANIL.enrollmentId];
    const state = studentMarks(COMPONENTS, draft, undefined);
    expect(state.fields.map((field) => field.problem)).toEqual(['range', null]);
    expect(state.complete).toBe(false);
  });

  it('is not complete for a subject without components', () => {
    expect(studentMarks([], undefined, undefined).complete).toBe(false);
  });
});

describe('conflicts', () => {
  it('flags a changed student whose saved result moved since the teacher first saw it', () => {
    const draft = type(EMPTY_DRAFT, BINA, THEORY.id, '60'); // saw version 3
    expect(conflictIds(ROWS, RESULTS, draft)).toEqual([]);

    const moved = indexResults([{ ...BINA_RESULT, version: 4 }]);
    expect(conflictIds(ROWS, moved, draft)).toEqual([BINA.enrollmentId]);
  });

  it('does not flag an unchanged student, or one the other save made equal to the edit', () => {
    const draft = type(EMPTY_DRAFT, BINA, THEORY.id, '60');
    const sameNow = indexResults([result('bina', 4, { [THEORY.id]: '60.00', [PRACTICAL.id]: '18.50' })]);
    expect(conflictIds(ROWS, sameNow, draft)).toEqual([]);
  });

  it('keep mine rebases onto the new version; use theirs drops the edit', () => {
    const draft = type(EMPTY_DRAFT, BINA, THEORY.id, '60');
    const moved = { ...BINA_RESULT, version: 4 };

    const kept = keepMine(draft, BINA.enrollmentId, moved);
    expect(kept[BINA.enrollmentId]).toMatchObject({ baseVersion: 4 });
    expect(conflictIds(ROWS, indexResults([moved]), kept)).toEqual([]);

    expect(dropEntries(draft, [BINA.enrollmentId])).toEqual({});
  });

  it('keep mine on an edit that now equals the saved marks makes it disappear', () => {
    const draft = type(EMPTY_DRAFT, BINA, THEORY.id, '60');
    const sameNow = { ...BINA_RESULT, version: 4, components: [{ examComponentId: THEORY.id, obtainedMarks: '60.00' }, { examComponentId: PRACTICAL.id, obtainedMarks: '18.50' }] };
    expect(keepMine(draft, BINA.enrollmentId, sameNow)).toEqual({});
  });
});

describe('what a save sends', () => {
  const draftOf = (...steps: [ExamRosterRow, string, string][]) =>
    steps.reduce((draft, [row, componentId, text]) => type(draft, row, componentId, text), EMPTY_DRAFT);

  it('sends only changed, complete students, every component, in roster order, with the version seen', () => {
    const draft = draftOf(
      [BINA, THEORY.id, '60'], // changed, complete (practical is saved)
      [ANIL, THEORY.id, '70'], // changed but practical missing
    );

    expect(saveCounts(ROWS, RESULTS, COMPONENTS, draft)).toEqual({ ready: 1, incomplete: 1 });
    expect(buildItems(ROWS, RESULTS, COMPONENTS, draft)).toEqual([
      {
        enrollmentId: BINA.enrollmentId,
        components: [
          { examComponentId: THEORY.id, obtainedMarks: 60 },
          { examComponentId: PRACTICAL.id, obtainedMarks: 18.5 },
        ],
        version: 3,
      },
    ]);
  });

  it('sends version 0 for a student with no result and orders by the roster', () => {
    const draft = draftOf([BINA, THEORY.id, '60'], [ANIL, THEORY.id, '70'], [ANIL, PRACTICAL.id, '15']);

    const items = buildItems(ROWS, RESULTS, COMPONENTS, draft);

    expect(items.map((item) => [item.enrollmentId, item.version])).toEqual([
      [ANIL.enrollmentId, 0],
      [BINA.enrollmentId, 3],
    ]);
  });

  it('never sends an invalid mark and counts that student as incomplete', () => {
    const draft = draftOf([BINA, THEORY.id, '95']);

    expect(buildItems(ROWS, RESULTS, COMPONENTS, draft)).toEqual([]);
    expect(saveCounts(ROWS, RESULTS, COMPONENTS, draft)).toEqual({ ready: 0, incomplete: 1 });
  });

  it('counts complete students as the teacher sees them, and unsaved changes', () => {
    expect(completeCount(ROWS, RESULTS, COMPONENTS, EMPTY_DRAFT)).toBe(1); // Bina only
    const draft = draftOf([ANIL, THEORY.id, '70'], [ANIL, PRACTICAL.id, '15']);
    expect(completeCount(ROWS, RESULTS, COMPONENTS, draft)).toBe(2);
    expect(changedCount(ROWS, RESULTS, draft)).toBe(1);
    expect(changedCount(ROWS, RESULTS, EMPTY_DRAFT)).toBe(0);
  });
});

describe('payloadSignature', () => {
  const item = (id: string, marks: number, version = 0) => ({
    enrollmentId: id,
    components: [{ examComponentId: 'c1', obtainedMarks: marks }],
    version,
  });
  const base = { examId: 'x1', items: [item('a', 70), item('b', 60)] };

  it('is the same for the same content in any order, and changes with the exam, a mark or a version', () => {
    const sig = payloadSignature(base);
    expect(payloadSignature({ ...base, items: [item('b', 60), item('a', 70)] })).toBe(sig);
    expect(payloadSignature({ ...base, examId: 'x2' })).not.toBe(sig);
    expect(payloadSignature({ ...base, items: [item('a', 71), item('b', 60)] })).not.toBe(sig);
    expect(payloadSignature({ ...base, items: [item('a', 70, 1), item('b', 60)] })).not.toBe(sig);
  });
});

describe('failuresByEnrollment', () => {
  it('maps each student to the backend reason, first one wins', () => {
    expect(
      failuresByEnrollment([
        { identifier: { enrollmentId: 'e1' }, error: 'Mark out of range' },
        { identifier: { enrollmentId: 'e1' }, error: 'second' },
        { identifier: { enrollmentId: 'e2' }, error: 'Not eligible' },
      ]),
    ).toEqual({ e1: 'Mark out of range', e2: 'Not eligible' });
  });
});

describe('mergeResults', () => {
  it('replaces a saved student, keeps the others and adds a new one', () => {
    const before = [BINA_RESULT, result('chandra', 1, { [THEORY.id]: '50' })];
    const saved = [
      { ...BINA_RESULT, version: 4 },
      result('anil', 1, { [THEORY.id]: '70', [PRACTICAL.id]: '15' }),
    ];

    const merged = mergeResults(before, saved);

    expect(merged.map((r) => [r.enrollmentId, r.version])).toEqual([
      ['e-bina', 4],
      ['e-chandra', 1],
      ['e-anil', 1],
    ]);
  });
});

describe('sortRoster', () => {
  it('sorts roll numbers numerically, missing last, then by name', () => {
    const rows = [student('x', '10'), student('y', null), student('z', '2'), student('w', null)];
    expect(sortRoster(rows).map((row) => row.admissionNumber)).toEqual(['z', 'x', 'w', 'y']);
  });
});

describe('the subject slot', () => {
  const exams: TeacherExam[] = [
    {
      examId: 'x1',
      name: 'Second Terminal',
      sessionName: '2083',
      classId: 'c-class-8',
      className: 'Class 8',
      sectionId: null,
      sectionName: null,
      subjects: [
        { examSubjectId: 'es1', subjectName: 'Maths', sectionId: 's-a', sectionName: 'A', components: COMPONENTS, submission: null },
        { examSubjectId: 'es1', subjectName: 'Maths', sectionId: 's-b', sectionName: 'B', components: COMPONENTS, submission: null },
      ],
    },
  ];

  it('finds the subject of the named section only', () => {
    expect(findSlot(exams, { examId: 'x1', examSubjectId: 'es1', sectionId: 's-b' })?.subject.sectionName).toBe('B');
    expect(findSlot(exams, { examId: 'x1', examSubjectId: 'es1', sectionId: null })).toBeNull();
    expect(findSlot(exams, { examId: 'gone', examSubjectId: 'es1', sectionId: 's-a' })).toBeNull();
  });

  it('a submit response replaces that one section’s submission', () => {
    const row: MarksSubmissionRow = {
      id: 'sub1',
      examSubjectId: 'es1',
      sectionId: 's-a',
      status: 'submitted',
      returnedReason: null,
      submittedAt: '2026-10-22T10:00:00Z',
      version: 2,
    };

    const next = withSubmission(exams, { examId: 'x1', examSubjectId: 'es1', sectionId: 's-a' }, row);

    expect(next[0]!.subjects[0]!.submission).toEqual({
      status: 'submitted',
      version: 2,
      returnedReason: null,
      submittedAt: '2026-10-22T10:00:00Z',
    });
    expect(next[0]!.subjects[1]!.submission).toBeNull();
    expect(exams[0]!.subjects[0]!.submission).toBeNull(); // the cached list is not mutated
  });
});
