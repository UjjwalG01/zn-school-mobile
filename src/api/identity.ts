// Typed requests for /identity/* (docs/api/API_CONTRACT.md §2). Only endpoints that EXIST today.
// B1/B2 (identifier + clientType) and B3 (activation code) are Proposed — not called from here.
import { apiGet, apiPost } from './client';
import type { Me } from './types/identity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const PUBLIC = { public: true, skipTenant: true } as const;

/** `POST /identity/login` — public, not tenant-scoped. Today's body is `{ email, password }`. */
export const login = (email: string, password: string) =>
  apiPost<TokenPair>('/identity/login', { email, password }, PUBLIC);

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
