import { type Guard, guardFor } from '../guards';
import type { SessionState } from '../session';

const base: SessionState = {
  status: 'signed-in',
  tenantId: 't1',
  shell: 'teacher',
  shells: ['teacher'],
  blocked: null,
  notice: null,
};
const go = (href: '/login' | '/resolve'): Guard => ({ kind: 'redirect', href });

describe('guardFor', () => {
  it('waits for session restore everywhere', () => {
    for (const area of ['auth', 'signed-in', 'teacher', 'guardian'] as const) {
      expect(guardFor({ ...base, status: 'booting' }, area)).toEqual({ kind: 'wait' });
    }
  });

  it('keeps signed-out users on the auth group and sends signed-in users to resolve', () => {
    expect(guardFor({ ...base, status: 'signed-out' }, 'auth')).toEqual({ kind: 'allow' });
    expect(guardFor(base, 'auth')).toEqual(go('/resolve'));
  });

  it('sends signed-out users to login from every signed-in area', () => {
    const out = { ...base, status: 'signed-out' as const };
    for (const area of ['signed-in', 'teacher', 'guardian'] as const) {
      expect(guardFor(out, area)).toEqual(go('/login'));
    }
  });

  it('allows the matching shell only when a school is selected and usable', () => {
    expect(guardFor(base, 'teacher')).toEqual({ kind: 'allow' });
    expect(guardFor(base, 'guardian')).toEqual(go('/resolve')); // wrong shell
    expect(guardFor({ ...base, tenantId: null }, 'teacher')).toEqual(go('/resolve')); // school dropped
    expect(guardFor({ ...base, blocked: 'license' }, 'teacher')).toEqual(go('/resolve'));
    expect(guardFor({ ...base, shell: null }, 'teacher')).toEqual(go('/resolve'));
  });

  it('lets a signed-in user reach the context screens even without a school', () => {
    expect(guardFor({ ...base, tenantId: null, shell: null }, 'signed-in')).toEqual({ kind: 'allow' });
  });
});
