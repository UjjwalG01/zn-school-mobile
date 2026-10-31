// Pure login-form logic (no UI): what the identifier is, and which message an API error maps to.
// These are UX hints only — the backend validates and decides (CLAUDE.md §3).
import { ApiError, errorAction } from '../api/errors';
import type { MessageKey } from '../i18n';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s-]{7,}$/;

export type IdentifierKind = 'empty' | 'email' | 'phone' | 'invalid';

/** An e-mail or a phone number; the server normalises the phone (a national number gets +977). */
export function classifyIdentifier(raw: string): IdentifierKind {
  const value = raw.trim();
  if (!value) return 'empty';
  if (EMAIL.test(value)) return 'email';
  if (PHONE.test(value)) return 'phone';
  return 'invalid';
}

/** API_CONTRACT §4 for the login call. Branches on status/errorCode, never on message text. */
export function loginErrorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return 'auth.error.generic';
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
      // On the public login route a 401 means wrong credentials, not an expired session.
      return error.status === 401 ? 'auth.error.invalidCredentials' : 'auth.error.generic';
  }
}
