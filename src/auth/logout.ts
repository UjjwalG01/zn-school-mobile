// Logout (security.md §4, AUTH_AND_SESSION §6): revoke best-effort, then ALWAYS wipe locally —
// it works offline. Used by "Sign out" and by the `unauthorized` event.
import type { QueryClient } from '@tanstack/react-query';

import { logoutRequest } from '../api/identity';
import { clearCachedFiles } from '../lib/files';
import { resetPersistedCache } from '../lib/queryClient';
import { endSession, type SessionNotice } from './session';
import { clearContext } from './tenantStore';
import { clearTokens, loadRefreshToken } from './tokenStore';

export interface LogoutOptions {
  /** Skip `POST /identity/logout` (the session is already dead, e.g. refresh was rejected). */
  remote?: boolean;
  notice?: SessionNotice;
}

export async function logout(
  queryClient: QueryClient,
  { remote = true, notice }: LogoutOptions = {},
): Promise<void> {
  // Capture the refresh token first; the revoke call must not delay (or block) the local wipe.
  const refreshToken = remote ? await loadRefreshToken().catch(() => null) : null;
  if (refreshToken) void logoutRequest(refreshToken).catch(() => undefined);

  // Leave the signed-in screens first so nothing refetches into the cache we are about to clear.
  endSession(notice ?? null);
  await queryClient.cancelQueries();

  // Every step runs even if another fails.
  await Promise.allSettled([
    clearTokens(),
    clearContext(),
    resetPersistedCache(queryClient),
    Promise.resolve().then(clearCachedFiles),
  ]);
}
