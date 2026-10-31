// Pure activation-form logic (no UI): which message an activation error maps to. UX only; the backend decides (CLAUDE.md §3).
import { ApiError, errorAction } from '../api/errors';
import type { MessageKey } from '../i18n';

/** The shortest password the backend accepts for a new account. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * API_CONTRACT §2 for `POST /identity/activate`. Branches on errorCode first, then on the shared action class. A missing or
 * unknown code and an expired one are the same answer (`ACTIVATION_CODE_INVALID`), so the message does not reveal which.
 */
export function activateErrorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return 'auth.error.generic';
  if (error.errorCode === 'ACTIVATION_CODE_INVALID') return 'activate.error.codeInvalid';
  if (error.errorCode === 'ACTIVATION_PASSWORD_REQUIRED') return 'activate.error.currentPasswordRequired';
  switch (errorAction(error)) {
    case 'offline':
      return 'auth.error.offline';
    case 'wait':
      return 'auth.error.tooManyAttempts';
    case 'validation':
      return 'auth.error.validation';
    case 'server':
      return 'auth.error.server';
    default:
      return 'auth.error.generic';
  }
}
