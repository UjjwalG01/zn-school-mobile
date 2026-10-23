// Idempotency-key bookkeeping shared by every bulk save (attendance, marks). The key follows the
// payload: the same bytes keep their key (a request that may have reached the server is replayed by
// the backend, not written twice), any edit gets a new one.
import type { ApiErrorAction } from '../api/errors';

export interface PendingAttempt {
  signature: string;
  key: string;
}

/** The same payload keeps its key (a retry); any edit gets a new one. */
export function attemptFor(
  signature: string,
  pending: PendingAttempt | null,
  makeKey: () => string,
): PendingAttempt {
  return pending !== null && pending.signature === signature ? pending : { signature, key: makeKey() };
}

/** Keep the key only when the server may have processed the request (outcome unknown). */
export const keepKeyAfter = (action: ApiErrorAction): boolean => action === 'offline' || action === 'server';
