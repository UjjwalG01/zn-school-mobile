// Reads ONLY the `exp` claim so the client can refresh proactively (AUTH_AND_SESSION §5). The
// signature is not verified — this is a scheduling hint, never an authorization decision.

/** Milliseconds until the token expires (negative = already expired), or null if unreadable. */
export function msUntilExpiry(token: string, now: number = Date.now()): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    const { exp } = JSON.parse(json) as { exp?: unknown };
    return typeof exp === 'number' ? exp * 1000 - now : null;
  } catch {
    return null;
  }
}
