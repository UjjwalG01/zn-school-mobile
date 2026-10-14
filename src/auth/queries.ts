// The three context queries, shared by the resolve gate and any screen that needs the data.
// Session staleTime class (15 min); user-scoped keys for me/schools, tenant-prefixed for permissions.
import { useQuery } from '@tanstack/react-query';

import { STALE_TIME } from '../api/staleTime';
import { tenantKey, userKey } from '../api/queryKeys';
import { getMe } from '../api/identity';
import { getMyPermissions, getMySchools } from '../api/tenancy';

export const meKey = () => userKey('me');
export const mySchoolsKey = () => userKey('my-schools');
export const myPermissionsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'my-permissions') : userKey('my-permissions', 'no-school');

export const useMe = (enabled = true) =>
  useQuery({ queryKey: meKey(), queryFn: getMe, staleTime: STALE_TIME.session, enabled });

export const useMySchools = (enabled = true) =>
  useQuery({
    queryKey: mySchoolsKey(),
    queryFn: getMySchools,
    staleTime: STALE_TIME.session,
    enabled,
  });

export const useMyPermissions = (tenantId: string | null, enabled = true) =>
  useQuery({
    queryKey: myPermissionsKey(tenantId),
    queryFn: getMyPermissions,
    staleTime: STALE_TIME.session,
    enabled: enabled && tenantId !== null,
  });
