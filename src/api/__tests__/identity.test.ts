import { configureClient } from '../client';
import { activate, login } from '../identity';

const BASE = 'https://api.test';

function setup(response: Response = new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'r' }), { status: 200 })) {
  const fetchImpl = jest.fn(async () => response);
  configureClient({
    baseUrl: BASE,
    auth: { getAccessToken: () => 'stale', getTenantId: () => null, refresh: async () => true },
    retryDelaysMs: [],
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return fetchImpl;
}

const sent = (fetchImpl: jest.Mock) => {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body)) as Record<string, unknown> };
};

describe('login request', () => {
  it('posts identifier, password and clientType mobile as a public, non-tenant call', async () => {
    const fetchImpl = setup();
    await expect(login('+9779841234567', 'pw')).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });

    const { url, init, body } = sent(fetchImpl);
    expect(url).toBe(`${BASE}/identity/login`);
    expect(body).toEqual({ identifier: '+9779841234567', password: 'pw', clientType: 'mobile' });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('activate request', () => {
  it('posts code, identifier and password to /identity/activate, public', async () => {
    const fetchImpl = setup(new Response(JSON.stringify({ status: 'activated' }), { status: 200 }));
    await expect(activate({ code: 'ABCD2345', identifier: 'parent@example.com', password: 'new-password' })).resolves.toEqual({
      status: 'activated',
    });

    const { url, init, body } = sent(fetchImpl);
    expect(url).toBe(`${BASE}/identity/activate`);
    expect(body).toEqual({ code: 'ABCD2345', identifier: 'parent@example.com', password: 'new-password' });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
