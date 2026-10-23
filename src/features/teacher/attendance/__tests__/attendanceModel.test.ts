import type {
  AttendanceRoster,
  AttendanceSettings,
  AttendanceStatus,
  RosterRow,
} from '../../../../api/types/attendance';
import {
  applySaved,
  attemptFor,
  buildBulkRows,
  canMarkRemainingPresent,
  changedCount,
  conflictIds,
  dateBounds,
  type Draft,
  EMPTY_DRAFT,
  effective,
  failuresByStudent,
  isChanged,
  keepKeyAfter,
  keepMine,
  labelFor,
  markRemainingPresent,
  payloadSignature,
  setRemarks,
  setStatus,
  statusOptions,
  summarize,
  summaryText,
  discardEdit,
} from '../attendanceModel';

const row = (
  studentId: string,
  record: { status: AttendanceStatus; version: number; remarks?: string | null } | null = null,
): RosterRow => ({
  enrollmentId: `e-${studentId}`,
  studentId,
  fullName: `Student ${studentId}`,
  admissionNumber: `ADM-${studentId}`,
  rollNumber: null,
  sectionId: 's1',
  record: record && { id: `r-${studentId}`, status: record.status, remarks: record.remarks ?? null, version: record.version },
});

const SETTINGS: AttendanceSettings = {
  backdateWindowDays: 7,
  statuses: [
    { status: 'late', label: 'Late', shortCode: 'L', sortOrder: 3, active: true },
    { status: 'present', label: 'Here', shortCode: 'P', sortOrder: 1, active: true },
    { status: 'absent', label: 'Absent', shortCode: 'A', sortOrder: 2, active: true },
    { status: 'half_day', label: 'Half day', shortCode: 'HD', sortOrder: 4, active: false },
    { status: 'excused', label: 'Excused', shortCode: 'E', sortOrder: 5, active: true },
  ],
};

describe('setStatus', () => {
  it('starts an edit from the version of the saved record the teacher saw (0 when none)', () => {
    const fresh = setStatus(EMPTY_DRAFT, row('a'), 'present');
    expect(fresh).toEqual({ a: { status: 'present', remarks: '', baseVersion: 0 } });

    const saved = setStatus(EMPTY_DRAFT, row('b', { status: 'present', version: 4 }), 'absent');
    expect(saved.b).toEqual({ status: 'absent', remarks: '', baseVersion: 4 });
  });

  it('keeps the first base version when the same student is edited again', () => {
    const first = setStatus(EMPTY_DRAFT, row('a', { status: 'present', version: 2 }), 'absent');
    // a refresh brought version 3, then the teacher edits again
    const second = setStatus(first, row('a', { status: 'present', version: 3 }), 'late');
    expect(second.a!.baseVersion).toBe(2);
  });

  it('carries the saved remark into the edit', () => {
    const next = setStatus(EMPTY_DRAFT, row('a', { status: 'present', version: 1, remarks: 'bus' }), 'late');
    expect(next.a!.remarks).toBe('bus');
  });

  it('drops an edit that equals the saved record, so there are no phantom changes', () => {
    const saved = row('a', { status: 'present', version: 1 });
    const edited = setStatus(EMPTY_DRAFT, saved, 'absent');
    expect(setStatus(edited, saved, 'present')).toEqual({});
  });
});

describe('setRemarks', () => {
  it('adds a remark to a chosen status', () => {
    const chosen = setStatus(EMPTY_DRAFT, row('a'), 'late');
    expect(setRemarks(chosen, row('a'), 'bus broke down').a!.remarks).toBe('bus broke down');
  });

  it('can change only the remark of a saved status', () => {
    const next = setRemarks(EMPTY_DRAFT, row('a', { status: 'present', version: 3 }), 'checked');
    expect(next.a).toEqual({ status: 'present', remarks: 'checked', baseVersion: 3 });
  });

  it('ignores a remark for a student with no status at all', () => {
    expect(setRemarks(EMPTY_DRAFT, row('a'), 'x')).toEqual({});
  });

  it('treats whitespace-only remarks as no change', () => {
    const saved = row('a', { status: 'present', version: 1, remarks: null });
    expect(setRemarks(EMPTY_DRAFT, saved, '   ')).toEqual({});
  });
});

describe('effective and isChanged', () => {
  it('shows the edit over the saved record, else the saved record, else nothing', () => {
    const draft: Draft = { a: { status: 'absent', remarks: 'sick', baseVersion: 1 } };
    expect(effective(row('a', { status: 'present', version: 1 }), draft)).toEqual({ status: 'absent', remarks: 'sick' });
    expect(effective(row('b', { status: 'late', version: 1, remarks: 'bus' }), draft)).toEqual({ status: 'late', remarks: 'bus' });
    expect(effective(row('c'), draft)).toEqual({ status: null, remarks: '' });
  });

  it('compares status and trimmed remarks with the saved record', () => {
    const saved = row('a', { status: 'present', version: 1, remarks: 'ok' });
    expect(isChanged({ status: 'present', remarks: ' ok ', baseVersion: 1 }, saved)).toBe(false);
    expect(isChanged({ status: 'absent', remarks: 'ok', baseVersion: 1 }, saved)).toBe(true);
    expect(isChanged({ status: 'present', remarks: '', baseVersion: 1 }, saved)).toBe(true);
    expect(isChanged({ status: 'present', remarks: '', baseVersion: 0 }, row('b'))).toBe(true);
  });
});

describe('markRemainingPresent', () => {
  it('marks only students with no saved record and no edit', () => {
    const rows = [
      row('new'),
      row('saved', { status: 'absent', version: 2 }),
      row('edited'),
    ];
    const draft = setStatus(EMPTY_DRAFT, rows[2]!, 'late');

    const next = markRemainingPresent(draft, rows);

    expect(next.new).toEqual({ status: 'present', remarks: '', baseVersion: 0 });
    expect(next.saved).toBeUndefined(); // never overwrites a saved record
    expect(next.edited!.status).toBe('late'); // never overwrites the teacher's edit
  });

  it('is offered only when present is in use and someone is left to mark', () => {
    const rows = [row('a')];
    expect(canMarkRemainingPresent(SETTINGS, rows, EMPTY_DRAFT)).toBe(true);
    expect(canMarkRemainingPresent(SETTINGS, rows, markRemainingPresent(EMPTY_DRAFT, rows))).toBe(false);
    expect(canMarkRemainingPresent(SETTINGS, [row('b', { status: 'absent', version: 1 })], EMPTY_DRAFT)).toBe(false);

    const noPresent: AttendanceSettings = {
      ...SETTINGS,
      statuses: SETTINGS.statuses.map((s) => (s.status === 'present' ? { ...s, active: false } : s)),
    };
    expect(canMarkRemainingPresent(noPresent, rows, EMPTY_DRAFT)).toBe(false);
  });
});

describe('conflicts', () => {
  const edited = setStatus(EMPTY_DRAFT, row('a', { status: 'present', version: 2 }), 'absent');

  it('flags an edit whose saved record moved on since the teacher saw it', () => {
    expect(conflictIds([row('a', { status: 'late', version: 3 })], edited)).toEqual(['a']);
  });

  it('does not flag an edit on an unchanged version, or students the teacher never touched', () => {
    expect(conflictIds([row('a', { status: 'present', version: 2 })], edited)).toEqual([]);
    expect(conflictIds([row('z', { status: 'late', version: 9 })], edited)).toEqual([]);
  });

  it('does not flag an edit that now equals what is saved (someone saved the same thing)', () => {
    expect(conflictIds([row('a', { status: 'absent', version: 3 })], edited)).toEqual([]);
  });

  it('flags a first-time mark when someone else recorded the student meanwhile', () => {
    const mine = markRemainingPresent(EMPTY_DRAFT, [row('n')]);
    expect(conflictIds([row('n', { status: 'absent', version: 1 })], mine)).toEqual(['n']);
  });

  it('"keep mine" rebases the edit on the version now saved', () => {
    const now = row('a', { status: 'late', version: 3 });
    const next = keepMine(edited, now);
    expect(next.a).toEqual({ status: 'absent', remarks: '', baseVersion: 3 });
    expect(conflictIds([now], next)).toEqual([]);
  });

  it('"keep mine" drops an edit that already equals the saved record', () => {
    expect(keepMine(edited, row('a', { status: 'absent', version: 3 }))).toEqual({});
  });

  it('"use theirs" drops the edit', () => {
    expect(discardEdit(edited, 'a')).toEqual({});
    expect(discardEdit(edited, 'zzz')).toEqual(edited);
  });
});

describe('buildBulkRows and changedCount', () => {
  it('sends only changed rows, in roster order, with the version the teacher saw', () => {
    const rows = [
      row('a', { status: 'present', version: 4 }),
      row('b'),
      row('c', { status: 'late', version: 1 }),
      row('d'),
    ];
    let draft = setStatus(EMPTY_DRAFT, rows[3]!, 'absent');
    draft = setStatus(draft, rows[0]!, 'absent');
    draft = setStatus(draft, rows[1]!, 'present');

    expect(buildBulkRows(rows, draft)).toEqual([
      { studentId: 'a', status: 'absent', version: 4 },
      { studentId: 'b', status: 'present', version: 0 },
      { studentId: 'd', status: 'absent', version: 0 },
    ]);
    expect(changedCount(rows, draft)).toBe(3);
  });

  it('trims remarks and leaves the field out when empty', () => {
    const rows = [row('a'), row('b', { status: 'present', version: 1, remarks: 'old' })];
    let draft = setRemarks(setStatus(EMPTY_DRAFT, rows[0]!, 'late'), rows[0]!, '  bus  ');
    draft = setRemarks(draft, rows[1]!, ''); // clearing a saved remark is a change, sent as no remark

    const built = buildBulkRows(rows, draft);
    expect(built[0]).toEqual({ studentId: 'a', status: 'late', remarks: 'bus', version: 0 });
    expect(built[1]).toEqual({ studentId: 'b', status: 'present', version: 1 });
    expect('remarks' in built[1]!).toBe(false);
  });

  it('ignores edits for students no longer on the roster, and entries that became equal to saved', () => {
    const draft: Draft = {
      gone: { status: 'present', remarks: '', baseVersion: 0 },
      same: { status: 'present', remarks: '', baseVersion: 1 },
    };
    const rows = [row('same', { status: 'present', version: 2 })];
    expect(buildBulkRows(rows, draft)).toEqual([]);
    expect(changedCount(rows, draft)).toBe(0);
  });
});

describe('payloadSignature and the idempotency key lifecycle', () => {
  const base = {
    attendanceDate: '2026-10-21',
    classId: 'c1',
    sectionId: 's1',
    records: [
      { studentId: 'a', status: 'present' as const, version: 0 },
      { studentId: 'b', status: 'absent' as const, remarks: 'sick', version: 2 },
    ],
  };

  it('is the same for the same content in any order', () => {
    const shuffled = { ...base, records: [...base.records].reverse() };
    expect(payloadSignature(shuffled)).toBe(payloadSignature(base));
  });

  it('changes with any status, remark, version, date, class or section', () => {
    const sig = payloadSignature(base);
    const first = base.records[0]!;
    expect(payloadSignature({ ...base, records: [{ ...first, status: 'late' }, base.records[1]!] })).not.toBe(sig);
    expect(payloadSignature({ ...base, records: [{ ...first, remarks: 'x' }, base.records[1]!] })).not.toBe(sig);
    expect(payloadSignature({ ...base, records: [{ ...first, version: 1 }, base.records[1]!] })).not.toBe(sig);
    expect(payloadSignature({ ...base, attendanceDate: '2026-10-20' })).not.toBe(sig);
    expect(payloadSignature({ ...base, classId: 'c2' })).not.toBe(sig);
    expect(payloadSignature({ ...base, sectionId: 's2' })).not.toBe(sig);
    expect(payloadSignature({ ...base, sectionId: undefined })).not.toBe(sig);
  });

  it('reuses the key for an identical payload and makes a new one after any edit', () => {
    let n = 0;
    const makeKey = () => `key-${(n += 1)}`;

    const first = attemptFor('sig-1', null, makeKey);
    expect(first).toEqual({ signature: 'sig-1', key: 'key-1' });
    expect(attemptFor('sig-1', first, makeKey)).toBe(first); // retry of the identical payload
    expect(attemptFor('sig-2', first, makeKey)).toEqual({ signature: 'sig-2', key: 'key-2' }); // edited
    expect(n).toBe(2);
  });

  it('keeps the key only when the server may have processed the request', () => {
    expect(keepKeyAfter('offline')).toBe(true);
    expect(keepKeyAfter('server')).toBe(true);
    for (const action of ['conflict', 'validation', 'forbidden', 'feature-denied', 'wait', 'unknown'] as const) {
      expect(keepKeyAfter(action)).toBe(false);
    }
  });
});

describe('failuresByStudent', () => {
  it('maps each student to the backend reason, first one wins', () => {
    expect(
      failuresByStudent([
        { identifier: { studentId: 'a', row: 1 }, error: 'first' },
        { identifier: { studentId: 'b', row: 2 }, error: 'other' },
        { identifier: { studentId: 'a', row: 3 }, error: 'second' },
      ]),
    ).toEqual({ a: 'first', b: 'other' });
    expect(failuresByStudent([])).toEqual({});
  });
});

describe('school statuses', () => {
  it('offers only active statuses, in the school order', () => {
    expect(statusOptions(SETTINGS).map((s) => s.status)).toEqual(['present', 'absent', 'late', 'excused']);
  });

  it('does not mutate the settings when sorting', () => {
    const before = SETTINGS.statuses.map((s) => s.status);
    statusOptions(SETTINGS);
    expect(SETTINGS.statuses.map((s) => s.status)).toEqual(before);
  });

  it('labels with the school wording, including a status that is switched off', () => {
    expect(labelFor(SETTINGS, 'present')).toBe('Here');
    expect(labelFor(SETTINGS, 'half_day')).toBe('Half day');
  });

  it('falls back to the status value when the school has no entry', () => {
    expect(labelFor({ ...SETTINGS, statuses: [] }, 'absent')).toBe('absent');
  });
});

describe('summarize', () => {
  it('counts the roster as the teacher sees it, edits over saved records', () => {
    const rows = [
      row('a', { status: 'present', version: 1 }),
      row('b', { status: 'present', version: 1 }),
      row('c'),
      row('d'),
    ];
    const draft = setStatus(EMPTY_DRAFT, rows[1]!, 'absent');

    expect(summarize(rows, draft)).toEqual({ byStatus: { present: 1, absent: 1 }, notMarked: 2 });
    expect(summarize([], EMPTY_DRAFT)).toEqual({ byStatus: {}, notMarked: 0 });
  });
});

describe('summaryText', () => {
  it('lists the school labels in the school order, with zero counts for statuses in use', () => {
    const rows = [row('a'), row('b'), row('c')];
    const draft = markRemainingPresent(EMPTY_DRAFT, [rows[0]!]);

    expect(summaryText(SETTINGS, summarize(rows, draft), 'Not marked')).toBe(
      'Here 1 · Absent 0 · Late 0 · Excused 0 · Not marked 2',
    );
  });

  it('shows a switched-off status only while some student still has it', () => {
    const rows = [row('a', { status: 'half_day', version: 1 })];
    expect(summaryText(SETTINGS, summarize(rows, EMPTY_DRAFT), 'Not marked')).toContain('Half day 1');
    expect(summaryText(SETTINGS, summarize([], EMPTY_DRAFT), 'Not marked')).not.toContain('Half day');
  });
});

describe('applySaved', () => {
  const roster: AttendanceRoster = {
    date: '2026-10-21',
    dayInfo: { schoolDay: true, reason: null, holidayName: null },
    rows: [row('a'), row('b', { status: 'present', version: 1 }), row('c', { status: 'late', version: 5 })],
  };

  it('puts the teacher\'s status, trimmed remark and the returned id and version on each saved row', () => {
    let draft = setRemarks(setStatus(EMPTY_DRAFT, roster.rows[0]!, 'present'), roster.rows[0]!, ' on time ');
    draft = setStatus(draft, roster.rows[1]!, 'absent');

    const next = applySaved(roster, draft, [
      { studentId: 'a', id: 'new-a', version: 1, outcome: 'created' },
      { studentId: 'b', id: 'r-b', version: 2, outcome: 'updated' },
    ]);

    expect(next.rows[0]!.record).toEqual({ id: 'new-a', status: 'present', remarks: 'on time', version: 1 });
    expect(next.rows[1]!.record).toEqual({ id: 'r-b', status: 'absent', remarks: null, version: 2 });
    expect(next.rows[2]).toBe(roster.rows[2]); // not part of the save
  });

  it('takes the returned version for an unchanged row (the server already held the same value)', () => {
    const draft = setStatus(EMPTY_DRAFT, roster.rows[0]!, 'present');
    const next = applySaved(roster, draft, [{ studentId: 'a', id: 'x', version: 7, outcome: 'unchanged' }]);
    expect(next.rows[0]!.record!.version).toBe(7);
  });

  it('leaves the rest of the roster untouched and does not mutate the input', () => {
    const snapshot = JSON.stringify(roster);
    const draft = setStatus(EMPTY_DRAFT, roster.rows[0]!, 'present');
    const next = applySaved(roster, draft, [{ studentId: 'a', id: 'x', version: 1, outcome: 'created' }]);

    expect(next.date).toBe(roster.date);
    expect(next.dayInfo).toBe(roster.dayInfo);
    expect(JSON.stringify(roster)).toBe(snapshot);
  });
});

describe('dateBounds', () => {
  it('stops at today and at the backdate window', () => {
    expect(dateBounds('2026-10-21', SETTINGS)).toEqual({ min: '2026-10-14', max: '2026-10-21' });
    expect(dateBounds('2026-10-21', { ...SETTINGS, backdateWindowDays: 0 })).toEqual({
      min: '2026-10-21',
      max: '2026-10-21',
    });
  });
});
