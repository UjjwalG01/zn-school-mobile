// School selection changes. A school's cached queries are removed by key prefix whenever the school
// stops being the selected one (security.md §4), so one school's data never shows under another.
import type { QueryClient } from '@tanstack/react-query';

import { removeTenantQueries } from '../api/queryKeys';
import { mySchoolsKey } from './queries';
import { clearTenant, getSession, selectTenant } from './session';

/** Select `tenantId` (must come from GET /tenancy/my-schools). */
export function chooseSchool(queryClient: QueryClient, tenantId: string): void {
  const previous = getSession().tenantId;
  if (previous && previous !== tenantId) removeTenantQueries(queryClient, previous);
  selectTenant(tenantId);
}

/** Deselect the current school and drop its cache; resolution then picks again. */
export function forgetSchool(queryClient: QueryClient): void {
  const previous = getSession().tenantId;
  if (previous) removeTenantQueries(queryClient, previous);
  clearTenant();
}

/** TENANT_MEMBERSHIP_NOT_FOUND: forget the school and refetch the list it came from. */
export function dropSelectedSchool(queryClient: QueryClient): void {
  forgetSchool(queryClient);
  void queryClient.invalidateQueries({ queryKey: mySchoolsKey() });
}
