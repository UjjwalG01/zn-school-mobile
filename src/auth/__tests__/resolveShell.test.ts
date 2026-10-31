import type { School } from '../../api/types/tenancy';
import { pickShell, pickTenant, resolveShells } from '../resolveShell';

const perms = (keys: string[], all = false) => ({ all, keys });
const school = (tenantId: string): School => ({
  tenantId,
  name: tenantId,
  status: 'active',
  license: { status: 'active', tierName: null, validUntil: null, expiringSoon: false, modules: [] },
});

describe('resolveShells (ARCHITECTURE §3)', () => {
  it('teacher shell for attendance.mark or exam_result.save', () => {
    expect(resolveShells({ permissions: perms(['attendance.mark']) })).toEqual(['teacher']);
    expect(resolveShells({ permissions: perms(['exam_result.save']) })).toEqual(['teacher']);
  });

  it('teacher shell for a user holding every permission', () => {
    expect(resolveShells({ permissions: perms([], true) })).toEqual(['teacher']);
  });

  it('guardian shell for portal.student.read (the guardian role)', () => {
    expect(resolveShells({ permissions: perms(['portal.student.read', 'portal.fees.read']) })).toEqual(['guardian']);
  });

  it('a guardian-only permission set never gets the teacher shell', () => {
    expect(resolveShells({ permissions: perms(['portal.student.read']) })).not.toContain('teacher');
  });

  it('both shells when the user is a teacher and a guardian', () => {
    expect(resolveShells({ permissions: perms(['attendance.mark', 'portal.student.read']) })).toEqual([
      'teacher',
      'guardian',
    ]);
  });

  it('no shell → "use the web app" (e.g. an accountant)', () => {
    expect(resolveShells({ permissions: perms(['finance.payment.create', 'finance.invoice.read']) })).toEqual([]);
  });
});

describe('pickShell', () => {
  it('keeps the persisted shell while it is still available', () => {
    expect(pickShell(['teacher', 'guardian'], 'guardian')).toBe('guardian');
  });

  it('falls back to the first available shell', () => {
    expect(pickShell(['teacher'], 'guardian')).toBe('teacher');
    expect(pickShell(['teacher', 'guardian'], null)).toBe('teacher');
  });

  it('is null when nothing is available', () => {
    expect(pickShell([], 'teacher')).toBeNull();
  });
});

describe('pickTenant', () => {
  it('0 schools → none', () => {
    expect(pickTenant([], 't1')).toEqual({ kind: 'none' });
  });

  it('1 school → auto-select', () => {
    expect(pickTenant([school('t1')], null)).toEqual({ kind: 'selected', tenantId: 't1' });
  });

  it('many schools and no stored choice → picker', () => {
    expect(pickTenant([school('t1'), school('t2')], null)).toEqual({ kind: 'choose' });
  });

  it('many schools and a still-valid stored choice → that school', () => {
    expect(pickTenant([school('t1'), school('t2')], 't2')).toEqual({ kind: 'selected', tenantId: 't2' });
  });

  it('a stored school that is no longer listed is never used', () => {
    expect(pickTenant([school('t1'), school('t2')], 'gone')).toEqual({ kind: 'choose' });
    expect(pickTenant([school('t1')], 'gone')).toEqual({ kind: 'selected', tenantId: 't1' });
  });
});
