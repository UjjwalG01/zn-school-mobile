import { configureClient } from '../client';
import { getMobileModules, getTenantSettings } from '../settings';

const BASE = 'https://api.test';

function setup(body: unknown) {
  const fetchImpl = jest.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
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

describe('settings requests', () => {
  it('GETs /settings/tenant with the tenantId, authenticated', async () => {
    const fetchImpl = setup({ timezone: 'Asia/Kathmandu', calendarPreference: 'nepali' });

    await expect(getTenantSettings()).resolves.toMatchObject({ calendarPreference: 'nepali' });

    const { url, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/settings/tenant?tenantId=tenant-1`);
    expect(headers.Authorization).toBe('Bearer token-1');
  });

  it('GETs /settings/tenant/mobile-modules with the tenantId, authenticated', async () => {
    const modules = [{ moduleKey: 'my_dashboard', visible: false }];
    const fetchImpl = setup(modules);

    await expect(getMobileModules()).resolves.toEqual(modules);

    const { url, headers } = call(fetchImpl);
    expect(url).toBe(`${BASE}/settings/tenant/mobile-modules?tenantId=tenant-1`);
    expect(headers.Authorization).toBe('Bearer token-1');
  });
});
