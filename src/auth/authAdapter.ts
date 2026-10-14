// What the ONE API client needs from the session (AuthAdapter). Refresh rules: AUTH_AND_SESSION §5,
// .claude/rules/security.md §2. No timers: refresh happens only when a request is about to be sent
// or after a 401.
import { ApiError } from '../api/errors';
import { refreshSessionOnce, type AuthAdapter } from '../api/client';
import { refreshTokens } from '../api/identity';
import { msUntilExpiry } from './jwt';
import { getSession } from './session';
import { loadAccessToken, loadRefreshToken, saveTokens } from './tokenStore';

/** Refresh proactively when the access token has less than this left (ms). */
export const REFRESH_SKEW_MS = 60_000;

/**
 * Rotates the pair. The new pair is persisted BEFORE this resolves, so nothing ever uses (or loses)
 * a rotated-away token. `false` = session over (401 from /identity/refresh); an unknown outcome
 * (offline, 5xx) rejects, so the request fails and the session is kept.
 */
async function refresh(): Promise<boolean> {
  const refreshToken = await loadRefreshToken().catch(() => null);
  if (!refreshToken) return false;
  try {
    await saveTokens(await refreshTokens(refreshToken));
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return false;
      throw error;
    }
    return false; // e.g. the keystore refused the new pair — we can't continue safely
  }
}

async function getAccessToken(): Promise<string | null> {
  const token = await loadAccessToken();
  if (!token) return null;
  const remaining = msUntilExpiry(token);
  if (remaining === null || remaining > REFRESH_SKEW_MS) return token;
  try {
    // Single-flight with any concurrent 401 refresh.
    if (await refreshSessionOnce()) return await loadAccessToken();
  } catch {
    // Unknown outcome (offline): send what we have; a 401 will take the normal path.
  }
  return token;
}

export const authAdapter: AuthAdapter = {
  getAccessToken,
  getTenantId: () => getSession().tenantId,
  refresh,
};
