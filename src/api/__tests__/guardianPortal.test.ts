import { configureClient } from '../client';
import {
  getGuardianAttendance,
  getGuardianFees,
  getGuardianResults,
  getGuardianStudent,
} from '../portal';

const BASE = 'https://api.test';

function setup() {
  const fetchImpl = jest.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
  configureClient({
    baseUrl: BASE,
    auth: { getAccessToken: () => 'token-1', getTenantId: () => 'tenant-1', refresh: async () => true },
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

const requestedUrl = (fetchImpl: jest.Mock) => (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[0];

describe('guardian portal requests (live routes only)', () => {
  const studentId = '11111111-1111-4111-8111-111111111111';

  it('GETs the child profile under the tenant and the student', async () => {
    const fetchImpl = setup();
    await getGuardianStudent(studentId);
    const url = new URL(requestedUrl(fetchImpl));
    expect(url.pathname).toBe(`/portal/guardian/students/${studentId}`);
    expect(url.searchParams.get('tenantId')).toBe('tenant-1');
  });

  it('sends the attendance month as dateFrom and dateTo', async () => {
    const fetchImpl = setup();
    await getGuardianAttendance(studentId, '2026-10-01', '2026-10-31');
    const url = new URL(requestedUrl(fetchImpl));
    expect(url.pathname).toBe(`/portal/guardian/students/${studentId}/attendance`);
    expect(url.searchParams.get('dateFrom')).toBe('2026-10-01');
    expect(url.searchParams.get('dateTo')).toBe('2026-10-31');
  });

  it('GETs released results for the child', async () => {
    const fetchImpl = setup();
    await getGuardianResults(studentId);
    expect(new URL(requestedUrl(fetchImpl)).pathname).toBe(`/portal/guardian/students/${studentId}/results`);
  });

  it('asks the fee read for only the newest payment, never the invoice or payment history pages', async () => {
    const fetchImpl = setup();
    await getGuardianFees(studentId);
    const url = new URL(requestedUrl(fetchImpl));
    expect(url.pathname).toBe(`/portal/guardian/students/${studentId}/fees`);
    expect(url.searchParams.get('pageSize')).toBe('1');
  });

  it('never calls an invoice or receipt route, which guardians may not use', async () => {
    const fetchImpl = setup();
    await getGuardianFees(studentId);
    await getGuardianResults(studentId);
    const urls = fetchImpl.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(urls.every((u) => !/invoice|receipt/.test(u))).toBe(true);
  });
});
