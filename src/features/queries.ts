// Tenant-level reads shared by the feature shell: calendar preference and mobile-module toggles.
// Same null-tenant pattern as `myPermissionsKey` in src/auth/queries.ts.
import { useQuery } from '@tanstack/react-query';

import { getMobileModules, getTenantSettings } from '../api/settings';
import { tenantKey, userKey } from '../api/queryKeys';
import { STALE_TIME } from '../api/staleTime';
import { useSession } from '../auth/session';

export const tenantSettingsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'tenant-settings') : userKey('tenant-settings', 'no-school');
export const mobileModulesKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'mobile-modules') : userKey('mobile-modules', 'no-school');

/** `GET /settings/tenant` — Reference class (changes rarely). */
export function useTenantSettings() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: tenantSettingsKey(tenantId),
    queryFn: getTenantSettings,
    staleTime: STALE_TIME.reference,
    enabled: tenantId !== null,
  });
}

/** `GET /settings/tenant/mobile-modules` — Session class, like the other visibility inputs. */
export function useMobileModules() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: mobileModulesKey(tenantId),
    queryFn: getMobileModules,
    staleTime: STALE_TIME.session,
    enabled: tenantId !== null,
  });
}
