import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { postBulkAttendance, type RosterQuery } from '../../../../api/attendance';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import type { AttendanceRoster, BulkAttendanceResult, RosterRow } from '../../../../api/types/attendance';
import { myPermissionsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { type Draft, EMPTY_DRAFT, setStatus } from '../attendanceModel';
import { attendanceRosterKey, attendanceSettingsKey } from '../queries';
import { type SubmitOutcome, useSubmitAttendance } from '../useSubmitAttendance';

jest.mock('../../../../api/attendance');
let keyCounter = 0;
jest.mock('../../../../lib/uuid', () => ({ newUuid: () => `key-${(keyCounter += 1)}` }));

const TARGET = { date: '2026-10-21', classId: 'c1', sectionId: 's1' };

const row = (studentId: string): RosterRow => ({
  enrollmentId: `e-${studentId}`,
  studentId,
  fullName: `Student ${studentId}`,
  admissionNumber: studentId,
  rollNumber: null,
  sectionId: 's1',
  record: null,
});
const ROWS = [row('a'), row('b')];
const DRAFT = setStatus(setStatus(EMPTY_DRAFT, ROWS[0]!, 'present'), ROWS[1]!, 'absent');

const SAVED: BulkAttendanceResult = {
  ok: true,
  replayed: false,
  results: [
    { studentId: 'a', id: 'ra', version: 1, outcome: 'created' },
    { studentId: 'b', id: 'rb', version: 1, outcome: 'created' },
  ],
};
const offline = () => new ApiError(0, 'offline', NETWORK_ERROR_CODE);

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

async function setup(target: RosterQuery = TARGET) {
  const { result } = await renderHook(() => useSubmitAttendance(target), { wrapper });
  return result;
}
type Hook = Awaited<ReturnType<typeof setup>>;

/** Runs a save inside act and lets TanStack's 0 ms "state changed" notification land there too. */
async function run(result: Hook, rows: readonly RosterRow[], draft: Draft): Promise<SubmitOutcome> {
  let outcome: SubmitOutcome = { kind: 'ignored' };
  await act(async () => {
    outcome = await result.current.submit(rows, draft);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return outcome;
}

const keysSent = () => jest.mocked(postBulkAttendance).mock.calls.map(([body]) => body.idempotencyKey);

beforeEach(() => {
  keyCounter = 0;
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  jest.mocked(postBulkAttendance).mockResolvedValue(SAVED);
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('useSubmitAttendance', () => {
  it('sends one request with only the changed rows, their versions and the section', async () => {
    const result = await setup();

    expect(await run(result, ROWS, DRAFT)).toEqual({ kind: 'saved', replayed: false });

    expect(postBulkAttendance).toHaveBeenCalledTimes(1);
    expect(postBulkAttendance).toHaveBeenCalledWith({
      idempotencyKey: 'key-1',
      attendanceDate: '2026-10-21',
      classId: 'c1',
      sectionId: 's1',
      records: [
        { studentId: 'a', status: 'present', version: 0 },
        { studentId: 'b', status: 'absent', version: 0 },
      ],
    });
  });

  it('leaves sectionId out for a class with no sections', async () => {
    const result = await setup({ date: '2026-10-21', classId: 'c6', sectionId: null });

    await run(result, ROWS, DRAFT);

    expect(jest.mocked(postBulkAttendance).mock.calls[0]![0]).not.toHaveProperty('sectionId');
  });

  it('patches the cached roster from the response, with no refetch', async () => {
    const roster: AttendanceRoster = {
      date: '2026-10-21',
      dayInfo: { schoolDay: true, reason: null, holidayName: null },
      rows: ROWS,
    };
    client.setQueryData(attendanceRosterKey('t1', TARGET), roster);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const result = await setup();

    await run(result, ROWS, DRAFT);

    const cached = client.getQueryData<AttendanceRoster>(attendanceRosterKey('t1', TARGET))!;
    expect(cached.rows[0]!.record).toMatchObject({ id: 'ra', status: 'present', version: 1 });
    expect(cached.rows[1]!.record).toMatchObject({ id: 'rb', status: 'absent', version: 1 });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('reports a replay (the server already had this exact save)', async () => {
    jest.mocked(postBulkAttendance).mockResolvedValue({ ...SAVED, replayed: true } as BulkAttendanceResult);
    const result = await setup();

    expect(await run(result, ROWS, DRAFT)).toEqual({ kind: 'saved', replayed: true });
  });

  it('sends nothing for a second tap while the first save is in flight', async () => {
    let finish!: (value: BulkAttendanceResult) => void;
    jest.mocked(postBulkAttendance).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const result = await setup();

    const outcomes: unknown[] = [];
    await act(async () => {
      const first = result.current.submit(ROWS, DRAFT);
      outcomes.push(await result.current.submit(ROWS, DRAFT)); // the second tap
      finish(SAVED);
      outcomes.push(await first);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(outcomes).toEqual([{ kind: 'ignored' }, { kind: 'saved', replayed: false }]);
    expect(postBulkAttendance).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when there is nothing to save, or more rows than one request may carry', async () => {
    const result = await setup();
    const many = Array.from({ length: 201 }, (_, i) => row(`s${i}`));
    const everyone = many.reduce((draft, r) => setStatus(draft, r, 'present'), EMPTY_DRAFT);

    expect(await run(result, ROWS, EMPTY_DRAFT)).toEqual({ kind: 'ignored' });
    expect(await run(result, many, everyone)).toEqual({ kind: 'ignored' });

    expect(postBulkAttendance).not.toHaveBeenCalled();
  });

  describe('idempotency key', () => {
    it('is reused to retry an identical payload after the connection failed', async () => {
      jest.mocked(postBulkAttendance).mockRejectedValueOnce(offline());
      const result = await setup();

      expect(await run(result, ROWS, DRAFT)).toMatchObject({ kind: 'error', action: 'offline' });
      expect(await run(result, ROWS, DRAFT)).toMatchObject({ kind: 'saved' });

      expect(keysSent()).toEqual(['key-1', 'key-1']);
    });

    it('is reused after a server error too (the request may have been committed)', async () => {
      jest.mocked(postBulkAttendance).mockRejectedValueOnce(new ApiError(503, 'unavailable'));
      const result = await setup();

      expect(await run(result, ROWS, DRAFT)).toMatchObject({ kind: 'error', action: 'server' });
      await run(result, ROWS, DRAFT);

      expect(keysSent()).toEqual(['key-1', 'key-1']);
    });

    it('changes after any edit', async () => {
      jest.mocked(postBulkAttendance).mockRejectedValueOnce(offline());
      const result = await setup();

      await run(result, ROWS, DRAFT);
      await run(result, ROWS, setStatus(DRAFT, ROWS[0]!, 'late'));

      expect(keysSent()).toEqual(['key-1', 'key-2']);
    });

    it('is spent once the server answered, so the next save gets a new one', async () => {
      const result = await setup();

      await run(result, ROWS, DRAFT);
      await run(result, ROWS, DRAFT);

      expect(keysSent()).toEqual(['key-1', 'key-2']);
    });

    it.each([
      ['a 400', new ApiError(400, 'Attendance cannot be marked on a holiday')],
      ['a 403', new ApiError(403, 'Not the class teacher')],
      ['a 409', new ApiError(409, 'Key reused')],
    ])('is dropped after %s, because nothing was written', async (_name, error) => {
      jest.mocked(postBulkAttendance).mockRejectedValueOnce(error);
      const result = await setup();

      await run(result, ROWS, DRAFT);
      await run(result, ROWS, DRAFT);

      expect(keysSent()).toEqual(['key-1', 'key-2']);
    });
  });

  describe('a refused batch (2xx ok:false)', () => {
    const refused: BulkAttendanceResult = {
      ok: false,
      failures: [
        { identifier: { studentId: 'a', row: 1 }, error: 'This record was changed by someone else — reload and try again' },
        { identifier: { studentId: 'b', row: 2 }, error: 'Half day is not in use at this school' },
      ],
    };

    it('returns each reason per student and refreshes the roster and the settings', async () => {
      jest.mocked(postBulkAttendance).mockResolvedValue(refused);
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const result = await setup();

      expect(await run(result, ROWS, DRAFT)).toEqual({
        kind: 'refused',
        failures: {
          a: 'This record was changed by someone else — reload and try again',
          b: 'Half day is not in use at this school',
        },
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: attendanceRosterKey('t1', TARGET) });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: attendanceSettingsKey('t1') });
    });

    it('does not touch the cached roster', async () => {
      jest.mocked(postBulkAttendance).mockResolvedValue(refused);
      const roster: AttendanceRoster = {
        date: '2026-10-21',
        dayInfo: { schoolDay: true, reason: null, holidayName: null },
        rows: ROWS,
      };
      client.setQueryData(attendanceRosterKey('t1', TARGET), roster);
      const result = await setup();

      await run(result, ROWS, DRAFT);

      expect(client.getQueryData(attendanceRosterKey('t1', TARGET))).toBe(roster);
    });
  });

  describe('request-level errors', () => {
    it('classifies the error and passes the backend message through (display only)', async () => {
      jest
        .mocked(postBulkAttendance)
        .mockRejectedValueOnce(new ApiError(400, 'Attendance cannot be marked on a holiday', 'ATTENDANCE_INVALID_DATE'));
      const result = await setup();

      expect(await run(result, ROWS, DRAFT)).toEqual({
        kind: 'error',
        action: 'validation',
        message: 'Attendance cannot be marked on a holiday',
      });
    });

    it('refetches the roster after a 409 so version mismatches show up as conflicts', async () => {
      jest
        .mocked(postBulkAttendance)
        .mockRejectedValueOnce(new ApiError(409, 'recorded by someone else', 'ATTENDANCE_ALREADY_RECORDED'));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const result = await setup();

      expect(await run(result, ROWS, DRAFT)).toMatchObject({ kind: 'error', action: 'conflict' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: attendanceRosterKey('t1', TARGET) });
    });

    it('refreshes permissions and assignments after a 403 (they may be out of date)', async () => {
      jest.mocked(postBulkAttendance).mockRejectedValueOnce(new ApiError(403, 'Not the class teacher'));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const result = await setup();

      expect(await run(result, ROWS, DRAFT)).toMatchObject({ kind: 'error', action: 'forbidden' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: myPermissionsKey('t1') });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['t1', 'teacher', 'my-classes'] });
    });

    it('does not refresh anything for an offline failure', async () => {
      jest.mocked(postBulkAttendance).mockRejectedValueOnce(offline());
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const result = await setup();

      await run(result, ROWS, DRAFT);

      expect(invalidate).not.toHaveBeenCalled();
    });
  });
});
