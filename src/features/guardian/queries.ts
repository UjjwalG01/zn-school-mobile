// Guardian reads. The children list is Daily class (5 min, persisted, wiped on logout and school switch by its tenant-prefixed key),
// the same class as the teacher's roster. Keys start with the school so a switch can never show another school's children.
import { useQuery } from '@tanstack/react-query';

import { getGuardianStudents } from '../../api/portal';
import { tenantKey, userKey } from '../../api/queryKeys';
import { STALE_TIME } from '../../api/staleTime';
import { useSession } from '../../auth/session';

export const guardianStudentsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'guardian', 'students') : userKey('guardian-students', 'no-school');

/** Every child linked to the signed-in guardian in the selected school. Off until a school is selected. */
export function useGuardianStudents() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: guardianStudentsKey(tenantId),
    queryFn: getGuardianStudents,
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}
