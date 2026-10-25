// My Attendance reads and the one write. Daily class (5 min); the month is part of the key, and the
// tenant prefix wipes it on logout and school switch. "Mark present" patches the loaded month from
// the response instead of refetching.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMyAttendance, markMyselfPresent } from '../../../api/attendance';
import { tenantKey, userKey } from '../../../api/queryKeys';
import { STALE_TIME } from '../../../api/staleTime';
import type { MyAttendance } from '../../../api/types/attendance';
import { useSession } from '../../../auth/session';
import { upsertRecord } from './model';

const scope = (tenantId: string) => tenantKey(tenantId, 'teacher', 'self-attendance');

/** `month = null` is the school's current month (the server decides which that is). */
export const myAttendanceKey = (tenantId: string | null, month: string | null) =>
  tenantId
    ? [...scope(tenantId), month ?? 'current']
    : userKey('teacher-self-attendance', 'no-school');

/**
 * `enabled = false` keeps the request off (the Dashboard chart for a teacher without `attendance.self`). The Dashboard
 * chart and the My Attendance screen read the same `null` month, so together they cost one request per `staleTime`.
 */
export function useMyAttendance(month: string | null, enabled = true) {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: myAttendanceKey(tenantId, month),
    queryFn: () => getMyAttendance(month ?? undefined),
    staleTime: STALE_TIME.daily,
    enabled: enabled && tenantId !== null,
  });
}

/** Never retried and never queued: the caller sees the outcome (`created`, `unchanged`) or the error. */
export function useMarkPresent() {
  const queryClient = useQueryClient();
  const { tenantId } = useSession();
  return useMutation({
    mutationFn: () => markMyselfPresent(), // no arguments: the request has no body
    onSuccess: ({ record }) => {
      if (!tenantId) return;
      const month = record.attendanceDate.slice(0, 7);
      queryClient.setQueriesData<MyAttendance>({ queryKey: scope(tenantId) }, (cached) =>
        cached && cached.month === month
          ? { ...cached, records: upsertRecord(cached.records, record) }
          : cached,
      );
    },
  });
}
