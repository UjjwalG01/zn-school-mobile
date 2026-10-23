import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { postBulkMarks, submitSubjectMarks } from '../../../../api/academic';
import { ApiError, NETWORK_ERROR_CODE } from '../../../../api/errors';
import type { BulkMarksItem, BulkMarksResult, ExamResult, MarksSubmissionRow } from '../../../../api/types/academic';
import type { TeacherExam } from '../../../../api/types/portal';
import { myPermissionsKey, mySchoolsKey } from '../../../../auth/queries';
import { resetSessionForTests, selectTenant } from '../../../../auth/session';
import { teacherExamsKey } from '../../queries';
import type { SlotRef } from '../marksModel';
import { examResultsKey } from '../queries';
import { type SaveOutcome, type SubmitOutcome, useSaveMarks, useSubmitSubject } from '../useSubmitMarks';

jest.mock('../../../../api/academic');
let keyCounter = 0;
jest.mock('../../../../lib/uuid', () => ({ newUuid: () => `key-${(keyCounter += 1)}` }));

const EXAM = 'x1';
const SLOT: SlotRef = { examId: EXAM, examSubjectId: 'es1', sectionId: 's8' };

const item = (id: string, theory = 70, version = 0): BulkMarksItem => ({
  enrollmentId: `e-${id}`,
  components: [
    { examComponentId: 'c-th', obtainedMarks: theory },
    { examComponentId: 'c-pr', obtainedMarks: 15 },
  ],
  version,
});
const ITEMS = [item('a'), item('b')];

const result = (id: string, version: number, theory = '70.00'): ExamResult => ({
  id: `r-${id}`,
  enrollmentId: `e-${id}`,
  version,
  components: [
    { examComponentId: 'c-th', obtainedMarks: theory },
    { examComponentId: 'c-pr', obtainedMarks: '15.00' },
  ],
});
const SAVED: BulkMarksResult = { ok: true, replayed: false, results: [result('a', 1), result('b', 1)] };
const offline = () => new ApiError(0, 'offline', NETWORK_ERROR_CODE);

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  keyCounter = 0;
  resetSessionForTests();
  selectTenant('t1');
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  jest.mocked(postBulkMarks).mockResolvedValue(SAVED);
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

describe('useSaveMarks', () => {
  async function setup() {
    const { result: hook } = await renderHook(() => useSaveMarks(EXAM), { wrapper });
    return hook;
  }
  type Hook = Awaited<ReturnType<typeof setup>>;

  /** Runs a save inside act and lets TanStack's 0 ms "state changed" notification land there too. */
  async function run(hook: Hook, items: readonly BulkMarksItem[] = ITEMS): Promise<SaveOutcome> {
    let outcome: SaveOutcome = { kind: 'ignored' };
    await act(async () => {
      outcome = await hook.current.save(items);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    return outcome;
  }
  const keysSent = () => jest.mocked(postBulkMarks).mock.calls.map(([body]) => body.idempotencyKey);

  it('sends the exam, the key and the items exactly as given (each with the version the teacher saw)', async () => {
    const hook = await setup();

    expect(await run(hook, [item('a', 70, 3), item('b')])).toEqual({
      kind: 'saved',
      replayed: false,
      savedIds: ['e-a', 'e-b'],
    });

    expect(postBulkMarks).toHaveBeenCalledTimes(1);
    expect(postBulkMarks).toHaveBeenCalledWith({
      examId: EXAM,
      idempotencyKey: 'key-1',
      items: [item('a', 70, 3), item('b')],
    });
  });

  it('patches the cached results from the response, keeps the other students, and refreshes only the exam list', async () => {
    client.setQueryData(examResultsKey('t1', EXAM), [result('a', 0), result('c', 4)]);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const hook = await setup();

    await run(hook);

    const cached = client.getQueryData<ExamResult[]>(examResultsKey('t1', EXAM))!;
    expect(cached.map((r) => [r.enrollmentId, r.version])).toEqual([
      ['e-a', 1],
      ['e-c', 4],
      ['e-b', 1],
    ]);
    // The first scoped save opens the backend's draft submission row: only the exam list is stale.
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: teacherExamsKey('t1') });
  });

  it('reports a replay (the server already had this exact save)', async () => {
    jest.mocked(postBulkMarks).mockResolvedValue({ ...SAVED, replayed: true } as BulkMarksResult);
    const hook = await setup();

    expect(await run(hook)).toMatchObject({ kind: 'saved', replayed: true });
  });

  it('sends nothing for a second tap while the first save is in flight', async () => {
    let finish!: (value: BulkMarksResult) => void;
    jest.mocked(postBulkMarks).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const hook = await setup();

    const outcomes: unknown[] = [];
    await act(async () => {
      const first = hook.current.save(ITEMS);
      outcomes.push(await hook.current.save(ITEMS)); // the second tap
      finish(SAVED);
      outcomes.push(await first);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(outcomes).toEqual([{ kind: 'ignored' }, expect.objectContaining({ kind: 'saved' })]);
    expect(postBulkMarks).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when there is nothing to save, or more students than one request may carry', async () => {
    const hook = await setup();
    const many = Array.from({ length: 201 }, (_, i) => item(`s${i}`));

    expect(await run(hook, [])).toEqual({ kind: 'ignored' });
    expect(await run(hook, many)).toEqual({ kind: 'ignored' });

    expect(postBulkMarks).not.toHaveBeenCalled();
  });

  describe('idempotency key', () => {
    it('is reused to retry an identical payload after the connection failed (so the server replays, not duplicates)', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(offline());
      const hook = await setup();

      expect(await run(hook)).toMatchObject({ kind: 'error', action: 'offline' });
      expect(await run(hook)).toMatchObject({ kind: 'saved' });

      expect(keysSent()).toEqual(['key-1', 'key-1']);
    });

    it('is reused after a server error too (the request may have been committed)', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(503, 'unavailable'));
      const hook = await setup();

      expect(await run(hook)).toMatchObject({ kind: 'error', action: 'server' });
      await run(hook);

      expect(keysSent()).toEqual(['key-1', 'key-1']);
    });

    it('changes after any edit, including only the version', async () => {
      jest.mocked(postBulkMarks).mockRejectedValue(offline());
      const hook = await setup();

      await run(hook, [item('a', 70, 0)]);
      await run(hook, [item('a', 71, 0)]); // another mark
      await run(hook, [item('a', 71, 5)]); // same marks, rebased onto a newer version

      expect(keysSent()).toEqual(['key-1', 'key-2', 'key-3']);
    });

    it('is spent once the server answered, so the next save gets a new one', async () => {
      const hook = await setup();

      await run(hook);
      await run(hook);

      expect(keysSent()).toEqual(['key-1', 'key-2']);
    });

    it.each([
      ['a 400', new ApiError(400, 'The exam is not open for marks')],
      ['a 403', new ApiError(403, 'Not the subject teacher')],
      ['a 409', new ApiError(409, 'stale', 'CONCURRENCY_VERSION_CONFLICT')],
    ])('is dropped after %s, because nothing was written', async (_name, error) => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(error);
      const hook = await setup();

      await run(hook);
      await run(hook);

      expect(keysSent()).toEqual(['key-1', 'key-2']);
    });

    it('is spent by a refused batch too (2xx ok:false wrote nothing and was answered)', async () => {
      jest
        .mocked(postBulkMarks)
        .mockResolvedValueOnce({ ok: false, failures: [{ identifier: { enrollmentId: 'e-a' }, error: 'Not eligible' }] });
      const hook = await setup();

      await run(hook);
      await run(hook);

      expect(keysSent()).toEqual(['key-1', 'key-2']);
    });
  });

  describe('a refused batch (2xx ok:false)', () => {
    const refused: BulkMarksResult = {
      ok: false,
      failures: [
        { identifier: { enrollmentId: 'e-a' }, error: 'obtainedMarks for "Mathematics - Theory" must be between 0 and 80' },
        { identifier: { enrollmentId: 'e-a' }, error: 'a second reason for the same student' },
        { identifier: { enrollmentId: 'e-b' }, error: 'Student is not eligible for this exam' },
      ],
    };

    it('returns the first reason per student and refreshes the saved results', async () => {
      jest.mocked(postBulkMarks).mockResolvedValue(refused);
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const hook = await setup();

      expect(await run(hook)).toEqual({
        kind: 'refused',
        failures: {
          'e-a': 'obtainedMarks for "Mathematics - Theory" must be between 0 and 80',
          'e-b': 'Student is not eligible for this exam',
        },
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: examResultsKey('t1', EXAM) });
    });

    it('does not touch the cached results (nothing was written)', async () => {
      jest.mocked(postBulkMarks).mockResolvedValue(refused);
      const cached = [result('a', 2)];
      client.setQueryData(examResultsKey('t1', EXAM), cached);
      const hook = await setup();

      await run(hook);

      expect(client.getQueryData(examResultsKey('t1', EXAM))).toBe(cached);
    });
  });

  describe('request-level errors', () => {
    it('hands the screen the action, the backend code and the message (display only)', async () => {
      jest
        .mocked(postBulkMarks)
        .mockRejectedValueOnce(new ApiError(409, 'These marks were submitted. Ask staff to return them before editing', 'EXAM_MARKS_SUBMITTED'));
      const hook = await setup();

      expect(await run(hook)).toEqual({
        kind: 'error',
        action: 'conflict',
        code: 'EXAM_MARKS_SUBMITTED',
        message: 'These marks were submitted. Ask staff to return them before editing',
      });
    });

    it('refetches the results and the exam list after a version conflict, so the teacher sees what changed', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(409, 'stale', 'CONCURRENCY_VERSION_CONFLICT'));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const hook = await setup();

      expect(await run(hook)).toMatchObject({ kind: 'error', action: 'conflict' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: examResultsKey('t1', EXAM) });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: teacherExamsKey('t1') });
    });

    it('refreshes permissions, the exam list and assignments after a plain 403 (they may be out of date)', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(403, 'You are not assigned as the subject teacher'));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const hook = await setup();

      expect(await run(hook)).toMatchObject({ kind: 'error', action: 'forbidden' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: myPermissionsKey('t1') });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: teacherExamsKey('t1') });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['t1', 'teacher', 'my-classes'] });
    });

    it('refreshes the school list when the licence or module turned the feature off', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(403, 'module off', 'ENTITLEMENT_DENIED'));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const hook = await setup();

      expect(await run(hook)).toMatchObject({ kind: 'error', action: 'feature-denied' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: mySchoolsKey() });
    });

    it('passes a plain 400 sentence through and refreshes nothing', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(new ApiError(400, 'Marks cannot be entered until the exam is published'));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const hook = await setup();

      expect(await run(hook)).toMatchObject({
        kind: 'error',
        action: 'validation',
        message: 'Marks cannot be entered until the exam is published',
      });
      expect(invalidate).not.toHaveBeenCalled();
    });

    it('does not refresh anything for an offline failure', async () => {
      jest.mocked(postBulkMarks).mockRejectedValueOnce(offline());
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const hook = await setup();

      await run(hook);

      expect(invalidate).not.toHaveBeenCalled();
    });
  });
});

describe('useSubmitSubject', () => {
  const ROW: MarksSubmissionRow = {
    id: 'sub1',
    examSubjectId: 'es1',
    sectionId: 's8',
    status: 'submitted',
    returnedReason: null,
    submittedAt: '2026-10-22T10:00:00Z',
    version: 3,
  };
  const exams = (): TeacherExam[] => [
    {
      examId: EXAM,
      name: 'Second Terminal',
      sessionName: '2083',
      classId: 'c-class-8',
      className: 'Class 8',
      sectionId: 's8',
      sectionName: 'A',
      subjects: [
        {
          examSubjectId: 'es1',
          subjectName: 'Mathematics',
          sectionId: 's8',
          sectionName: 'A',
          components: [],
          submission: { status: 'draft', version: 2, returnedReason: null, submittedAt: null },
        },
        {
          examSubjectId: 'es2',
          subjectName: 'Science',
          sectionId: 's8',
          sectionName: 'A',
          components: [],
          submission: null,
        },
      ],
    },
  ];

  async function setup(slot: SlotRef = SLOT) {
    const { result: hook } = await renderHook(() => useSubmitSubject(slot), { wrapper });
    return hook;
  }
  type Hook = Awaited<ReturnType<typeof setup>>;
  async function run(hook: Hook, version: number): Promise<SubmitOutcome> {
    let outcome: SubmitOutcome = { kind: 'ignored' };
    await act(async () => {
      outcome = await hook.current.submit(version);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    return outcome;
  }

  beforeEach(() => {
    jest.mocked(submitSubjectMarks).mockResolvedValue(ROW);
  });

  it('sends the section and the submission version the teacher last read', async () => {
    const hook = await setup();

    expect(await run(hook, 2)).toEqual({ kind: 'submitted' });

    expect(submitSubjectMarks).toHaveBeenCalledWith(EXAM, 'es1', { sectionId: 's8', version: 2 });
  });

  it('leaves the section out for an exam with none', async () => {
    const hook = await setup({ ...SLOT, sectionId: null });

    await run(hook, 0);

    expect(submitSubjectMarks).toHaveBeenCalledWith(EXAM, 'es1', { version: 0 });
  });

  it('puts the response into the cached exam list for that subject only, with no refetch', async () => {
    client.setQueryData(teacherExamsKey('t1'), exams());
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const hook = await setup();

    await run(hook, 2);

    const cached = client.getQueryData<TeacherExam[]>(teacherExamsKey('t1'))!;
    expect(cached[0]!.subjects[0]!.submission).toEqual({
      status: 'submitted',
      version: 3,
      returnedReason: null,
      submittedAt: '2026-10-22T10:00:00Z',
    });
    expect(cached[0]!.subjects[1]!.submission).toBeNull();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('sends nothing for a second tap while the first submit is in flight', async () => {
    let finish!: (value: MarksSubmissionRow) => void;
    jest.mocked(submitSubjectMarks).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const hook = await setup();

    const outcomes: unknown[] = [];
    await act(async () => {
      const first = hook.current.submit(2);
      outcomes.push(await hook.current.submit(2));
      finish(ROW);
      outcomes.push(await first);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(outcomes).toEqual([{ kind: 'ignored' }, { kind: 'submitted' }]);
    expect(submitSubjectMarks).toHaveBeenCalledTimes(1);
  });

  it('hands the screen the backend code when students are missing marks', async () => {
    jest.mocked(submitSubjectMarks).mockRejectedValueOnce(new ApiError(400, '3 of 5 students have no marks', 'EXAM_MARKS_INCOMPLETE'));
    const hook = await setup();

    expect(await run(hook, 2)).toEqual({
      kind: 'error',
      action: 'validation',
      code: 'EXAM_MARKS_INCOMPLETE',
      message: '3 of 5 students have no marks',
    });
  });

  it('refetches the results and the exam list when the submission moved on (409 stale version)', async () => {
    jest.mocked(submitSubjectMarks).mockRejectedValueOnce(new ApiError(409, 'This submission changed', 'CONCURRENCY_VERSION_CONFLICT'));
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const hook = await setup();

    expect(await run(hook, 0)).toMatchObject({ kind: 'error', action: 'conflict' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: examResultsKey('t1', EXAM) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: teacherExamsKey('t1') });
  });

  it('refreshes permissions after a plain 403, and leaves the cached exam list alone when offline', async () => {
    jest.mocked(submitSubjectMarks).mockRejectedValueOnce(new ApiError(403, 'Not your subject'));
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const hook = await setup();

    expect(await run(hook, 2)).toMatchObject({ kind: 'error', action: 'forbidden' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: myPermissionsKey('t1') });

    invalidate.mockClear();
    jest.mocked(submitSubjectMarks).mockRejectedValueOnce(offline());
    expect(await run(hook, 2)).toMatchObject({ kind: 'error', action: 'offline' });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
