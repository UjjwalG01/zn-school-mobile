import type { QueryClient, QueryKey } from '@tanstack/react-query';

// Every query key starts with its scope so a school switch can never show another school's cache
// (.claude/rules/mobile-frontend.md §3): `[tenantId, domain, ...params]`.

/** Scope for data that belongs to the user, not to a school (`/identity/me`, `/tenancy/my-schools`). */
export const USER_SCOPE = '_user';

export function tenantKey(tenantId: string, ...parts: readonly unknown[]): QueryKey {
  if (!tenantId) throw new Error('tenantKey requires a tenantId');
  return [tenantId, ...parts];
}

export function userKey(...parts: readonly unknown[]): QueryKey {
  return [USER_SCOPE, ...parts];
}

/** School switch / membership lost: drop every cached query of that school (security.md §4). */
export function removeTenantQueries(queryClient: QueryClient, tenantId: string): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === tenantId });
}
