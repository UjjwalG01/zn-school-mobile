// Tokens live ONLY in expo-secure-store (.claude/rules/security.md §1): never in AsyncStorage, the
// query cache or logs. The access token is also held in memory so a request doesn't hit the
// keystore; the refresh token is read from SecureStore when needed.
import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from '../api/identity';

const ACCESS_KEY = 'zn.accessToken';
const REFRESH_KEY = 'zn.refreshToken';

let accessInMemory: string | null = null;

/** Persists the pair. Rejects if the device cannot store it, so a caller never proceeds unsaved. */
export async function saveTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  accessInMemory = tokens.accessToken;
}

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  accessInMemory = accessToken;
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function loadAccessToken(): Promise<string | null> {
  return accessInMemory ?? (await SecureStore.getItemAsync(ACCESS_KEY));
}

export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  accessInMemory = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
