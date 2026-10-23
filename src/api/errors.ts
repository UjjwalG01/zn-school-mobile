// Ported from the web client (apps/web/src/lib/api-client.ts) with the mobile behavior mapping of
// docs/api/API_CONTRACT.md §4. Branch on `errorCode`, never on `message` text.

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export const NETWORK_ERROR_MESSAGE =
  'Could not reach the server. Check your connection and try again.';

/** Backend 403 codes meaning the school's license blocks every tenant route (ADR-0035). */
export const LICENSE_BLOCK_CODES: ReadonlySet<string> = new Set([
  'LICENSE_NOT_FOUND',
  'LICENSE_SUSPENDED',
  'LICENSE_EXPIRED',
  'LICENSE_NOT_YET_VALID',
]);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Turns a raw response body into `(message, errorCode)`. The backend envelope is
 * `{ statusCode, errorCode, message, error, timestamp, path }` and `message` may be a string or
 * string[]. Never throws: an HTML proxy error page still yields a usable message.
 */
export function parseErrorBody(responseBody: string): { message: string; errorCode?: string } {
  try {
    const parsed: unknown = JSON.parse(responseBody);
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      const { message, errorCode } = parsed as { message: unknown; errorCode?: unknown };
      const text = Array.isArray(message) ? message.join(', ') : message;
      if (typeof text === 'string' && text) {
        return { message: text, errorCode: typeof errorCode === 'string' ? errorCode : undefined };
      }
    }
  } catch {
    // Not JSON (e.g. an HTML proxy error page) — fall through to the raw text.
  }
  return { message: responseBody };
}

/** Message safe to show when the backend sent nothing usable (HTML page, empty body). */
export function defaultErrorMessage(status: number): string {
  if (status === 0) return NETWORK_ERROR_MESSAGE;
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'That item could not be found.';
  if (status === 409) return 'This conflicts with a recent change. Refresh and try again.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'The request could not be completed. Check the details and try again.';
}

/** What the app should do about an error — the single mapping of API_CONTRACT §4. */
export type ApiErrorAction =
  | 'session-expired' // 401 after refresh, or refresh itself rejected → local logout
  | 'offline' // status 0 → offline banner, reads from cache, writes blocked
  | 'drop-school' // TENANT_MEMBERSHIP_NOT_FOUND → remove school, refetch my-schools
  | 'school-suspended' // TENANT_ACCESS_DENIED
  | 'license-blocked' // LICENSE_* → "service unavailable for this school"
  | 'feature-denied' // ENTITLEMENT_DENIED → hide feature, refetch my-schools
  | 'forbidden' // other 403 → "no access", refetch my-permissions
  | 'conflict' // CONCURRENCY_VERSION_CONFLICT → refetch, show newer data, never overwrite
  | 'wait' // AUTH_TOO_MANY_ATTEMPTS → wait message, no auto retry
  | 'field-error' // AUTH_CURRENT_PASSWORD_INCORRECT → field error, do NOT log out
  | 'not-issued' // DOCUMENT_NOT_ISSUED
  | 'validation' // other 400 → map message[] to form fields
  | 'server' // 5xx → generic error + retry
  | 'unknown';

export function errorAction(error: ApiError): ApiErrorAction {
  const { status, errorCode } = error;
  if (errorCode === NETWORK_ERROR_CODE || status === 0) return 'offline';
  if (errorCode === 'TENANT_MEMBERSHIP_NOT_FOUND') return 'drop-school';
  if (errorCode === 'TENANT_ACCESS_DENIED') return 'school-suspended';
  if (errorCode && LICENSE_BLOCK_CODES.has(errorCode)) return 'license-blocked';
  if (errorCode === 'ENTITLEMENT_DENIED') return 'feature-denied';
  // Any 409 means "something changed or the idempotency key was reused": refetch and re-apply.
  // ATTENDANCE_ALREADY_RECORDED and the key-reuse 409 carry no CONCURRENCY_* code.
  if (errorCode === 'CONCURRENCY_VERSION_CONFLICT' || status === 409) return 'conflict';
  if (errorCode === 'AUTH_TOO_MANY_ATTEMPTS' || status === 429) return 'wait';
  if (errorCode === 'AUTH_CURRENT_PASSWORD_INCORRECT') return 'field-error';
  if (errorCode === 'DOCUMENT_NOT_ISSUED') return 'not-issued';
  if (status === 401) return 'session-expired';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** `errorAction` for anything a query can throw; a non-API error is `unknown`. */
export function errorActionOf(error: unknown): ApiErrorAction {
  return error instanceof ApiError ? errorAction(error) : 'unknown';
}
