import { configureClient } from '../client';
import { login } from '../identity';

describe('login request', () => {
  it('posts { email, password } as a public, non-tenant call', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'r' }), { status: 200 }),
    );
    configureClient({
      baseUrl: 'https://api.test',
      auth: { getAccessToken: () => 'stale', getTenantId: () => null, refresh: async () => true },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(login('a@b.co', 'pw')).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/identity/login');
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.co', password: 'pw' }));
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
