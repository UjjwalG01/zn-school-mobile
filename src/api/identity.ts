// Typed requests for /identity/* (docs/api/API_CONTRACT.md §2). Only endpoints the backend has built.
import { apiGet, apiPost } from './client';
import type { Me } from './types/identity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const PUBLIC = { public: true, skipTenant: true } as const;

/**
 * `POST /identity/login` — public, not tenant-scoped. `identifier` is the e-mail or phone on record; `clientType: 'mobile'`
 * selects the 7-day idle limit (ADR-0066).
 */
export const login = (identifier: string, password: string) =>
  apiPost<TokenPair>('/identity/login', { identifier, password, clientType: 'mobile' }, PUBLIC);

export type ActivationStatus = 'activated' | 'guardian_added' | 'password_reset';

/**
 * `POST /identity/activate` — public. Redeems a school's 8-character code (a staff invitation or a guardian code, ADR-0082 /
 * ADR-0067). `password` is the new one for a new account, the account's current one when it gains access to another school
 * (`ACTIVATION_PASSWORD_REQUIRED` otherwise), or the new one for an admin reset. Does not sign in: call `login` next.
 */
export const activate = (body: { code: string; identifier: string; password?: string }) =>
  apiPost<{ status: ActivationStatus }>('/identity/activate', body, PUBLIC);

/** `POST /identity/refresh` — public. Rotates: the old refresh token stops working. */
export const refreshTokens = (refreshToken: string) =>
  apiPost<TokenPair>('/identity/refresh', { refreshToken }, PUBLIC);

/**
 * `POST /identity/logout` — revokes the refresh token (204). The backend marks it public, and
 * sending no Bearer means an expired access token can't trigger a refresh loop during logout.
 */
export const logoutRequest = (refreshToken: string) =>
  apiPost<void>('/identity/logout', { refreshToken }, PUBLIC);

/** `GET /identity/me` — not tenant-scoped. */
export const getMe = () => apiGet<Me>('/identity/me', { skipTenant: true });
