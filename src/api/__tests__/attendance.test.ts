import { getAttendanceRoster, getAttendanceSettings, postBulkAttendance } from '../attendance';
import { configureClient } from '../client';
import { ApiError } from '../errors';
import type { BulkAttendanceRequest } from '../types/attendance';

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
  return { url, init, headers: init.headers as Record<string, string> };
};

describe('getAttendanceRoster', () => {
  it('GETs the roster with date, class, section and tenantId, authenticated', async () => {
    const body = { date: '2026-10-21', dayInfo: { schoolDay: true, reason: null, holidayName: null }, rows: [] };
    const fetchImpl = setup(new Response(JSON.stringify(body), { status: 200 }));

    await expect(
      getAttendanceRoster({ date: '2026-10-21', classId: 'c1', sectionId: 's1' }),
    ).resolves.toEqual(body);

    const { url, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/attendance/roster?date=2026-10-21&classId=c1&sectionId=s1&tenantId=tenant-1`);
    expect(headers.Authorization).toBe('Bearer token-1');
  });

  it('leaves sectionId out for a class with no sections', async () => {
    const fetchImpl = setup(new Response('{}', { status: 200 }));

    await getAttendanceRoster({ date: '2026-10-21', classId: 'c6', sectionId: null });

    expect(call(fetchImpl).url).toBe(`${BASE}/attendance/roster?date=2026-10-21&classId=c6&tenantId=tenant-1`);
  });

  it('maps a 403 (no attendance.read) to ApiError with status 403', async () => {
    setup(new Response(JSON.stringify({ statusCode: 403, message: 'Forbidden' }), { status: 403 }));

    const error = await getAttendanceRoster({ date: '2026-10-21', classId: 'c1', sectionId: null }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403 });
  });
});

describe('getAttendanceSettings', () => {
  it('GETs the settings with the tenantId', async () => {
    const fetchImpl = setup(new Response('{"backdateWindowDays":7,"statuses":[]}', { status: 200 }));

    await expect(getAttendanceSettings()).resolves.toEqual({ backdateWindowDays: 7, statuses: [] });

    expect(call(fetchImpl).url).toBe(`${BASE}/attendance/settings?tenantId=tenant-1`);
  });
});

describe('postBulkAttendance', () => {
  const request: BulkAttendanceRequest = {
    idempotencyKey: '7f9c0e5a-1d57-4b3e-9a5e-4d3f2a1b0c9d',
    attendanceDate: '2026-10-21',
    classId: 'c1',
    sectionId: 's1',
    records: [{ studentId: 'st1', status: 'present', version: 0 }],
  };

  it('POSTs the batch with tenantId in the query only, never in the body', async () => {
    const result = { ok: true, replayed: false, results: [{ studentId: 'st1', id: 'r1', version: 1, outcome: 'created' }] };
    const fetchImpl = setup(new Response(JSON.stringify(result), { status: 201 }));

    await expect(postBulkAttendance(request)).resolves.toEqual(result);

    const { url, init, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/attendance/records/bulk?tenantId=tenant-1`);
    expect(init.method).toBe('POST');
    expect(headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(JSON.parse(init.body as string)).not.toHaveProperty('tenantId');
  });

  it('resolves a refused batch (2xx ok:false) instead of throwing', async () => {
    const refused = {
      ok: false,
      failures: [{ identifier: { studentId: 'st1', row: 1 }, error: 'This record was changed by someone else — reload and try again' }],
    };
    setup(new Response(JSON.stringify(refused), { status: 201 }));

    await expect(postBulkAttendance(request)).resolves.toEqual(refused);
  });

  it('throws an ApiError for a request-level refusal (e.g. a holiday), with the backend message', async () => {
    setup(new Response(JSON.stringify({ statusCode: 400, message: 'Attendance cannot be marked on a holiday' }), { status: 400 }));

    const error = await postBulkAttendance(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Attendance cannot be marked on a holiday' });
  });
});
