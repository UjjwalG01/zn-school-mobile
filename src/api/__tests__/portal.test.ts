import { configureClient } from '../client';
import { ApiError } from '../errors';
import { getTeacherExams, getTeacherMyClasses, getTeacherStudent } from '../portal';

const BASE = 'https://api.test';

function setup(response: Response) {
  const fetchImpl = jest.fn(async () => response);
  configureClient({
    baseUrl: BASE,
    auth: { getAccessToken: () => 'token-1', getTenantId: () => 'tenant-1', refresh: async () => true },
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

const call = (fetchImpl: jest.Mock) => {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string> };
};

describe('getTeacherMyClasses', () => {
  it('GETs my-classes with the date and tenantId, authenticated', async () => {
    const body = {
      restricted: true,
      classes: [{ classId: 'c1', className: 'Class 8', sectionId: 's1', sectionName: 'A' }],
      subjects: [],
    };
    const fetchImpl = setup(new Response(JSON.stringify(body), { status: 200 }));

    await expect(getTeacherMyClasses('2026-10-19')).resolves.toEqual(body);

    const { url, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/portal/teacher/my-classes?date=2026-10-19&tenantId=tenant-1`);
    expect(headers.Authorization).toBe('Bearer token-1');
  });

  it('maps a 400 for a bad date to ApiError', async () => {
    setup(new Response(JSON.stringify({ message: 'Invalid date' }), { status: 400 }));
    await expect(getTeacherMyClasses('2026-13-45')).rejects.toMatchObject({ status: 400 });
  });
});

describe('getTeacherExams', () => {
  it('GETs exams with the tenantId, authenticated', async () => {
    const fetchImpl = setup(new Response('[]', { status: 200 }));

    await expect(getTeacherExams()).resolves.toEqual([]);

    const { url, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/portal/teacher/exams?tenantId=tenant-1`);
    expect(headers.Authorization).toBe('Bearer token-1');
  });

  it('maps a 403 (no staff link, no save_any) to ApiError with status 403', async () => {
    setup(new Response(JSON.stringify({ statusCode: 403, message: 'Forbidden' }), { status: 403 }));

    const error = await getTeacherExams().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403 });
  });
});

// A response as the backend really returns it (captured on the test stack, 2026-10-22): the guardians'
// e-mail and the class and section ids are in it, and gender / blood group can be null.
const LIVE_STUDENT = {
  student: {
    id: 'st-1',
    admissionNumber: 'STU-2026-0006',
    fullName: 'Dipesh Gurung',
    dateOfBirth: '2010-01-01',
    gender: null,
    bloodGroup: null,
    status: 'active',
  },
  guardians: [
    {
      guardianId: 'g-1',
      fullName: 'Dipesh Gurung Guardian',
      phone: '9800000000',
      email: 'guardian@example.com',
      relationship: 'father',
      isPrimary: true,
    },
  ],
  enrollments: [
    {
      id: 'en-1',
      academicYearLabel: '2082/83',
      classId: 'c-1',
      className: 'Grade 1',
      sectionId: 's-1',
      sectionName: 'A',
      status: 'active',
      rollNumber: '1',
    },
  ],
};

describe('getTeacherStudent', () => {
  it('GETs the student with the id encoded and the tenantId, authenticated', async () => {
    const fetchImpl = setup(new Response(JSON.stringify(LIVE_STUDENT), { status: 200 }));

    await getTeacherStudent('st 1');

    const { url, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/portal/teacher/students/st%201?tenantId=tenant-1`);
    expect(headers.Authorization).toBe('Bearer token-1');
  });

  it('keeps only what the screen shows: no guardian e-mail, no class or section id', async () => {
    setup(new Response(JSON.stringify(LIVE_STUDENT), { status: 200 }));

    const result = await getTeacherStudent('st-1');

    expect(result).toEqual({
      student: {
        id: 'st-1',
        admissionNumber: 'STU-2026-0006',
        fullName: 'Dipesh Gurung',
        dateOfBirth: '2010-01-01',
        gender: null,
        bloodGroup: null,
        status: 'active',
      },
      guardians: [{ guardianId: 'g-1', fullName: 'Dipesh Gurung Guardian', phone: '9800000000', relationship: 'father', isPrimary: true }],
      enrollments: [
        { id: 'en-1', academicYearLabel: '2082/83', className: 'Grade 1', sectionName: 'A', status: 'active', rollNumber: '1' },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('guardian@example.com');
    expect(JSON.stringify(result)).not.toContain('c-1');
  });

  it('turns missing optional values into null', async () => {
    const sparse = {
      student: { id: 'st-2', admissionNumber: 'A2', fullName: 'No Details', status: 'active' },
      guardians: [{ guardianId: 'g-2', fullName: 'G', relationship: 'mother', isPrimary: false }],
      enrollments: [{ id: 'en-2', academicYearLabel: '2082/83', className: 'Class 6', status: 'active' }],
    };
    setup(new Response(JSON.stringify(sparse), { status: 200 }));

    const result = await getTeacherStudent('st-2');

    expect(result.student).toMatchObject({ dateOfBirth: null, gender: null, bloodGroup: null });
    expect(result.guardians[0]!.phone).toBeNull();
    expect(result.enrollments[0]).toMatchObject({ sectionName: null, rollNumber: null });
  });

  it('maps the same-for-everyone 403 and the mark_any 404 to ApiError', async () => {
    setup(new Response(JSON.stringify({ message: 'This student is not in a class or section you teach' }), { status: 403 }));
    expect(await getTeacherStudent('st-9').catch((e: unknown) => e)).toMatchObject({ status: 403 });

    setup(new Response(JSON.stringify({ message: 'Student not found' }), { status: 404 }));
    const error = await getTeacherStudent('st-9').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404 });
  });
});
