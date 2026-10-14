// Context resolution (ARCHITECTURE §3) as pure functions. Everything here is a UX hint; the
// backend authorizes every call (ADR-0038).
import type { MyPermissions, School } from '../api/types/tenancy';
import type { Shell } from './tenantStore';

/** A holder of either permission can do teacher work (B5 assignments are not available yet). */
export const TEACHER_PERMISSIONS = ['attendance.mark', 'exam_result.save'] as const;

export interface ShellInput {
  permissions: MyPermissions;
  /** Guardian-audience role. No endpoint exposes it until B4, so callers pass false today. */
  isGuardian: boolean;
}

/** Shells the user can use in the selected school. Empty = "use the web app". */
export function resolveShells({ permissions, isGuardian }: ShellInput): Shell[] {
  const shells: Shell[] = [];
  if (permissions.all || TEACHER_PERMISSIONS.some((key) => permissions.keys.includes(key))) {
    shells.push('teacher');
  }
  if (isGuardian) shells.push('guardian');
  return shells;
}

/** Keeps the persisted shell if still available; otherwise the first available one. */
export function pickShell(available: readonly Shell[], persisted: Shell | null): Shell | null {
  if (persisted && available.includes(persisted)) return persisted;
  return available[0] ?? null;
}

export type TenantSelection =
  | { kind: 'none' } // 0 schools → "no school access"
  | { kind: 'selected'; tenantId: string } // stored choice still valid, or the only school
  | { kind: 'choose' }; // several schools and no valid stored choice → picker

export function pickTenant(schools: readonly School[], storedTenantId: string | null): TenantSelection {
  if (schools.length === 0) return { kind: 'none' };
  if (storedTenantId && schools.some((school) => school.tenantId === storedTenantId)) {
    return { kind: 'selected', tenantId: storedTenantId };
  }
  const [only] = schools;
  return schools.length === 1 && only ? { kind: 'selected', tenantId: only.tenantId } : { kind: 'choose' };
}
