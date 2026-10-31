import { apiGet, apiPost, type AuthAdapter, configureClient } from '../client';
import { ApiError } from '../errors';
import { onApiEvent } from '../events';

const BASE = 'https://api.test';

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

function setup(responses: (Response | Error)[], auth?: Partial<AuthAdapter>) {
  const queue = [...responses];
  const fetchImpl = jest.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra fetch');
    if (next instanceof Error) throw next;
    return next;
  });
  const adapter: AuthAdapter = {
    getAccessToken: () => 'token-1',
    getTenantId: () => 'tenant-1',
    refresh: jest.fn(async () => true),
    ...auth,
  };
  configureClient({
    baseUrl: BASE,
    auth: adapter,
    retryDelaysMs: [0, 0],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { fetchImpl, adapter };
}

const calledUrl = (fetchImpl: jest.Mock, call = 0) => String((fetchImpl.mock.calls[call] as unknown[])[0]);
const calledInit = (fetchImpl: jest.Mock, call = 0) =>
  (fetchImpl.mock.calls[call] as unknown[])[1] as RequestInit;

describe('api client', () => {
  it('attaches the Bearer token and the tenantId query param', async () => {
    const { fetchImpl } = setup([json(200, { ok: true })]);
    await expect(apiGet('/students?page=1')).resolves.toEqual({ ok: true });
    const url = new URL(calledUrl(fetchImpl));
    expect(url.origin + url.pathname).toBe(`${BASE}/students`);
    expect(url.searchParams.get('tenantId')).toBe('tenant-1');
    expect(url.searchParams.get('page')).toBe('1');
    expect((calledInit(fetchImpl).headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('skips tenant and Bearer for public routes', async () => {
    const { fetchImpl } = setup([json(200, { accessToken: 'a' })]);
    await apiPost('/identity/login', { email: 'a', password: 'b' }, { skipTenant: true, public: true });
    expect(calledUrl(fetchImpl)).toBe(`${BASE}/identity/login`);
    expect((calledInit(fetchImpl).headers as Record<string, string>).Authorization).toBeUndefined();
    expect(calledInit(fetchImpl).body).toBe(JSON.stringify({ email: 'a', password: 'b' }));
  });

  it('refuses a tenant route without a selected tenant', async () => {
    const { fetchImpl } = setup([], { getTenantId: () => null });
    await expect(apiGet('/students')).rejects.toMatchObject({ status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns undefined for an empty body', async () => {
    setup([json(204)]);
    await expect(apiPost('/identity/logout', {}, { skipTenant: true })).resolves.toBeUndefined();
  });

  it('throws ApiError with errorCode from the envelope', async () => {
    setup([json(409, { errorCode: 'CONCURRENCY_VERSION_CONFLICT', message: 'stale' })]);
    await expect(apiGet('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      errorCode: 'CONCURRENCY_VERSION_CONFLICT',
      message: 'stale',
    });
  });

  it('replaces an HTML proxy page with a default message', async () => {
    setup([new Response('<html>Bad gateway</html>', { status: 502 })]);
    const error = (await apiGet('/x').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.message).not.toContain('<');
  });

  it('emits license-blocked and tenant-access-lost events', async () => {
    const licenseListener = jest.fn();
    const lostListener = jest.fn();
    const off = [
      onApiEvent('license-blocked', licenseListener),
      onApiEvent('tenant-access-lost', lostListener),
    ];
    setup([
      json(403, { errorCode: 'LICENSE_EXPIRED', message: 'Expired' }),
      json(403, { errorCode: 'TENANT_MEMBERSHIP_NOT_FOUND', message: 'Gone' }),
    ]);
    await apiGet('/a').catch(() => undefined);
    await apiGet('/b').catch(() => undefined);
    off.forEach((fn) => fn());
    expect(licenseListener).toHaveBeenCalledWith({ errorCode: 'LICENSE_EXPIRED', message: 'Expired' });
    expect(lostListener).toHaveBeenCalledTimes(1);
  });

  it('emits a tenant-bound forbidden event only for eligible plain 403 responses', async () => {
    const listener = jest.fn();
    const off = onApiEvent('forbidden', listener);
    const { adapter } = setup([
      json(403, { errorCode: 'HTTP_FORBIDDEN', message: 'No access' }),
      json(404, { errorCode: 'NOT_FOUND', message: 'Missing' }),
    ]);

    await apiGet('/portal/teacher/classes').catch(() => undefined);
    await apiGet('/students/1').catch(() => undefined);
    off();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(adapter.getTenantId()).toBe('tenant-1');
  });

  it('excludes special 403 codes and tenantless requests from forbidden events', async () => {
    const listener = jest.fn();
    const off = onApiEvent('forbidden', listener);
    const specialCodes = [
      'TENANT_MEMBERSHIP_NOT_FOUND',
      'TENANT_ACCESS_DENIED',
      'LICENSE_NOT_FOUND',
      'LICENSE_SUSPENDED',
      'LICENSE_EXPIRED',
      'LICENSE_NOT_YET_VALID',
      'ENTITLEMENT_DENIED',
      'TENANT_AUDIENCE_DENIED',
    ];
    setup(specialCodes.map((errorCode) => json(403, { errorCode, message: 'No access' })));
    for (let index = 0; index < specialCodes.length; index += 1) {
      await apiGet('/x').catch(() => undefined);
    }
    off();
    expect(listener).not.toHaveBeenCalled();
  });

  it('excludes authenticated skipTenant and public 403 requests', async () => {
    const listener = jest.fn();
    const off = onApiEvent('forbidden', listener);
    setup([json(403, {}), json(403, {})]);
    await apiGet('/identity/me', { skipTenant: true }).catch(() => undefined);
    await apiPost('/identity/login', {}, { skipTenant: true, public: true }).catch(() => undefined);
    off();
    expect(listener).not.toHaveBeenCalled();
  });

  it('binds a delayed 403 to the tenant used when the request started', async () => {
    let respond!: (response: Response) => void;
    const fetchImpl = jest.fn(() => new Promise<Response>((resolve) => (respond = resolve)));
    const getTenantId = jest.fn(() => 'tenant-a');
    const { adapter } = setup([], { getTenantId });
    configureClient({
      baseUrl: BASE,
      auth: adapter,
      retryDelaysMs: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const listener = jest.fn();
    const off = onApiEvent('forbidden', listener);
    const request = apiGet('/x').catch(() => undefined);
    await Promise.resolve();
    getTenantId.mockReturnValue('tenant-b');
    respond(json(403, { errorCode: 'HTTP_FORBIDDEN', message: 'No access' }));
    await request;
    off();
    expect(listener).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
  });

  describe('401 handling', () => {
    it('refreshes once and replays the request', async () => {
      const { fetchImpl, adapter } = setup([json(401, { message: 'expired' }), json(200, { ok: 1 })]);
      await expect(apiGet('/x')).resolves.toEqual({ ok: 1 });
      expect(adapter.refresh).toHaveBeenCalledTimes(1);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('shares one refresh between concurrent 401s (single-flight)', async () => {
      let release!: (ok: boolean) => void;
      const refresh = jest.fn(() => new Promise<boolean>((resolve) => (release = resolve)));
      const { fetchImpl } = setup(
        [json(401, {}), json(401, {}), json(200, { n: 1 }), json(200, { n: 2 })],
        { refresh },
      );
      const both = Promise.all([apiGet('/a'), apiGet('/b')]);
      await new Promise((resolve) => setTimeout(resolve, 10));
      release(true);
      await expect(both).resolves.toHaveLength(2);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    });

    it('emits unauthorized when refresh fails', async () => {
      const listener = jest.fn();
      const off = onApiEvent('unauthorized', listener);
      setup([json(401, { message: 'expired' })], { refresh: jest.fn(async () => false) });
      await expect(apiGet('/x')).rejects.toMatchObject({ status: 401 });
      off();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits unauthorized when the replay is still 401, without a second refresh', async () => {
      const listener = jest.fn();
      const off = onApiEvent('unauthorized', listener);
      const { adapter } = setup([json(401, {}), json(401, {})]);
      await expect(apiGet('/x')).rejects.toMatchObject({ status: 401 });
      off();
      expect(adapter.refresh).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not refresh or emit for a public route (e.g. wrong password)', async () => {
      const listener = jest.fn();
      const off = onApiEvent('unauthorized', listener);
      const { adapter } = setup([json(401, { message: 'bad credentials' })]);
      await expect(
        apiPost('/identity/login', {}, { skipTenant: true, public: true }),
      ).rejects.toMatchObject({ status: 401 });
      off();
      expect(adapter.refresh).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('network errors', () => {
    it('retries a GET on network errors, then succeeds', async () => {
      const { fetchImpl } = setup([new Error('offline'), new Error('offline'), json(200, { ok: 1 })]);
      await expect(apiGet('/x')).resolves.toEqual({ ok: 1 });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('gives up after the max retries with a NETWORK_ERROR (status 0)', async () => {
      const { fetchImpl } = setup([new Error('a'), new Error('b'), new Error('c')]);
      await expect(apiGet('/x')).rejects.toMatchObject({ status: 0, errorCode: 'NETWORK_ERROR' });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('never retries a POST', async () => {
      const { fetchImpl } = setup([new Error('offline'), json(200, {})]);
      await expect(apiPost('/attendance/records', {})).rejects.toMatchObject({ status: 0 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });
});
