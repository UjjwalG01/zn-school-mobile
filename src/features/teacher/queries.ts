// Teacher portal reads, shared by every teacher feature (Home now; Attendance and Marks later).
// Both are Daily class: `exams` carries live submission state, so it is not Reference.
import { useQuery } from '@tanstack/react-query';

import { getTeacherExams, getTeacherMyClasses } from '../../api/portal';
import { tenantKey, userKey } from '../../api/queryKeys';
import { STALE_TIME } from '../../api/staleTime';
import { useSession } from '../../auth/session';

export const teacherMyClassesKey = (tenantId: string | null, date: string) =>
  tenantId ? tenantKey(tenantId, 'teacher', 'my-classes', date) : userKey('teacher-my-classes', 'no-school');
/** Marks slices invalidate this key after a save or submit. */
export const teacherExamsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'teacher', 'exams') : userKey('teacher-exams', 'no-school');

/** `date` is `YYYY-MM-DD`; it is part of the key so the data rolls over at midnight. */
export function useTeacherMyClasses(date: string) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: teacherMyClassesKey(tenantId, date),
    queryFn: () => getTeacherMyClasses(date),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null,
  });
}

/** `enabled = false` skips the call when the Marks feature is not visible. */
export function useTeacherExams(enabled = true) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: teacherExamsKey(tenantId),
    queryFn: getTeacherExams,
    staleTime: STALE_TIME.daily,
    enabled: enabled && tenantId !== null,
  });
}
