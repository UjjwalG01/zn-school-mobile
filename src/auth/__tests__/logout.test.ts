import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import { logoutRequest } from '../../api/identity';
import { clearCachedFiles } from '../../lib/files';
import { logout } from '../logout';
import { getSession, resetSessionForTests, startSession } from '../session';
import { loadTokens, saveTokens } from '../tokenStore';

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecure.set(key, value)),
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecure.delete(key)),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../api/identity', () => ({ logoutRequest: jest.fn(async () => undefined) }));
jest.mock('../../lib/files', () => ({ clearCachedFiles: jest.fn() }));

async function seed() {
  mockSecure.clear();
  await AsyncStorage.clear();
  await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });
  await AsyncStorage.setItem('zn-context', JSON.stringify({ tenantId: 't1', shell: 'teacher' }));
  await AsyncStorage.setItem('zn-query-cache', '{"persisted":true}');
  const queryClient = new QueryClient();
  queryClient.setQueryData(['t1', 'roster'], [1, 2, 3]);
  resetSessionForTests();
  startSession();
  return queryClient;
}

describe('logout (security.md §4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokes the refresh token, then wipes tokens, context, query cache (memory + disk) and files', async () => {
    const queryClient = await seed();

    await logout(queryClient);

    expect(logoutRequest).toHaveBeenCalledWith('r1');
    expect(await loadTokens()).toBeNull();
    expect(await AsyncStorage.getItem('zn-context')).toBeNull();
    expect(await AsyncStorage.getItem('zn-query-cache')).toBeNull();
    expect(queryClient.getQueryData(['t1', 'roster'])).toBeUndefined();
    expect(clearCachedFiles).toHaveBeenCalledTimes(1);
    expect(getSession()).toMatchObject({ status: 'signed-out', tenantId: null, shell: null });
  });

  it('still wipes everything when the revoke call fails (works offline)', async () => {
    const queryClient = await seed();
    (logoutRequest as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    await logout(queryClient);

    expect(await loadTokens()).toBeNull();
    expect(getSession().status).toBe('signed-out');
  });

  it('skips the revoke call when the session is already dead, and records the notice', async () => {
    const queryClient = await seed();

    await logout(queryClient, { remote: false, notice: 'session-expired' });

    expect(logoutRequest).not.toHaveBeenCalled();
    expect(await loadTokens()).toBeNull();
    expect(getSession()).toMatchObject({ status: 'signed-out', notice: 'session-expired' });
  });

  it('keeps wiping when one step throws', async () => {
    const queryClient = await seed();
    (clearCachedFiles as jest.Mock).mockImplementationOnce(() => {
      throw new Error('disk');
    });

    await logout(queryClient);

    expect(await loadTokens()).toBeNull();
    expect(await AsyncStorage.getItem('zn-query-cache')).toBeNull();
  });
});
