const KEYS = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_APP_ENV'] as const;
const saved: Record<string, string | undefined> = {};

function loadEnv(vars: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, vars);
  jest.resetModules();
  // Re-evaluate the module with the new process.env; dynamic import() is unavailable in Jest CJS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../env') as typeof import('../env')).env;
}

beforeAll(() => {
  for (const key of KEYS) saved[key] = process.env[key];
});

afterAll(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('env', () => {
  it('reads a valid development config and strips trailing slashes', () => {
    const env = loadEnv({ EXPO_PUBLIC_API_URL: 'http://192.168.1.10:3001/' });
    expect(env).toEqual({ appEnv: 'development', apiUrl: 'http://192.168.1.10:3001' });
  });

  it('rejects a missing or placeholder API URL', () => {
    expect(() => loadEnv({})).toThrow('EXPO_PUBLIC_API_URL');
    expect(() => loadEnv({ EXPO_PUBLIC_API_URL: 'http://YOUR_PC_IP:3001' })).toThrow(
      'EXPO_PUBLIC_API_URL',
    );
  });

  it('requires https outside development', () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_URL: 'http://api.test' }),
    ).toThrow('https://');
    const env = loadEnv({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://api.test',
    });
    expect(env.apiUrl).toBe('https://api.test');
  });

  it('rejects an unknown app env', () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_APP_ENV: 'qa', EXPO_PUBLIC_API_URL: 'https://api.test' }),
    ).toThrow('EXPO_PUBLIC_APP_ENV');
  });
});
