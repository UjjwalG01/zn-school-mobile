import type { ExamAttendanceRoster, ExamAttendanceRow } from '../../../../api/types/examAttendance';
import {
  applySaved,
  buildSaveRows,
  canMarkRemainingPresent,
  changedCount,
  conflictIds,
  discardEdit,
  EMPTY_DRAFT,
  failuresByEnrollment,
  isChanged,
  keepMine,
  markRemainingPresent,
  payloadSignature,
  setRemarks,
  setStatus,
  statusOptions,
  summaryText,
} from '../examAttendanceModel';

const row = (id: string, record: ExamAttendanceRow['record'] = null): ExamAttendanceRow => ({
  enrollmentId: id,
  fullName: `Student ${id}`,
  admissionNumber: `ADM-${id}`,
  rollNumber: null,
  record,
});

const ANIL = row('anil');
const BINA = row('bina', { status: 'absent', remarks: 'sick', version: 3 });
const CHANDRA = row('chandra');
const ROWS = [ANIL, BINA, CHANDRA];

describe('draft', () => {
  it('records the status a teacher picks, with the version they saw', () => {
    const draft = setStatus(EMPTY_DRAFT, BINA, 'present');
    expect(draft.bina).toEqual({ status: 'present', remarks: 'sick', baseVersion: 3 });
    expect(setStatus(EMPTY_DRAFT, ANIL, 'excused').anil).toEqual({ status: 'excused', remarks: '', baseVersion: 0 });
  });

  it('drops an edit that equals what is saved, so there are no phantom changes', () => {
    const edited = setStatus(EMPTY_DRAFT, BINA, 'present');
    expect(setStatus(edited, BINA, 'absent')).toEqual({});
    expect(changedCount(ROWS, edited)).toBe(1);
  });

  it('keeps the version first seen across later edits', () => {
    let draft = setStatus(EMPTY_DRAFT, BINA, 'present');
    draft = setRemarks(draft, BINA, 'came late');
    expect(draft.bina).toMatchObject({ status: 'present', remarks: 'came late', baseVersion: 3 });
  });

  it('ignores a remark for a student with no status yet, and compares remarks ignoring whitespace', () => {
    expect(setRemarks(EMPTY_DRAFT, ANIL, 'note')).toEqual({});
    const draft = setRemarks(EMPTY_DRAFT, BINA, '  sick ');
    expect(draft).toEqual({}); // same as saved after trimming
    expect(isChanged({ status: 'absent', remarks: 'sick  ', baseVersion: 3 }, BINA)).toBe(false);
  });

  it('marks only the students with nothing saved and nothing chosen as present', () => {
    const draft = markRemainingPresent(setStatus(EMPTY_DRAFT, ANIL, 'absent'), ROWS);
    expect(Object.keys(draft).sort()).toEqual(['anil', 'chandra']);
    expect(draft.anil!.status).toBe('absent'); // an edit is never overwritten
    expect(draft.chandra).toEqual({ status: 'present', remarks: '', baseVersion: 0 });
    expect(canMarkRemainingPresent(ROWS, EMPTY_DRAFT)).toBe(true);
    expect(canMarkRemainingPresent([BINA], EMPTY_DRAFT)).toBe(false);
  });
});

describe('what is sent', () => {
  it('builds only the changed rows, in roster order, with the version seen (0 = none) and a trimmed remark', () => {
    let draft = setStatus(EMPTY_DRAFT, CHANDRA, 'excused');
    draft = setRemarks(draft, CHANDRA, '  has a certificate ');
    draft = setStatus(draft, ANIL, 'present');
    draft = setStatus(draft, BINA, 'absent'); // unchanged: dropped
    expect(buildSaveRows(ROWS, draft)).toEqual([
      { enrollmentId: 'anil', status: 'present', version: 0 },
      { enrollmentId: 'chandra', status: 'excused', remarks: 'has a certificate', version: 0 },
    ]);
  });

  it('fingerprints the payload without the key, whatever the order of the rows', () => {
    const a = payloadSignature({
      examSubjectId: 'p1',
      records: [
        { enrollmentId: 'anil', status: 'present', version: 0 },
        { enrollmentId: 'bina', status: 'absent', version: 3 },
      ],
    });
    const b = payloadSignature({
      examSubjectId: 'p1',
      records: [
        { enrollmentId: 'bina', status: 'absent', version: 3 },
        { enrollmentId: 'anil', status: 'present', version: 0 },
      ],
    });
    expect(a).toBe(b);
    expect(payloadSignature({ examSubjectId: 'p2', records: [] })).not.toBe(payloadSignature({ examSubjectId: 'p1', records: [] }));
  });

  it('reads the backend’s refusal per enrollment, first reason wins', () => {
    expect(
      failuresByEnrollment([
        { identifier: { enrollmentId: 'anil', row: 1 }, error: 'first' },
        { identifier: { enrollmentId: 'anil', row: 2 }, error: 'second' },
        { identifier: { enrollmentId: 'bina', row: 3 }, error: 'other' },
      ]),
    ).toEqual({ anil: 'first', bina: 'other' });
  });
});

describe('conflicts', () => {
  it('flags a student whose saved record moved after the teacher edited them, and resolves either way', () => {
    const draft = setStatus(EMPTY_DRAFT, BINA, 'present'); // saw version 3
    const moved = row('bina', { status: 'excused', remarks: null, version: 4 });
    expect(conflictIds([ANIL, moved, CHANDRA], draft)).toEqual(['bina']);
    expect(conflictIds(ROWS, draft)).toEqual([]);

    expect(conflictIds([moved], keepMine(draft, moved))).toEqual([]); // rebased on version 4
    expect(keepMine(draft, moved).bina!.baseVersion).toBe(4);
    expect(discardEdit(draft, 'bina')).toEqual({});
  });
});

describe('what is shown', () => {
  it('offers the three fixed statuses, labelled and coded from the message catalogue', () => {
    expect(statusOptions().map((option) => [option.status, option.label, option.shortCode])).toEqual([
      ['present', 'Present', 'P'],
      ['absent', 'Absent', 'A'],
      ['excused', 'Excused', 'E'],
    ]);
  });

  it('summarises the roster as the teacher currently sees it', () => {
    expect(summaryText(ROWS, EMPTY_DRAFT)).toBe('Present 0 · Absent 1 · Excused 0 · Not marked 2');
    expect(summaryText(ROWS, markRemainingPresent(EMPTY_DRAFT, ROWS))).toBe('Present 2 · Absent 1 · Excused 0 · Not marked 0');
  });

  it('uses the write response instead of a refetch: saved rows hold the new status and version', () => {
    const roster: ExamAttendanceRoster = {
      exam: { id: 'x', name: 'Terminal', status: 'published' },
      examSubject: { id: 'p', subjectName: 'Maths', examDate: null },
      editable: true,
      rows: ROWS,
    };
    let draft = setStatus(EMPTY_DRAFT, ANIL, 'present');
    draft = setStatus(draft, BINA, 'excused');
    const next = applySaved(roster, draft, [
      { enrollmentId: 'anil', id: 'r1', version: 1, outcome: 'created' },
      { enrollmentId: 'bina', id: 'r2', version: 4, outcome: 'updated' },
    ]);
    expect(next.rows[0]!.record).toEqual({ status: 'present', remarks: null, version: 1 });
    expect(next.rows[1]!.record).toEqual({ status: 'excused', remarks: 'sick', version: 4 });
    expect(next.rows[2]).toBe(CHANDRA);
  });
});
