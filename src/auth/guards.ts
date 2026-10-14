// Route-group guards as a pure function: which group may the current session see? Group layouts
// render `<Redirect>` from the result. UX routing only — the backend authorizes every call.
import { type SessionState, useSession } from './session';
import type { Shell } from './tenantStore';

export type GuardArea = 'auth' | 'signed-in' | Shell;

export type Guard =
  | { kind: 'allow' }
  | { kind: 'wait' } // session not restored yet
  | { kind: 'redirect'; href: '/login' | '/resolve' };

export function guardFor(session: SessionState, area: GuardArea): Guard {
  if (session.status === 'booting') return { kind: 'wait' };

  if (area === 'auth') {
    return session.status === 'signed-in' ? { kind: 'redirect', href: '/resolve' } : { kind: 'allow' };
  }

  if (session.status === 'signed-out') return { kind: 'redirect', href: '/login' };
  if (area === 'signed-in') return { kind: 'allow' };

  // A shell: needs a selected school, a usable school and that exact shell; otherwise re-resolve.
  const ready = session.tenantId !== null && session.blocked === null && session.shell === area;
  return ready ? { kind: 'allow' } : { kind: 'redirect', href: '/resolve' };
}

export const useGuard = (area: GuardArea): Guard => guardFor(useSession(), area);
