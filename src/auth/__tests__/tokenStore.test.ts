import * as SecureStore from 'expo-secure-store';

import {
  clearTokens,
  loadAccessToken,
  loadRefreshToken,
  loadTokens,
  saveTokens,
} from '../tokenStore';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

describe('tokenStore', () => {
  beforeEach(async () => {
    await clearTokens();
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('serves the access token from memory but reads the refresh token from SecureStore', async () => {
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });
    (SecureStore.getItemAsync as jest.Mock).mockClear();
    expect(await loadAccessToken()).toBe('a1');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(await loadRefreshToken()).toBe('r1');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('zn.refreshToken');
  });

  it('forgets the in-memory access token when cleared', async () => {
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });
    await clearTokens();
    expect(await loadAccessToken()).toBeNull();
  });

  it('round-trips a token pair through SecureStore', async () => {
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });
    expect(await loadTokens()).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  it('returns null when nothing (or only half a pair) is stored', async () => {
    expect(await loadTokens()).toBeNull();
    mockStore.set('zn.accessToken', 'a1');
    expect(await loadTokens()).toBeNull();
  });

  it('clears both tokens', async () => {
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });
    await clearTokens();
    expect(await loadTokens()).toBeNull();
  });

  it('propagates a storage failure so the caller never proceeds unsaved', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    await expect(saveTokens({ accessToken: 'a', refreshToken: 'r' })).rejects.toThrow('keystore');
  });
});
