// Hand-written from the backend ENDPOINTS.md (ARCHITECTURE §9, A6). Only fields the app uses.

/** `GET /identity/me` — the caller's own identity, not tenant-scoped. */
export interface Me {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  /** Strictest idle window across the caller's active memberships (30 until B1 ships). */
  sessionTimeoutMinutes: number;
}
