// Context resolution after login (ARCHITECTURE §3): schools → selected school → permissions →
// shell. `GET /identity/me` is fetched alongside for the greeting but does not gate navigation.
// Cached answers (session staleTime, persisted) resolve instantly on a cold start and are
// revalidated in the background.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useMe, useMyPermissions, useMySchools } from './queries';
import { pickShell, pickTenant, resolveShells } from './resolveShell';
import { chooseSchool, forgetSchool } from './schoolActions';
import { type SchoolBlock, setShells, useSession } from './session';
import type { Shell } from './tenantStore';

export type ContextState =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown; retry: () => void }
  | { kind: 'no-school' }
  | { kind: 'choose-school' }
  | { kind: 'blocked'; block: SchoolBlock }
  | { kind: 'web-only' }
  | { kind: 'ready'; shell: Shell };

export function useSessionContext(): ContextState {
  const queryClient = useQueryClient();
  const session = useSession();
  useMe();
  const schools = useMySchools();

  const selection = schools.data ? pickTenant(schools.data, session.tenantId) : null;
  const selectedId = selection?.kind === 'selected' ? selection.tenantId : null;
  const tenantId = selectedId !== null && selectedId === session.tenantId ? selectedId : null;

  // Keep the store (read by the API client) in step with the resolved selection.
  useEffect(() => {
    if (!selection) return;
    if (selection.kind === 'selected') {
      if (selection.tenantId !== session.tenantId) chooseSchool(queryClient, selection.tenantId);
    } else if (session.tenantId) {
      forgetSchool(queryClient); // stored school is no longer in my-schools
    }
  }, [queryClient, selection, session.tenantId]);

  const permissions = useMyPermissions(tenantId, session.blocked === null);
  const available = permissions.data
    ? resolveShells({ permissions: permissions.data })
    : null;
  const shell = available ? pickShell(available, session.shell) : null;
  const availableKey = available?.join(',') ?? null;

  useEffect(() => {
    if (available === null) return;
    if (shell !== session.shell || availableKey !== session.shells.join(',')) {
      setShells(available, shell);
    }
  }, [available, availableKey, shell, session.shell, session.shells]);

  if (session.blocked) return { kind: 'blocked', block: session.blocked };
  if (!schools.data) {
    return schools.isError
      ? { kind: 'error', error: schools.error, retry: () => void schools.refetch() }
      : { kind: 'loading' };
  }
  if (selection?.kind === 'none') return { kind: 'no-school' };
  if (selection?.kind === 'choose') return { kind: 'choose-school' };
  if (tenantId === null) return { kind: 'loading' };
  if (!permissions.data) {
    return permissions.isError
      ? { kind: 'error', error: permissions.error, retry: () => void permissions.refetch() }
      : { kind: 'loading' };
  }
  if (available?.length === 0) return { kind: 'web-only' };
  if (shell === null || shell !== session.shell) return { kind: 'loading' }; // store sync pending
  return { kind: 'ready', shell };
}
