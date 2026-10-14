// Refresh single-flight, persist-before-use and the failure modes (AUTH_AND_SESSION §5,
// security.md §2) — exercised through the REAL client + auth adapter + token store.
import { apiGet, configureClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { onApiEvent } from '../../api/events';
import { authAdapter } from '../authAdapter';
import { clearTokens, loadTokens, saveTokens } from '../tokenStore';

const mockEvents: string[] = [];
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockEvents.push(`save:${key}`);
    mockStore.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

type Handler = (path: string, bearer: string | null) => Response | Promise<Response> | Error;

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function jwtExpiringIn(seconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `h.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.s`;
}

function serve(handler: Handler) {
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const bearer = ((init.headers ?? {}) as Record<string, string>).Authorization ?? null;
    mockEvents.push(`fetch:${path}:${bearer ?? '-'}`);
    const result = await handler(path, bearer);
    if (result instanceof Error) throw result;
    return result;
  });
  configureClient({
    baseUrl: 'https://api.test',
    auth: authAdapter,
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

const count = (prefix: string) => mockEvents.filter((e) => e.startsWith(prefix)).length;

describe('refresh', () => {
  const unauthorized = jest.fn();
  let off: () => void;

  beforeEach(async () => {
    mockEvents.length = 0;
    mockStore.clear();
    await clearTokens();
    await saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    mockEvents.length = 0;
    unauthorized.mockClear();
    off = onApiEvent('unauthorized', unauthorized);
  });
  afterEach(() => off());

  it('shares ONE refresh between concurrent 401s and replays each request once with the new token', async () => {
    serve((path, bearer) => {
      if (path === '/identity/refresh') return json(200, { accessToken: 'new', refreshToken: 'r2' });
      return bearer === 'Bearer new' ? json(200, { ok: true }) : json(401, { message: 'expired' });
    });

    const results = await Promise.all([
      apiGet('/a', { skipTenant: true }),
      apiGet('/b', { skipTenant: true }),
      apiGet('/c', { skipTenant: true }),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(count('fetch:/identity/refresh')).toBe(1);
    expect(mockEvents.filter((e) => e.endsWith(':Bearer new'))).toHaveLength(3); // one replay each
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('persists the rotated pair BEFORE the replayed request uses it', async () => {
    serve((path, bearer) => {
      if (path === '/identity/refresh') return json(200, { accessToken: 'new', refreshToken: 'r2' });
      return bearer === 'Bearer new' ? json(200, {}) : json(401, { message: 'expired' });
    });

    await apiGet('/a', { skipTenant: true });

    const savedRefresh = mockEvents.indexOf('save:zn.refreshToken');
    const savedAccess = mockEvents.indexOf('save:zn.accessToken');
    const replay = mockEvents.indexOf('fetch:/a:Bearer new');
    expect(savedRefresh).toBeGreaterThan(-1);
    expect(savedAccess).toBeGreaterThan(savedRefresh);
    expect(replay).toBeGreaterThan(savedAccess);
    expect(await loadTokens()).toEqual({ accessToken: 'new', refreshToken: 'r2' });
  });

  it('sends the stored refresh token to /identity/refresh without a Bearer', async () => {
    const fetchImpl = serve((path, bearer) =>
      path === '/identity/refresh'
        ? json(200, { accessToken: 'new', refreshToken: 'r2' })
        : bearer === 'Bearer new'
          ? json(200, {})
          : json(401, {}),
    );
    await apiGet('/a', { skipTenant: true });
    const call = fetchImpl.mock.calls.find(([url]) => url.endsWith('/identity/refresh'));
    expect(call?.[1].body).toBe(JSON.stringify({ refreshToken: 'r1' }));
    expect(mockEvents).toContain('fetch:/identity/refresh:-');
  });

  it('ends the session when /identity/refresh answers 401 (no replay, one unauthorized)', async () => {
    serve((path) =>
      path === '/identity/refresh' ? json(401, { message: 'revoked' }) : json(401, { message: 'expired' }),
    );

    await expect(apiGet('/a', { skipTenant: true })).rejects.toMatchObject({ status: 401 });

    expect(count('fetch:/a')).toBe(1);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh call fails offline (no logout, tokens untouched)', async () => {
    serve((path) =>
      path === '/identity/refresh' ? new Error('network down') : json(401, { message: 'expired' }),
    );

    const error = await apiGet('/a', { skipTenant: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect(unauthorized).not.toHaveBeenCalled();
    expect(await loadTokens()).toEqual({ accessToken: 'old', refreshToken: 'r1' });
  });

  it('refreshes BEFORE sending when the access token has < 60 s left', async () => {
    await saveTokens({ accessToken: jwtExpiringIn(30), refreshToken: 'r1' });
    mockEvents.length = 0;
    serve((path, bearer) =>
      path === '/identity/refresh'
        ? json(200, { accessToken: 'new', refreshToken: 'r2' })
        : bearer === 'Bearer new'
          ? json(200, {})
          : json(401, {}),
    );

    await apiGet('/a', { skipTenant: true });

    expect(count('fetch:/identity/refresh')).toBe(1);
    expect(count('fetch:/a')).toBe(1); // no failed attempt + replay
    expect(mockEvents.indexOf('fetch:/identity/refresh:-')).toBeLessThan(
      mockEvents.indexOf('fetch:/a:Bearer new'),
    );
  });

  it('does not refresh when the token has plenty of time left', async () => {
    await saveTokens({ accessToken: jwtExpiringIn(600), refreshToken: 'r1' });
    mockEvents.length = 0;
    serve(() => json(200, {}));
    await apiGet('/a', { skipTenant: true });
    expect(count('fetch:/identity/refresh')).toBe(0);
  });
});
