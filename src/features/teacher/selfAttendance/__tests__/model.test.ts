import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import type { StaffAttendanceRecord } from '../../../../api/types/attendance';
import { isNotLinked, markErrorKey, monthTotals, recordFor, statusSummary, upsertRecord } from '../model';

const record = (attendanceDate: string, status: StaffAttendanceRecord['status'] = 'present'): StaffAttendanceRecord => ({
  id: `r-${attendanceDate}`,
  attendanceDate,
  status,
  remarks: null,
  source: 'self',
  version: 1,
});

describe('recordFor', () => {
  it('finds the record of a date, or nothing', () => {
    const records = [record('2026-10-20'), record('2026-10-21')];
    expect(recordFor(records, '2026-10-21')?.id).toBe('r-2026-10-21');
    expect(recordFor(records, '2026-10-22')).toBeUndefined();
  });
});

describe('statusSummary', () => {
  it('counts each status once, in status order, with the labels it is given', () => {
    const records = [record('2026-10-19'), record('2026-10-20', 'absent'), record('2026-10-21')];
    expect(statusSummary(records, (status) => status.toUpperCase())).toBe('ABSENT 1 · PRESENT 2');
  });

  it('is empty for a month with no records', () => {
    expect(statusSummary([], (status) => status)).toBe('');
  });
});

describe('monthTotals', () => {
  it('counts each status the model knows and every record', () => {
    const records = [
      record('2026-10-19'),
      record('2026-10-20', 'absent'),
      record('2026-10-21'),
      record('2026-10-22', 'half_day'),
      record('2026-10-23', 'late'),
    ];
    expect(monthTotals(records)).toEqual({
      recorded: 5,
      counts: { present: 2, absent: 1, late: 1, half_day: 1, excused: 0 },
    });
  });

  it('is all zero for a month with no records', () => {
    expect(monthTotals([])).toEqual({
      recorded: 0,
      counts: { present: 0, absent: 0, late: 0, half_day: 0, excused: 0 },
    });
  });

  it('counts a status it does not know as recorded only, never as present', () => {
    const unknown = { ...record('2026-10-19'), status: 'on_duty' } as unknown as StaffAttendanceRecord;
    const totals = monthTotals([unknown, record('2026-10-20')]);
    expect(totals.recorded).toBe(2);
    expect(totals.counts.present).toBe(1);
  });
});

describe('upsertRecord', () => {
  it('adds a day in date order and replaces the same day without duplicating it', () => {
    const records = [record('2026-10-19'), record('2026-10-21')];
    expect(upsertRecord(records, record('2026-10-20')).map((r) => r.attendanceDate)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);
    const replaced = upsertRecord(records, record('2026-10-21', 'absent'));
    expect(replaced).toHaveLength(2);
    expect(replaced[1]?.status).toBe('absent');
  });

  it('does not change the list it was given', () => {
    const records = [record('2026-10-19')];
    upsertRecord(records, record('2026-10-20'));
    expect(records).toHaveLength(1);
  });
});

describe('markErrorKey / isNotLinked', () => {
  it('maps each refusal of "Mark present" to its message, by status and code', () => {
    expect(markErrorKey(new ApiError(404, 'x'))).toBe('selfAttendance.notLinked');
    expect(markErrorKey(new ApiError(409, 'x', 'ATTENDANCE_ALREADY_RECORDED'))).toBe('selfAttendance.alreadyRecorded');
    expect(markErrorKey(new ApiError(409, 'x'))).toBe('selfAttendance.inactive');
    expect(markErrorKey(new ApiError(400, 'x', 'ATTENDANCE_INVALID_DATE'))).toBe('selfAttendance.refused');
    expect(markErrorKey(new ApiError(0, 'x', NETWORK_ERROR_CODE))).toBe('selfAttendance.offline');
    expect(markErrorKey(new ApiError(500, 'x'))).toBe('selfAttendance.saveFailed');
    expect(markErrorKey(new Error('boom'))).toBe('selfAttendance.saveFailed');
  });

  it('only a 404 means the account is not linked to a staff member', () => {
    expect(isNotLinked(new ApiError(404, 'x'))).toBe(true);
    expect(isNotLinked(new ApiError(403, 'x'))).toBe(false);
    expect(isNotLinked(null)).toBe(false);
  });
});
