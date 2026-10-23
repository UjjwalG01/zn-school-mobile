// The teacher's student-details read (docs/project/STUDENT_INFO_PLAN.md §5). Daily class: access can
// change when assignments change. `meta.persist: false` keeps it out of the on-device cache (SI-D3):
// it holds other people's phone numbers and health data, so it lives in memory for the session only.
import { useQuery } from '@tanstack/react-query';

import { getTeacherStudent } from '../../../api/portal';
import { tenantKey, userKey } from '../../../api/queryKeys';
import { STALE_TIME } from '../../../api/staleTime';
import { useSession } from '../../../auth/session';

export const teacherStudentKey = (tenantId: string | null, studentId: string) =>
  tenantId ? tenantKey(tenantId, 'teacher', 'student', studentId) : userKey('teacher-student', 'no-school');

/** `studentId = null` keeps the request off (a link with no id). */
export function useTeacherStudent(studentId: string | null) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: studentId ? teacherStudentKey(tenantId, studentId) : userKey('teacher-student', 'no-student'),
    queryFn: () => getTeacherStudent(studentId!),
    staleTime: STALE_TIME.daily,
    enabled: tenantId !== null && studentId !== null,
    meta: { persist: false },
  });
}
