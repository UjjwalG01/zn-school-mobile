// Session store: WHO is signed in and WHICH school/shell is selected. Client state only — server
// data (me, schools, permissions) lives in TanStack Query (mobile-frontend.md §3). A tiny external
// store read through useSyncExternalStore, so no state library is added.
import { useSyncExternalStore } from 'react';

import { loadTokens } from './tokenStore';
import { loadContext, type Shell, saveContext } from './tenantStore';

export type SessionStatus = 'booting' | 'signed-out' | 'signed-in';
/** Why the user is on the login screen without having pressed "sign out". */
export type SessionNotice = 'session-expired';
/** The selected school can't be used: license problem or suspended/archived. */
export type SchoolBlock = 'license' | 'suspended';

export interface SessionState {
  status: SessionStatus;
  /** Selected school. Comes only from `GET /tenancy/my-schools`; read by the API client. */
  tenantId: string | null;
  /** Shell currently shown. */
  shell: Shell | null;
  /** Shells available for the selected school (drives the switcher). */
  shells: Shell[];
  blocked: SchoolBlock | null;
  notice: SessionNotice | null;
}

const INITIAL: SessionState = {
  status: 'booting',
  tenantId: null,
  shell: null,
  shells: [],
  blocked: null,
  notice: null,
};

let state: SessionState = INITIAL;
const listeners = new Set<() => void>();

export const getSession = (): SessionState => state;

function update(patch: Partial<SessionState>): void {
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

function persistContext(): void {
  void saveContext({ tenantId: state.tenantId, shell: state.shell });
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useSession = (): SessionState =>
  useSyncExternalStore(subscribeSession, getSession, getSession);

/** Cold start: tokens present → signed in with the persisted school/shell (revalidated later). */
export async function restoreSession(): Promise<void> {
  try {
    const tokens = await loadTokens();
    if (!tokens) return update({ status: 'signed-out' });
    const { tenantId, shell } = await loadContext();
    update({ status: 'signed-in', tenantId, shell, shells: [], blocked: null, notice: null });
  } catch {
    update({ status: 'signed-out' });
  }
}

/** After a successful login (tokens already saved). */
export function startSession(): void {
  update({ status: 'signed-in', tenantId: null, shell: null, shells: [], blocked: null, notice: null });
}

/** Local end of a session; the caller wipes storage/caches (`logout.ts`). */
export function endSession(notice: SessionNotice | null = null): void {
  update({ ...INITIAL, status: 'signed-out', notice });
}

export function selectTenant(tenantId: string): void {
  update({ tenantId, shell: state.tenantId === tenantId ? state.shell : null, shells: [], blocked: null });
  persistContext();
}

export function clearTenant(): void {
  update({ tenantId: null, shell: null, shells: [], blocked: null });
  persistContext();
}

export function setShells(shells: Shell[], shell: Shell | null): void {
  const changed = shell !== state.shell;
  update({ shells, shell });
  if (changed) persistContext();
}

export function setBlocked(blocked: SchoolBlock | null): void {
  update({ blocked });
}

export function clearNotice(): void {
  if (state.notice) update({ notice: null });
}

/** Test seam. */
export function resetSessionForTests(): void {
  state = INITIAL;
  listeners.clear();
}
