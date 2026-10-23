import { getExamResults, getExamRoster, postBulkMarks, submitSubjectMarks } from '../academic';
import { configureClient } from '../client';
import { ApiError } from '../errors';

const BASE = 'https://api.test';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** One fetch mock; each call answers the next response (a Response body can be read once). */
function setup(...responses: Response[]) {
  const fetchImpl = jest.fn();
  responses.forEach((response) => fetchImpl.mockResolvedValueOnce(response));
  configureClient({
    baseUrl: BASE,
    auth: { getAccessToken: () => 'token-1', getTenantId: () => 'tenant-1', refresh: async () => true },
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

const urls = (fetchImpl: jest.Mock) => fetchImpl.mock.calls.map(([url]) => url as string);
const init = (fetchImpl: jest.Mock, call = 0) => fetchImpl.mock.calls[call]![1] as RequestInit;

const row = (id: string) => ({ enrollmentId: id, fullName: `Student ${id}`, admissionNumber: id, rollNumber: null });

describe('getExamRoster', () => {
  it('asks for the exam population with the section, a full page and the tenantId', async () => {
    const fetchImpl = setup(json({ rows: [row('a')], total: 1, page: 1, pageSize: 200 }));

    await expect(getExamRoster({ examId: 'x1', sectionId: 's1' })).resolves.toEqual([row('a')]);

    expect(urls(fetchImpl)).toEqual([
      `${BASE}/academic/students?examId=x1&sectionId=s1&page=1&pageSize=200&tenantId=tenant-1`,
    ]);
  });

  it('leaves sectionId out for an exam with no section', async () => {
    const fetchImpl = setup(json({ rows: [], total: 0 }));

    await getExamRoster({ examId: 'x1', sectionId: null });

    expect(urls(fetchImpl)[0]).not.toContain('sectionId');
  });

  it('reads every page until total is reached', async () => {
    const fetchImpl = setup(
      json({ rows: [row('a'), row('b')], total: 3 }),
      json({ rows: [row('c')], total: 3 }),
    );

    const rows = await getExamRoster({ examId: 'x1', sectionId: null });

    expect(rows.map((r) => r.enrollmentId)).toEqual(['a', 'b', 'c']);
    expect(urls(fetchImpl).map((url) => new URL(url).searchParams.get('page'))).toEqual(['1', '2']);
  });

  it('stops on an empty page even when total promises more', async () => {
    const fetchImpl = setup(json({ rows: [row('a')], total: 5 }), json({ rows: [], total: 5 }));

    await expect(getExamRoster({ examId: 'x1', sectionId: null })).resolves.toHaveLength(1);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('getExamResults', () => {
  it('GETs the exam results with the tenantId, authenticated', async () => {
    const fetchImpl = setup(json([]));

    await expect(getExamResults('x1')).resolves.toEqual([]);

    expect(urls(fetchImpl)).toEqual([`${BASE}/academic/exam-results?examId=x1&tenantId=tenant-1`]);
    expect((init(fetchImpl).headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('maps a 403 to ApiError', async () => {
    setup(json({ message: 'Forbidden' }, 403));
    expect(await getExamResults('x1').catch((e: unknown) => e)).toMatchObject({ status: 403 });
  });
});

describe('postBulkMarks', () => {
  const body = {
    examId: 'x1',
    idempotencyKey: 'k1',
    items: [{ enrollmentId: 'a', components: [{ examComponentId: 'c1', obtainedMarks: 75.5 }], version: 0 }],
  };

  it('POSTs the batch as JSON with the tenantId in the query, not the body', async () => {
    const fetchImpl = setup(json({ ok: true, replayed: false, results: [] }, 201));

    await expect(postBulkMarks(body)).resolves.toEqual({ ok: true, replayed: false, results: [] });

    expect(urls(fetchImpl)).toEqual([`${BASE}/academic/exam-results/bulk-entry?tenantId=tenant-1`]);
    expect(init(fetchImpl).method).toBe('POST');
    expect(JSON.parse(init(fetchImpl).body as string)).toEqual(body);
  });

  it('resolves a refused batch (2xx ok:false) instead of throwing', async () => {
    const refused = { ok: false, failures: [{ identifier: { enrollmentId: 'a' }, error: 'Mark out of range' }] };
    setup(json(refused, 201));

    await expect(postBulkMarks(body)).resolves.toEqual(refused);
  });

  it('throws ApiError with the code for a version conflict', async () => {
    setup(json({ statusCode: 409, errorCode: 'CONCURRENCY_VERSION_CONFLICT', message: 'stale' }, 409));

    const error = await postBulkMarks(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, errorCode: 'CONCURRENCY_VERSION_CONFLICT' });
  });
});

// Rows as the backend really returns them (captured on the test stack, 2026-10-22; MARKS_PLAN E-M2).
// The persisted query cache keeps whatever the request functions return, so only what the screens
// read may come out.
const liveRosterRow = {
  ...row('a'),
  rollNumber: '2',
  studentId: 'stu-1',
  studentStatus: 'active',
  guardianName: 'Anil Rai Guardian',
  guardianId: 'g-1',
  classId: 'c1',
  className: 'Grade 1',
  sectionId: 's1',
  sectionName: 'A',
  enrollmentStatus: 'active',
  customFields: { bloodGroup: 'O+' },
};
const liveResult = {
  id: 'r1',
  tenantId: 'tenant-1',
  academicYearId: 'y1',
  examId: 'x1',
  enrollmentId: 'a',
  totalObtained: '85.50',
  totalMax: '100.00',
  percentage: '85.50',
  grade: 'A',
  gradePoint: '4.00',
  passStatus: 'pass',
  status: 'pending',
  remarks: null,
  version: 2,
  publishedAt: null,
  lockedAt: null,
  components: [
    {
      id: 'rc1',
      tenantId: 'tenant-1',
      examResultId: 'r1',
      examComponentId: 'c-th',
      obtainedMarks: '70.00',
      maxMarks: '80.00',
      passMarks: '32.00',
      createdAt: 't',
      updatedAt: 't',
    },
  ],
};
const KEPT_RESULT = { id: 'r1', enrollmentId: 'a', version: 2, components: [{ examComponentId: 'c-th', obtainedMarks: '70.00' }] };

describe('what is kept from a live response', () => {
  it('keeps four fields of a roster row: no guardian, student id, status or custom fields', async () => {
    setup(json({ rows: [liveRosterRow], total: 1, page: 1, pageSize: 200, academicYearId: 'y1' }));

    await expect(getExamRoster({ examId: 'x1', sectionId: 's1' })).resolves.toEqual([
      { enrollmentId: 'a', fullName: 'Student a', admissionNumber: 'a', rollNumber: '2' },
    ]);
  });

  it('reads a missing roll number as null', async () => {
    setup(json({ rows: [{ ...liveRosterRow, rollNumber: undefined }], total: 1 }));

    const [only] = await getExamRoster({ examId: 'x1', sectionId: null });

    expect(only!.rollNumber).toBeNull();
  });

  it('keeps the id, student, version and the two fields of each mark of a stored result: no grade, total or tenant', async () => {
    setup(json([liveResult]));

    await expect(getExamResults('x1')).resolves.toEqual([KEPT_RESULT]);
  });

  it('applies the same to the results a save returns, and leaves a refused batch exactly as it came', async () => {
    setup(json({ ok: true, replayed: true, results: [liveResult] }, 201));
    await expect(
      postBulkMarks({ examId: 'x1', idempotencyKey: 'k1', items: [{ enrollmentId: 'a', components: [], version: 0 }] }),
    ).resolves.toEqual({ ok: true, replayed: true, results: [KEPT_RESULT] });

    const refused = { ok: false, failures: [{ identifier: { enrollmentId: 'a' }, error: 'Not eligible' }] };
    setup(json(refused, 201));
    await expect(
      postBulkMarks({ examId: 'x1', idempotencyKey: 'k2', items: [{ enrollmentId: 'a', components: [], version: 0 }] }),
    ).resolves.toEqual(refused);
  });
});

describe('submitSubjectMarks', () => {
  it('POSTs to the subject slot with the section and the submission version', async () => {
    const row = { id: 'sub1', examSubjectId: 'es1', sectionId: 's1', status: 'submitted', returnedReason: null, submittedAt: 't', version: 2 };
    const fetchImpl = setup(json(row, 200));

    await expect(submitSubjectMarks('x1', 'es1', { sectionId: 's1', version: 1 })).resolves.toEqual(row);

    expect(urls(fetchImpl)).toEqual([`${BASE}/academic/exams/x1/submissions/es1/submit?tenantId=tenant-1`]);
    expect(JSON.parse(init(fetchImpl).body as string)).toEqual({ sectionId: 's1', version: 1 });
  });

  it('maps an incomplete subject (400 EXAM_MARKS_INCOMPLETE) to ApiError', async () => {
    setup(json({ statusCode: 400, errorCode: 'EXAM_MARKS_INCOMPLETE', message: 'missing' }, 400));

    expect(await submitSubjectMarks('x1', 'es1', { version: 0 }).catch((e: unknown) => e)).toMatchObject({
      status: 400,
      errorCode: 'EXAM_MARKS_INCOMPLETE',
    });
  });
});
