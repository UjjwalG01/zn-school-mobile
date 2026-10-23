// Hand-written from the backend ENDPOINTS.md (ARCHITECTURE §9, A6). Only fields the app uses.

/** `GET /identity/me` — the caller's own identity, not tenant-scoped. */
export interface Me {
  id: string;
  /** null for an account that signs in with a phone number only (backend migration 0228). */
  email: string | null;
  /** E.164, or null. */
  phone: string | null;
  fullName: string;
  isPlatformAdmin: boolean;
  /** Strictest idle window across the caller's active memberships (30 until B1 ships). */
  sessionTimeoutMinutes: number;
}
